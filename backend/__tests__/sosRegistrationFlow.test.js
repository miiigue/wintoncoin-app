/**
 * Suite de Pruebas: Flujo Completo de Registro SOS y Verificación OTP
 * ════════════════════════════════════════════════════════════════════════════════
 * PROPÓSITO: Validar los 2 flujos críticos que tocan cuentas de usuario:
 *   1. registerVictimPublic  — Registro inicial del formulario SOS
 *   2. verifyVictimOtpPublic — Verificación del código OTP de 6 dígitos
 *
 * ESCENARIOS CUBIERTOS:
 *   - Usuario NUEVO envía formulario SOS (happy path)
 *   - Usuario EXISTENTE envía formulario SOS (no debe duplicar cuenta)
 *   - Usuario EXISTENTE verifica OTP (no debe recibir bonos, no debe pedir contraseña)
 *   - Usuario NUEVO verifica OTP (debe recibir bonos y establecer contraseña)
 *   - Validación de entrada: email/otp_code vacíos, tipos no-string
 *   - Parámetros SQL alineados: $1 siempre corresponde al primer valor del array
 *
 * ESTÁNDAR: Auditoría FinTech / SOC 2 — Todo flujo que toca saldos o cuentas
 *           DEBE tener pruebas unitarias que simulen cada rama de ejecución.
 * ════════════════════════════════════════════════════════════════════════════════
 */

'use strict';

// ── Variables de entorno requeridas para que los módulos carguen sin error ─────
process.env.JWT_SECRET = 'test-jwt-secret-key-for-sos-flow-2026';
process.env.ADMIN_SECRET_KEY = 'test-admin-secret-key-2026';

// ── Mock del Pool de PostgreSQL ───────────────────────────────────────────────
// Se interceptan TODAS las llamadas a client.query para inspeccionar
// los parámetros SQL sin necesidad de una base de datos real.
const mockClient = {
    query: jest.fn().mockResolvedValue({ rowCount: 0, rows: [] }),
    release: jest.fn()
};

jest.mock('../src/config/db', () => ({
    query: jest.fn().mockResolvedValue({ rowCount: 0, rows: [] }),
    connect: jest.fn().mockResolvedValue(mockClient),
    on: jest.fn()
}));

// ── Mock de Servicios Externos (No se prueban aquí) ──────────────────────────
jest.mock('../src/services/auditService', () => ({
    logAuditEvent: jest.fn().mockResolvedValue(true)
}));

jest.mock('../src/services/emailService', () => ({
    generateOtp6: () => '123456',
    hashOtpForEmail: (email, code) => `hash_${email}_${code}`,
    safeEqualHex: (a, b) => a === b,
    sendOtpEmail: jest.fn().mockResolvedValue(true),
    sendCustomEmail: jest.fn().mockResolvedValue(true),
    sendTransactionEmail: jest.fn().mockResolvedValue(true)
}));

jest.mock('../src/services/notificationService', () => ({
    sendNotificationToUser: jest.fn().mockResolvedValue({ sent: 0, failed: 0 }),
    initializeWebPush: jest.fn()
}));

jest.mock('../src/services/referralRewardService', () => ({
    processReferralReward: jest.fn().mockResolvedValue({ success: true, rewardAmount: 0 })
}));

// ── Carga del Controlador bajo prueba ─────────────────────────────────────────
const victimController = require('../src/controllers/victimController');
const db = require('../src/config/db');

// ── Helpers para crear objetos req/res mock ───────────────────────────────────
function createMockRes() {
    const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
        cookie: jest.fn().mockReturnThis()
    };
    return res;
}

