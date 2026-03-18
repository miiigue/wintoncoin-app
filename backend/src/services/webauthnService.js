/**
 * WebAuthn Service — Autenticación Biométrica para Gobernanza
 *
 * Implementa el estándar W3C WebAuthn (FIDO2) usando @simplewebauthn/server.
 * Garantiza que cada voto de gobernanza requiera presencia física del guardián
 * mediante huella digital, Face ID, o dispositivo de seguridad (YubiKey).
 *
 * Flujo:
 *   1. REGISTRO:   Guardián registra su dispositivo biométrico (una vez)
 *   2. AUTENTICACIÓN: Cada voto requiere firma biométrica vinculada al request_id
 *
 * Seguridad:
 *   - Challenge con TTL de 5 minutos (anti-replay)
 *   - userVerification: 'required' (obliga biometría, no solo presencia)
 *   - Counter incremental (detecta clonación de dispositivos)
 *   - Challenges single-use (marcados como used tras verificación)
 */

const {
    generateRegistrationOptions,
    verifyRegistrationResponse,
    generateAuthenticationOptions,
    verifyAuthenticationResponse,
} = require('@simplewebauthn/server');

// ─── Configuración (desde variables de entorno) ────────────────────────────
const RP_NAME  = process.env.WEBAUTHN_RP_NAME  || 'WintonCoin';
const RP_ID    = process.env.WEBAUTHN_RP_ID    || 'localhost';
const ORIGIN   = process.env.WEBAUTHN_ORIGIN   || (RP_ID === 'localhost' ? 'http://localhost:3000' : `https://${RP_ID}`);

const CHALLENGE_TTL_MS = 5 * 60 * 1000; // 5 minutos

// ════════════════════════════════════════════════════════════════════════════
// REGISTRO: El guardián asocia su dispositivo biométrico
// ════════════════════════════════════════════════════════════════════════════

/**
 * Genera las opciones de registro WebAuthn y almacena el challenge.
 * @returns {PublicKeyCredentialCreationOptionsJSON} Opciones para navigator.credentials.create()
 */
async function generateRegistrationChallenge(pool, userId, username, existingCredentialIds) {
    const options = await generateRegistrationOptions({
        rpName: RP_NAME,
        rpID: RP_ID,
        userID: String(userId),
        userName: username,
        attestationType: 'none',
        authenticatorSelection: {
            authenticatorAttachment: 'platform',
            residentKey: 'preferred',
            userVerification: 'required',
        },
        excludeCredentials: (existingCredentialIds || []).map(id => ({
            id,
            type: 'public-key',
        })),
    });

    const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS);
    await pool.query(
        `INSERT INTO governance_webauthn_challenges (user_id, challenge, type, expires_at)
         VALUES ($1, $2, 'registration', $3)`,
        [userId, options.challenge, expiresAt]
    );

    return options;
}

/**
 * Verifica la respuesta del navegador y extrae las credenciales.
 * @returns {{ credentialId, publicKey, counter }} Credenciales para almacenar
 */
async function verifyRegistrationCredential(pool, userId, credential) {
    const challengeRes = await pool.query(
        `SELECT id, challenge FROM governance_webauthn_challenges
         WHERE user_id = $1 AND type = 'registration' AND used = FALSE AND expires_at > NOW()
         ORDER BY created_at DESC LIMIT 1`,
        [userId]
    );

    if (challengeRes.rowCount === 0) {
        throw new Error('No hay un desafío de registro válido. Inicia el proceso de nuevo.');
    }

    const { id: challengeId, challenge } = challengeRes.rows[0];

    const verification = await verifyRegistrationResponse({
        response: credential,
        expectedChallenge: challenge,
        expectedOrigin: ORIGIN,
        expectedRPID: RP_ID,
    });

    if (!verification.verified || !verification.registrationInfo) {
        throw new Error('La verificación biométrica falló.');
    }

    await pool.query(
        'UPDATE governance_webauthn_challenges SET used = TRUE WHERE id = $1',
        [challengeId]
    );

    const { credentialID, credentialPublicKey, counter } = verification.registrationInfo;

    return {
        credentialId: Buffer.from(credentialID).toString('base64url'),
        publicKey: Buffer.from(credentialPublicKey).toString('base64'),
        counter: counter || 0,
    };
}

// ════════════════════════════════════════════════════════════════════════════
// AUTENTICACIÓN: El guardián demuestra identidad al votar
// ════════════════════════════════════════════════════════════════════════════

