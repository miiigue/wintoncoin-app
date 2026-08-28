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

    test('3.1 En registerVictimPublic (Fase 1), se guarda el paquete en pending_verifications (form_payload) y NO se crea usuario ni expediente prematuro', async () => {
        const referralRewardService = require('../src/services/referralRewardService');

        // Configurar mock de base de datos para simular un usuario NUEVO que envía el formulario SOS
        mockClient.query
            .mockResolvedValueOnce({ rows: [], rowCount: 0 })  // BEGIN
            .mockResolvedValueOnce({ rows: [], rowCount: 0 })  // Unicidad de Cédula: no existe expediente previo
            .mockResolvedValueOnce({ rows: [], rowCount: 0 })  // Búsqueda de usuario: no existe en users (es NUEVO)
            .mockResolvedValueOnce({ rows: [], rowCount: 0 })  // DELETE FROM pending_verifications
            .mockResolvedValueOnce({ rows: [{ setting_value: 'SOSVENEZUELADEMO' }], rowCount: 1 }) // SELECT app_settings
            .mockResolvedValueOnce({ rows: [], rowCount: 1 })  // INSERT INTO pending_verifications (form_payload JSONB)
            .mockResolvedValueOnce({ rows: [], rowCount: 0 }); // COMMIT

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

        // 1. Debe responder con éxito 200 y marcar is_new_user = true
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            success: true,
            is_new_user: true,
            email: 'ana.gomez@test.com'
        }));

        // 2. CRÍTICO: En la Fase 1 NO se debe insertar en users ni en disaster_victims_registry
        const userInsertCall = mockClient.query.mock.calls.find(
            call => typeof call[0] === 'string' && call[0].includes('INSERT INTO users')
        );
        expect(userInsertCall).toBeUndefined();

        const victimInsertCall = mockClient.query.mock.calls.find(
            call => typeof call[0] === 'string' && call[0].includes('INSERT INTO disaster_victims_registry')
        );
        expect(victimInsertCall).toBeUndefined();

        // 3. Verificar que pending_verifications recibió el paquete form_payload JSONB
        const pendingInsertCall = mockClient.query.mock.calls.find(
            call => typeof call[0] === 'string' && call[0].includes('INSERT INTO pending_verifications')
        );
        expect(pendingInsertCall).toBeDefined();

        // 4. CRÍTICO: En la Fase 1 NO se debe haber llamado a processReferralReward
        expect(referralRewardService.processReferralReward).not.toHaveBeenCalled();
    });

    test('3.2 Si la cédula ya tiene expediente activo confirmado, retorna 409 con already_active = true', async () => {
        mockClient.query
            .mockResolvedValueOnce({ rows: [] })  // BEGIN
            .mockResolvedValueOnce({
                rows: [{
                    id: 55,
                    dossier_number: 'SOS-VZLA-4332-00055'
                }],
                rowCount: 1
            }) // existingVictim check
            .mockResolvedValueOnce({ rows: [] }); // ROLLBACK

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

        expect(res.status).toHaveBeenCalledWith(409);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            success: false,
            already_active: true,
            dossier_number: 'SOS-VZLA-4332-00055'
        }));
    });

    test('3.3 Debe rechazar con mensaje amigable si el número de teléfono ya está registrado con otro email', async () => {
        mockClient.query
            .mockResolvedValueOnce({ rows: [] })  // BEGIN
            .mockResolvedValueOnce({ rows: [], rowCount: 0 })  // existingDossier check: no existe expediente previo
            .mockResolvedValueOnce({
                rows: [{
                    id: 88,
                    username: 'otro_usuario',
                    email: 'otro.usuario@test.com',
                    phone_number: '+584149991122'
                }],
                rowCount: 1
            }) // userCheck: el teléfono pertenece a otro.usuario@test.com, pero el req trae ana@test.com
            .mockResolvedValueOnce({ rows: [], rowCount: 0 }); // ROLLBACK

        const req = {
            body: {
                full_name: 'Ana Gómez',
                id_document: 'V-19888777',
                email: 'ana@test.com',
                phone_number: '+584149991122',
                state: 'Carabobo',
                municipality: 'Valencia',
                sector: 'El Trigal',
                address_details: 'Calle 3',
                description: 'Daños por sismo',
                data_consent_accepted: true,
                sworn_declaration_accepted: true
            }
        };
        const res = createMockRes();

        await victimController.registerVictimPublic(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            success: false,
            message: expect.stringContaining('registrado con otro correo electrónico')
        }));
    });

    test('3.4 Debe manejar errores PostgreSQL 23505 (violación de clave única) de forma amigable sin exponer SQL crudo', async () => {
        const pgError = new Error('duplicate key value violates unique constraint "pending_verifications_phone_number_key"');
        pgError.code = '23505';
        pgError.constraint = 'pending_verifications_phone_number_key';

        mockClient.query
            .mockResolvedValueOnce({ rows: [] })  // BEGIN
            .mockRejectedValueOnce(pgError);      // Error de unicidad durante la transacción

        const req = {
            body: {
                full_name: 'Luis Ramos',
                id_document: 'V-18777666',
                email: 'luis@test.com',
                phone_number: '+584128887766',
                state: 'Lara',
                municipality: 'Iribarren',
                sector: 'Barquisimeto',
                address_details: 'Carrera 19',
                description: 'Afectación de vivienda',
                data_consent_accepted: true,
                sworn_declaration_accepted: true
            }
        };
        const res = createMockRes();

        await victimController.registerVictimPublic(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            success: false,
            message: expect.stringContaining('número telefónico ya está registrado')
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
        mockClient.query
            .mockResolvedValueOnce({ rows: [] })  // BEGIN
            .mockResolvedValueOnce({ rows: [] })  // SELECT pending_verifications (no hay pending)
            .mockResolvedValueOnce({ rows: [] }); // ROLLBACK

        const req = {
            body: {
                email: 'existente@test.com',
                otp_code: '123456'
            }
        };
        const res = createMockRes();

        await victimController.verifyVictimOtpPublic(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            message: expect.stringContaining('solicitud pendiente')
        }));
    });

    test('7. Debe rechazar usuario nuevo si la contraseña tiene menos de 8 caracteres', async () => {
        mockClient.query
            .mockResolvedValueOnce({ rows: [] })  // BEGIN
            .mockResolvedValueOnce({ // SELECT pending_verifications
                rows: [{
                    id: 2,
                    email: 'nuevo@test.com',
                    verification_code_hash: 'hash_nuevo@test.com_123456',
                    verification_attempts: 0,
                    expires_at: new Date(Date.now() + 15 * 60 * 1000),
                    form_payload: { full_name: 'Nuevo Test', id_document: 'V-30111222' }
                }]
            })
            .mockResolvedValueOnce({ rows: [] })  // SELECT users (es usuario nuevo)
            .mockResolvedValueOnce({ rows: [] }); // ROLLBACK

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

    test('8. Para usuario existente, debe activar verificación y acuñar expediente con estatus pending_verification', async () => {
        mockClient.query
            .mockResolvedValueOnce({ rows: [] })  // BEGIN
            .mockResolvedValueOnce({ // SELECT pending_verifications
                rows: [{
                    id: 1,
                    email: 'existente@test.com',
                    verification_code_hash: 'hash_existente@test.com_654321',
                    verification_attempts: 0,
                    expires_at: new Date(Date.now() + 15 * 60 * 1000),
                    form_payload: {
                        full_name: 'Usuario Existente',
                        id_document: 'V-18999888',
                        affectation_level: 'total_loss',
                        state: 'Miranda',
                        municipality: 'Baruta',
                        sector: 'Las Minas',
                        address_details: 'Calle 1'
                    }
                }]
            })
            .mockResolvedValueOnce({ // SELECT users (usuario existente)
                rows: [{
                    id: 4,
                    username: 'usuario_existente',
                    password_hash: '$2b$10$hashvalido',
                    is_verified: true,
                    email: 'existente@test.com'
                }]
            })
            .mockResolvedValueOnce({ rows: [] })  // DELETE pending_verifications
            .mockResolvedValueOnce({ rows: [{ id: 10 }] }) // INSERT disaster_victims_registry RETURNING id
            .mockResolvedValueOnce({ rows: [] })  // UPDATE disaster_victims_registry SET dossier_number
            .mockResolvedValueOnce({ rows: [] })  // INSERT disaster_victim_history
            .mockResolvedValueOnce({ rows: [] }); // COMMIT

        const req = {
            body: {
                email: 'existente@test.com',
                otp_code: '654321'
            },
            headers: { 'user-agent': 'TestAgent/1.0' },
            ip: '127.0.0.1'
        };
        const res = createMockRes();

        await victimController.verifyVictimOtpPublic(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            success: true,
            dossier_number: expect.stringMatching(/^SOS-VZLA-/),
            token: expect.any(String)
        }));
    });

    test('9. Para usuario existente, NO debe invocar processReferralReward', async () => {
        const referralRewardService = require('../src/services/referralRewardService');

        mockClient.query
            .mockResolvedValueOnce({ rows: [] })  // BEGIN
            .mockResolvedValueOnce({ // SELECT pending_verifications
                rows: [{
                    id: 1,
                    email: 'existente@test.com',
                    verification_code_hash: 'hash_existente@test.com_123456',
                    verification_attempts: 0,
                    expires_at: new Date(Date.now() + 15 * 60 * 1000),
                    form_payload: { full_name: 'Existente', id_document: 'V-11222333' }
                }]
            })
            .mockResolvedValueOnce({ // SELECT users (usuario existente)
                rows: [{ id: 4, username: 'existente', is_verified: true, email: 'existente@test.com' }]
            })
            .mockResolvedValueOnce({ rows: [] })  // DELETE pending_verifications
            .mockResolvedValueOnce({ rows: [{ id: 10 }] }) // INSERT disaster_victims_registry RETURNING id
            .mockResolvedValueOnce({ rows: [] })  // UPDATE disaster_victims_registry
            .mockResolvedValueOnce({ rows: [] })  // INSERT disaster_victim_history
            .mockResolvedValueOnce({ rows: [] }); // COMMIT

        const req = {
            body: { email: 'existente@test.com', otp_code: '123456' },
            headers: { 'user-agent': 'TestAgent/1.0' },
            ip: '127.0.0.1'
        };
        const res = createMockRes();

        await victimController.verifyVictimOtpPublic(req, res);

        expect(referralRewardService.processReferralReward).not.toHaveBeenCalled();
    });

    test('10. Para usuario NUEVO (is_verified = false), DEBE crear usuario, invocar processReferralReward y retornar sesión JWT', async () => {
        const referralRewardService = require('../src/services/referralRewardService');

        mockClient.query
            .mockResolvedValueOnce({ rows: [] })  // BEGIN
            .mockResolvedValueOnce({ // SELECT pending_verifications
                rows: [{
                    id: 2,
                    email: 'nuevo@test.com',
                    verification_code_hash: 'hash_nuevo@test.com_123456',
                    verification_attempts: 0,
                    referral_code: 'SOSVENEZUELADEMO',
                    expires_at: new Date(Date.now() + 15 * 60 * 1000),
                    form_payload: {
                        full_name: 'Nuevo SOS',
                        id_document: 'V-28999000',
                        affectation_level: 'partial_damage',
                        state: 'Sucre',
                        municipality: 'Bermúdez',
                        sector: 'Playa Grande'
                    }
                }]
            })
            .mockResolvedValueOnce({ rows: [] })  // SELECT users (es usuario nuevo)
            .mockResolvedValueOnce({ rows: [] })  // colisión username
            .mockResolvedValueOnce({ rows: [] })  // unique referral code
            .mockResolvedValueOnce({ // INSERT INTO users
                rows: [{
                    id: 5,
                    username: 'nuevo_sos',
                    email: 'nuevo@test.com',
                    is_verified: true
                }]
            })
            .mockResolvedValueOnce({ rows: [] })  // DELETE pending_verifications
            .mockResolvedValueOnce({ rows: [{ id: 11 }] }) // INSERT disaster_victims_registry RETURNING id
            .mockResolvedValueOnce({ rows: [] })  // UPDATE disaster_victims_registry
            .mockResolvedValueOnce({ rows: [] })  // INSERT disaster_victim_history
            .mockResolvedValueOnce({ rows: [] }); // COMMIT

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

        expect(referralRewardService.processReferralReward).toHaveBeenCalledWith(
            expect.objectContaining({
                referralCode: 'SOSVENEZUELADEMO'
            })
        );
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                success: true,
                dossier_number: expect.stringMatching(/^SOS-VZLA-/),
                token: expect.any(String)
            })
        );
    });
});