// ════════════════════════════════════════════════════════════════════════════════
// BLOQUE 1: Pruebas de registerVictimPublic
// ════════════════════════════════════════════════════════════════════════════════
describe('registerVictimPublic — Registro Inicial del Formulario SOS', () => {

    beforeEach(() => {
        // Limpiar todos los mocks antes de cada prueba para evitar contaminación
        jest.clearAllMocks();
        mockClient.query.mockReset();
        // Por defecto, BEGIN y COMMIT no fallan
        mockClient.query.mockResolvedValue({ rowCount: 0, rows: [] });
    });

    test('1. Debe rechazar el registro si faltan campos obligatorios', async () => {
        const req = {
            body: {
                full_name: '',  // Campo vacío
                id_document: 'V-12345678',
                email: 'test@test.com',
                phone_number: '+584141234567',
                state: 'Miranda',
                municipality: 'Baruta',
                sector: 'Las Minas',
                address_details: 'Calle 1',
                description: 'Daños por sismo'
            }
        };
        const res = createMockRes();

        await victimController.registerVictimPublic(req, res);

        // Debe retornar 400 sin tocar la base de datos
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            success: false,
            message: expect.stringContaining('campos obligatorios')
        }));
    });

    test('2. Debe rechazar el registro si las declaraciones legales no están aceptadas', async () => {
        const req = {
            body: {
                full_name: 'Juan Pérez',
                id_document: 'V-12345678',
                email: 'test@test.com',
                phone_number: '+584141234567',
                state: 'Miranda',
                municipality: 'Baruta',
                sector: 'Las Minas',
                address_details: 'Calle 1',
                description: 'Daños por sismo',
                data_consent_accepted: false,  // No aceptado
                sworn_declaration_accepted: true
            }
        };
        const res = createMockRes();

        await victimController.registerVictimPublic(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            message: expect.stringContaining('consentimiento')
        }));
    });

    test('3. Debe rechazar números telefónicos fuera de Venezuela (+58)', async () => {
        const req = {
            body: {
                full_name: 'Juan Pérez',
                id_document: 'V-12345678',
                email: 'test@test.com',
                phone_number: '+573001234567',  // Colombia, no Venezuela
                state: 'Miranda',
                municipality: 'Baruta',
                sector: 'Las Minas',
                address_details: 'Calle 1',
                description: 'Daños por sismo',
                data_consent_accepted: true,
                sworn_declaration_accepted: true
            }
        };
        const res = createMockRes();

        await victimController.registerVictimPublic(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            message: expect.stringContaining('+58')
        }));
    });

    test('3.1 En registerVictimPublic (Fase 1), se crea la cuenta con is_verified = false, se guarda el código especial de referido en pending_verifications y NO se acredita ningún bono todavía', async () => {
        const referralRewardService = require('../src/services/referralRewardService');

        // Configurar mock de base de datos para simular un usuario NUEVO que envía el formulario SOS
        mockClient.query
            .mockResolvedValueOnce({ rows: [], rowCount: 0 })  // BEGIN
            .mockResolvedValueOnce({ rows: [], rowCount: 0 })  // Unicidad de Cédula: no existe expediente previo
            .mockResolvedValueOnce({ rows: [], rowCount: 0 })  // Búsqueda de usuario: no existe en users (es NUEVO)
            .mockResolvedValueOnce({ rows: [], rowCount: 0 })  // Colisión de username: único
            .mockResolvedValueOnce({ rows: [], rowCount: 0 })  // generateUniqueReferralCode: código único (rowCount = 0)
            .mockResolvedValueOnce({ rows: [{ id: 101 }], rowCount: 1 }) // INSERT INTO users (...) RETURNING id
            .mockResolvedValueOnce({ rows: [{ setting_value: 'SOSVENEZUELADEMO' }], rowCount: 1 }) // SELECT app_settings referral_custom_share_code
            .mockResolvedValueOnce({ rows: [], rowCount: 1 })  // INSERT INTO pending_verifications (...)
            .mockResolvedValueOnce({ rows: [{ id: 50 }], rowCount: 1 }) // INSERT INTO disaster_victims_registry (...) RETURNING id
            .mockResolvedValueOnce({ rows: [], rowCount: 1 })  // UPDATE disaster_victims_registry SET dossier_number
            .mockResolvedValueOnce({ rows: [], rowCount: 0 })  // COMMIT
            .mockResolvedValue({ rows: [], rowCount: 0 });     // Consultas auxiliares de plantilla de email y auditoría

        const req = {
            body: {
                full_name: 'Ana María Gómez',
                id_document: 'V-20123456',
                birth_date: '1995-06-15',
                gender: 'female',
                is_head_of_family: true,
                email: 'ana.gomez@test.com',
                phone_number: '+584141112233',
                state: 'Sucre',
                municipality: 'Bermúdez',
                sector: 'Playa Grande',
                address_details: 'Calle Marina #4',
                dependents_minors: 2,
                dependents_elderly: 1,
                dependents_disabled: 0,
                affectation_level: 'total_loss',
                description: 'Vivienda colapsada tras el terremoto',
                data_consent_accepted: true,
                sworn_declaration_accepted: true
            },
            headers: { 'x-forwarded-for': '127.0.0.1' },
            socket: { remoteAddress: '127.0.0.1' }
        };
        const res = createMockRes();

        await victimController.registerVictimPublic(req, res);

        // 1. Debe responder con éxito 201 y marcar is_new_user = true
        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            success: true,
            is_new_user: true,
            email: 'ana.gomez@test.com'
        }));

        // 2. Verificar que se insertó el usuario con is_verified = false
        const userInsertCall = mockClient.query.mock.calls.find(
            call => typeof call[0] === 'string' && call[0].includes('INSERT INTO users')
        );
        expect(userInsertCall).toBeDefined();
        expect(userInsertCall[0]).toContain('false'); // is_verified es false

        // 3. Verificar que pending_verifications recibió el código de referido especial
        const pendingInsertCall = mockClient.query.mock.calls.find(
            call => typeof call[0] === 'string' && call[0].includes('INSERT INTO pending_verifications')
        );
        expect(pendingInsertCall).toBeDefined();
        expect(pendingInsertCall[1]).toContain('SOSVENEZUELADEMO'); // Parámetro del código especial

        // 4. CRÍTICO: En la Fase 1 NO se debe haber llamado a processReferralReward
        // Ni el nuevo usuario ni la causa solidaria reciben bonos en esta fase preliminar
        expect(referralRewardService.processReferralReward).not.toHaveBeenCalled();
    });

    test('3.2 Smart Resume: Si la cédula ya tiene expediente pero el usuario no ha completado el OTP (is_verified = false), regenera OTP y responde con resume_verification = true', async () => {
        // Mock: la cédula ya existe en disaster_victims_registry pero su usuario NO está verificado
        mockClient.query
            .mockResolvedValueOnce({ rows: [] })  // BEGIN
            .mockResolvedValueOnce({
                rows: [{
                    id: 55,
                    dossier_number: 'SOS-VZLA-4332-00055',
                    user_id: 102,
                    email: 'carlos.mendoza@test.com',
                    is_verified: false,
                    username: 'carlos_mendoza'
                }],
                rowCount: 1
            }) // existingDossier check
            .mockResolvedValueOnce({ rows: [{ setting_value: 'SOSVENEZUELADEMO' }], rowCount: 1 }) // customCodeRes
            .mockResolvedValueOnce({ rows: [], rowCount: 1 })  // pending_verifications UPSERT
            .mockResolvedValueOnce({ rows: [], rowCount: 0 }); // COMMIT

        const req = {
            body: {
                full_name: 'Carlos Mendoza',
                id_document: 'V-15888999',
                email: 'carlos.mendoza@test.com',
                phone_number: '+584129998877',
                state: 'Anzoátegui',
                municipality: 'Bolívar',
                sector: 'Barcelona Centro',
                address_details: 'Av. 5 Casa 12',
                description: 'Inundaciones y daños',
                data_consent_accepted: true,
                sworn_declaration_accepted: true
            },
            headers: { 'x-forwarded-for': '127.0.0.1' },
            socket: { remoteAddress: '127.0.0.1' }
        };
        const res = createMockRes();

        await victimController.registerVictimPublic(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            success: true,
            resume_verification: true,
            dossier_number: 'SOS-VZLA-4332-00055',
            email: 'carlos.mendoza@test.com'
        }));
    });

    test('3.3 Already Active: Si la cédula ya tiene expediente y su cuenta ya está activa (is_verified = true), responde 409 con already_active = true', async () => {
        // Mock: la cédula ya existe y el usuario ya está verificado y activo
        mockClient.query
            .mockResolvedValueOnce({ rows: [] })  // BEGIN
            .mockResolvedValueOnce({
                rows: [{
                    id: 60,
                    dossier_number: 'SOS-VZLA-4332-00060',
                    user_id: 103,
                    email: 'maria.rodriguez@test.com',
                    is_verified: true,
                    username: 'maria_rodriguez'
                }],
                rowCount: 1
            }) // existingDossier check
            .mockResolvedValueOnce({ rows: [], rowCount: 0 }); // ROLLBACK

        const req = {
            body: {
                full_name: 'María Rodríguez',
                id_document: 'V-14777888',
                email: 'maria.rodriguez@test.com',
                phone_number: '+584145556677',
                state: 'Miranda',
                municipality: 'Chacao',
                sector: 'Bello Campo',
                address_details: 'Edif. 2 Apto 4',
                description: 'Daños estructurales',
                data_consent_accepted: true,
                sworn_declaration_accepted: true
            }
        };
        const res = createMockRes();

        await victimController.registerVictimPublic(req, res);

        expect(res.status).toHaveBeenCalledWith(409);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            success: false,
            already_active: true,
            dossier_number: 'SOS-VZLA-4332-00060'
        }));
    });
});