/**
 * Genera opciones de autenticación vinculadas a un request_id específico.
 * @returns {PublicKeyCredentialRequestOptionsJSON} Opciones para navigator.credentials.get()
 */
async function generateAuthenticationChallenge(pool, userId, requestId) {
    const guardianRes = await pool.query(
        `SELECT webauthn_credential_id, webauthn_transports
         FROM governance_guardians
         WHERE user_id = $1 AND status = 'active' AND webauthn_credential_id IS NOT NULL`,
        [userId]
    );

    if (guardianRes.rowCount === 0) {
        throw new Error('No tienes credenciales biométricas registradas. Completa el registro primero.');
    }

    const guardian = guardianRes.rows[0];
    const transports = guardian.webauthn_transports || ['internal'];

    const options = await generateAuthenticationOptions({
        rpID: RP_ID,
        allowCredentials: [{
            id: guardian.webauthn_credential_id,
            type: 'public-key',
            transports,
        }],
        userVerification: 'required',
    });

    const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS);
    await pool.query(
        `INSERT INTO governance_webauthn_challenges (user_id, challenge, type, request_id, expires_at)
         VALUES ($1, $2, 'authentication', $3, $4)`,
        [userId, options.challenge, requestId, expiresAt]
    );

    return options;
}

/**
 * Verifica la firma biométrica del guardián para un voto.
 * @returns {{ verified, signature, authenticatorData, clientDataJSON, challenge }}
 */
async function verifyAuthenticationCredential(pool, userId, authResponse, requestId) {
    const challengeRes = await pool.query(
        `SELECT id, challenge FROM governance_webauthn_challenges
         WHERE user_id = $1 AND type = 'authentication' AND request_id = $2
           AND used = FALSE AND expires_at > NOW()
         ORDER BY created_at DESC LIMIT 1`,
        [userId, requestId]
    );

    if (challengeRes.rowCount === 0) {
        throw new Error('No hay un desafío de autenticación válido para esta solicitud.');
    }

    const { id: challengeId, challenge } = challengeRes.rows[0];

    const guardianRes = await pool.query(
        `SELECT webauthn_credential_id, webauthn_public_key, webauthn_counter
         FROM governance_guardians
         WHERE user_id = $1 AND status = 'active'`,
        [userId]
    );

    if (guardianRes.rowCount === 0) {
        throw new Error('Guardián no encontrado o inactivo.');
    }

    const g = guardianRes.rows[0];

    const verification = await verifyAuthenticationResponse({
        response: authResponse,
        expectedChallenge: challenge,
        expectedOrigin: ORIGIN,
        expectedRPID: RP_ID,
        authenticator: {
            credentialID: Buffer.from(g.webauthn_credential_id, 'base64url'),
            credentialPublicKey: Buffer.from(g.webauthn_public_key, 'base64'),
            counter: parseInt(g.webauthn_counter, 10) || 0,
        },
    });

    if (!verification.verified) {
        throw new Error('Firma biométrica inválida. El voto no se registró.');
    }

    // Actualizar counter (anti-clonación)
    const newCounter = verification.authenticationInfo.newCounter;
    await pool.query(
        'UPDATE governance_guardians SET webauthn_counter = $1 WHERE user_id = $2',
        [newCounter, userId]
    );

    // Marcar challenge como usado (anti-replay)
    await pool.query(
        'UPDATE governance_webauthn_challenges SET used = TRUE WHERE id = $1',
        [challengeId]
    );

    return {
        verified: true,
        signature: authResponse.response?.signature || null,
        authenticatorData: authResponse.response?.authenticatorData || null,
        clientDataJSON: authResponse.response?.clientDataJSON || null,
        challenge,
    };
}

// ════════════════════════════════════════════════════════════════════════════
// LIMPIEZA: Purgar challenges expirados
// ════════════════════════════════════════════════════════════════════════════

async function purgeExpiredChallenges(pool) {
    const res = await pool.query(
        'DELETE FROM governance_webauthn_challenges WHERE expires_at < NOW() OR used = TRUE'
    );
    return res.rowCount;
}

module.exports = {
    generateRegistrationChallenge,
    verifyRegistrationCredential,
    generateAuthenticationChallenge,
    verifyAuthenticationCredential,
    purgeExpiredChallenges,
    RP_ID,
    RP_NAME,
    ORIGIN,
};