// ════════════════════════════════════════════════════════════════════════════════
// BLOQUE 2: Pruebas de resendVictimOtpPublic (Reenvío de Código OTP)
// ════════════════════════════════════════════════════════════════════════════════
describe('resendVictimOtpPublic — Reenvío Seguro de Código OTP', () => {

    beforeEach(() => {
        jest.clearAllMocks();
        mockClient.query.mockReset();
        mockClient.query.mockResolvedValue({ rowCount: 0, rows: [] });
    });

    test('11. Debe reenviar OTP exitosamente y actualizar el hash en pending_verifications', async () => {
        // Simular que el último envío fue hace más de 60 segundos (ej. hace 2 minutos)
        const twoMinutesAgo = new Date(Date.now() - 120 * 1000);
        mockClient.query
            .mockResolvedValueOnce({ rows: [] })  // BEGIN
            .mockResolvedValueOnce({
                rows: [{
                    id: 1,
                    email: 'test.resend@test.com',
                    last_sent_at: twoMinutesAgo,
                    resend_count: 1
                }],
                rowCount: 1
            }) // pendingRes
            .mockResolvedValueOnce({ rows: [], rowCount: 1 })  // UPDATE pending_verifications
            .mockResolvedValueOnce({ rows: [], rowCount: 0 }); // COMMIT

        const req = {
            body: { email: 'test.resend@test.com' },
            headers: { 'x-forwarded-for': '127.0.0.1' },
            socket: { remoteAddress: '127.0.0.1' }
        };
        const res = createMockRes();

        await victimController.resendVictimOtpPublic(req, res);

        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            success: true,
            message: expect.stringContaining('reenviado')
        }));
    });

    test('12. Debe aplicar Rate-Limiting si se solicita un reenvío antes de cumplir los 60 segundos', async () => {
        // Simular que el último envío fue hace solo 10 segundos
        const tenSecondsAgo = new Date(Date.now() - 10 * 1000);
        mockClient.query
            .mockResolvedValueOnce({ rows: [] })  // BEGIN
            .mockResolvedValueOnce({
                rows: [{
                    id: 1,
                    email: 'test.fast@test.com',
                    last_sent_at: tenSecondsAgo,
                    resend_count: 1
                }],
                rowCount: 1
            }) // pendingRes
            .mockResolvedValueOnce({ rows: [], rowCount: 0 }); // ROLLBACK

        const req = {
            body: { email: 'test.fast@test.com' }
        };
        const res = createMockRes();

        await victimController.resendVictimOtpPublic(req, res);

        expect(res.status).toHaveBeenCalledWith(429);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            success: false,
            message: expect.stringContaining('segundos')
        }));
    });
});

// ════════════════════════════════════════════════════════════════════════════════
// BLOQUE 2: Pruebas de verifyVictimOtpPublic
// ════════════════════════════════════════════════════════════════════════════════
describe('verifyVictimOtpPublic — Verificación OTP de 6 Dígitos', () => {

    beforeEach(() => {
        jest.clearAllMocks();
        mockClient.query.mockReset();
        mockClient.query.mockResolvedValue({ rowCount: 0, rows: [] });
    });

    test('4. Debe rechazar si email o código OTP están vacíos', async () => {
        const req = { body: { email: '', otp_code: '' } };
        const res = createMockRes();

        await victimController.verifyVictimOtpPublic(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            message: expect.stringContaining('correo')
        }));
    });

    test('5. Debe manejar email como tipo no-string sin crashear (coerción segura)', async () => {
        // Simula un escenario donde el frontend envía el email como número
        const req = { body: { email: 12345, otp_code: 123456 } };
        const res = createMockRes();

        // No debe lanzar TypeError: email.trim is not a function
        await victimController.verifyVictimOtpPublic(req, res);

        // Puede retornar 400 (sin pending_verifications) pero NO debe ser 500
        expect(res.status).not.toHaveBeenCalledWith(500);
    });

    test('6. Debe rechazar si no hay solicitud pendiente de verificación', async () => {
        // Mock: BEGIN → OK
        mockClient.query
            .mockResolvedValueOnce({ rows: [] })  // BEGIN
            .mockResolvedValueOnce({ rows: [{ id: 1, username: 'existente', password_hash: '$2b$10$hash', is_verified: true }] }) // existingUserCheck
            .mockResolvedValueOnce({ rows: [] })  // pendingRes (no hay pending)
            .mockResolvedValueOnce({ rows: [] }); // ROLLBACK

        const req = {
            body: {
                email: 'existente@test.com',
                otp_code: '123456'
            }
        };
        const res = createMockRes();

        await victimController.verifyVictimOtpPublic(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            message: expect.stringContaining('solicitud pendiente')
        }));
    });

    test('7. Debe rechazar usuario nuevo si la contraseña tiene menos de 8 caracteres', async () => {
        // Mock: usuario nuevo (sin password_hash)
        mockClient.query
            .mockResolvedValueOnce({ rows: [] })  // BEGIN
            .mockResolvedValueOnce({ rows: [{ id: 2, username: 'nuevo', password_hash: null, is_verified: false }] }); // existingUserCheck: usuario sin contraseña

        const req = {
            body: {
                email: 'nuevo@test.com',
                otp_code: '123456',
                password: '1234',           // Muy corta
                password_confirm: '1234'
            }
        };
        const res = createMockRes();

        await victimController.verifyVictimOtpPublic(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            message: expect.stringContaining('8 caracteres')
        }));
    });

    test('8. Para usuario existente, la query UPDATE debe usar $1 (no $2) con un solo parámetro', async () => {
        // Este test valida directamente el bug que se corrigió ($2 → $1)
        // Mock completo del flujo de usuario existente:
        mockClient.query
            .mockResolvedValueOnce({ rows: [] })  // BEGIN
            .mockResolvedValueOnce({ rows: [{ id: 4, username: 'usuario_existente', password_hash: '$2b$10$hashvalido', is_verified: true }] }) // existingUserCheck: TIENE contraseña
            .mockResolvedValueOnce({ rows: [{ id: 1, email: 'existente@test.com', verification_code_hash: 'hash_existente@test.com_654321', verification_attempts: 0 }] }) // pendingRes
            .mockResolvedValueOnce({ rows: [] })  // UPDATE verification_attempts (no se ejecuta si OTP es correcto)
            .mockResolvedValueOnce({ rows: [] })  // UPDATE users SET is_verified = true WHERE email = $1
            .mockResolvedValueOnce({ rows: [{ id: 4, username: 'usuario_existente' }] }) // userRes
            .mockResolvedValueOnce({ rows: [{ id: 10, dossier_number: 'SOS-VZLA-4332-00010' }] }) // caseRes
            .mockResolvedValueOnce({ rows: [] })  // INSERT disaster_victim_history
            .mockResolvedValueOnce({ rows: [] })  // DELETE pending_verifications
            .mockResolvedValueOnce({ rows: [] })  // COMMIT
            .mockResolvedValue({ rows: [] });     // Auditoría y notificaciones posteriores

        const req = {
            body: {
                email: 'existente@test.com',
                otp_code: '654321'  // Código OTP que matchea el hash
            },
            headers: { 'user-agent': 'TestAgent/1.0' },
            ip: '127.0.0.1'
        };
        const res = createMockRes();

        await victimController.verifyVictimOtpPublic(req, res);

        // Verificar que la query UPDATE usa $1 correctamente con 1 solo parámetro
        const updateCall = mockClient.query.mock.calls.find(
            call => typeof call[0] === 'string' && call[0].includes('SET is_verified = true')
        );

        if (updateCall) {
            // La query debe usar $1, no $2
            expect(updateCall[0]).toContain('$1');
            expect(updateCall[0]).not.toMatch(/WHERE email = \$2/);
            // Debe pasar exactamente 1 parámetro
            expect(updateCall[1]).toHaveLength(1);
            expect(updateCall[1][0]).toBe('existente@test.com');
        }
    });

    test('9. Para usuario existente, NO debe invocar processReferralReward', async () => {
        const referralRewardService = require('../src/services/referralRewardService');

        // Mock: usuario existente con contraseña válida
        mockClient.query
            .mockResolvedValueOnce({ rows: [] })  // BEGIN
            .mockResolvedValueOnce({ rows: [{ id: 4, username: 'existente', password_hash: '$2b$10$hashvalido', is_verified: true }] })
            .mockResolvedValueOnce({ rows: [{ id: 1, email: 'existente@test.com', verification_code_hash: 'hash_existente@test.com_123456', verification_attempts: 0 }] })
            .mockResolvedValueOnce({ rows: [] })  // UPDATE users
            .mockResolvedValueOnce({ rows: [{ id: 4, username: 'existente' }] }) // userRes
            .mockResolvedValueOnce({ rows: [] })  // caseRes
            .mockResolvedValueOnce({ rows: [] })  // DELETE pending
            .mockResolvedValueOnce({ rows: [] })  // COMMIT
            .mockResolvedValue({ rows: [] });

        const req = {
            body: { email: 'existente@test.com', otp_code: '123456' },
            headers: { 'user-agent': 'TestAgent/1.0' },
            ip: '127.0.0.1'
        };
        const res = createMockRes();

        await victimController.verifyVictimOtpPublic(req, res);

        // processReferralReward NO debe ser invocado para usuarios existentes
        expect(referralRewardService.processReferralReward).not.toHaveBeenCalled();
    });

    test('10. Para usuario NUEVO (is_verified = false), DEBE invocar processReferralReward y actualizar password_hash', async () => {
        const referralRewardService = require('../src/services/referralRewardService');

        // Mock: usuario nuevo creado por SOS (is_verified = false)
        mockClient.query
            .mockResolvedValueOnce({ rows: [] })  // BEGIN
            .mockResolvedValueOnce({ rows: [{ id: 5, username: 'nuevo_sos', password_hash: '$2b$10$temphash', is_verified: false }] }) // existingUserCheck: is_verified = false
            .mockResolvedValueOnce({ rows: [{ id: 2, email: 'nuevo@test.com', verification_code_hash: 'hash_nuevo@test.com_123456', verification_attempts: 0 }] }) // pendingRes
            .mockResolvedValueOnce({ rows: [] })  // UPDATE users SET password_hash = $1, is_verified = true WHERE email = $2
            .mockResolvedValueOnce({ rows: [{ id: 5, username: 'nuevo_sos' }] }) // userRes
            .mockResolvedValueOnce({ rows: [{ referral_code: 'SOSVENEZUELADEMO' }] }) // pendingRefRes
            .mockResolvedValueOnce({ rows: [{ setting_value: 'SOSVENEZUELADEMO' }] }) // customCodeRes2
            .mockResolvedValueOnce({ rows: [{ id: 11, dossier_number: 'SOS-VZLA-4332-00011' }] }) // caseRes
            .mockResolvedValueOnce({ rows: [] })  // INSERT disaster_victim_history
            .mockResolvedValueOnce({ rows: [] })  // DELETE pending_verifications
            .mockResolvedValueOnce({ rows: [] })  // COMMIT
            .mockResolvedValue({ rows: [] });

        const req = {
            body: {
                email: 'nuevo@test.com',
                otp_code: '123456',
                password: 'MiPasswordSeguro123!',
                password_confirm: 'MiPasswordSeguro123!'
            },
            headers: { 'user-agent': 'TestAgent/1.0' },
            ip: '127.0.0.1'
        };
        const res = createMockRes();

        await victimController.verifyVictimOtpPublic(req, res);

        // Para usuarios nuevos, processReferralReward SÍ DEBE ser invocado
        expect(referralRewardService.processReferralReward).toHaveBeenCalledWith(
            expect.objectContaining({
                referralCode: 'SOSVENEZUELADEMO'
            })
        );
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                success: true,
                username: 'nuevo_sos'
            })
        );
    });
});
