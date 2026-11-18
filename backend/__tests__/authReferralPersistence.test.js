'use strict';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-for-jest';

const mockClient = {
    query: jest.fn(),
    release: jest.fn()
};

const mockPool = {
    query: jest.fn(),
    connect: jest.fn().mockResolvedValue(mockClient)
};

jest.mock('../src/config/db', () => mockPool);
jest.mock('../src/config/databaseInit', () => ({
    generateUniqueReferralCode: jest.fn().mockResolvedValue('NEWUSER-CODE1')
}));
jest.mock('../src/services/emailService', () => ({
    generateOtp6: jest.fn().mockReturnValue('123456'),
    hashOtpForEmail: jest.fn().mockReturnValue('hashed-otp-hex'),
    sendOtpEmail: jest.fn().mockResolvedValue(true),
    sendTransactionEmail: jest.fn().mockResolvedValue(true),
    normalizeEmail: jest.fn((e) => String(e || '').trim().toLowerCase()),
    safeEqualHex: jest.fn().mockReturnValue(true)
}));
jest.mock('../src/services/auditService', () => ({
    logAuditEvent: jest.fn().mockResolvedValue(true)
}));
jest.mock('../src/services/notificationService', () => ({
    createNotification: jest.fn().mockResolvedValue(true)
}));
jest.mock('../src/services/legalService', () => ({
    getActiveLegalDocuments: jest.fn().mockResolvedValue([
        { type: 'terms_and_conditions', version: '1.0', content_hash: 'hash-terms' }
    ]),
    getUserLegalStatusByUserId: jest.fn(),
    validateAcceptedDocumentsPayload: jest.fn().mockReturnValue({
        isValid: true,
        acceptedDocuments: [{ type: 'terms_and_conditions', version: '1.0', content_hash: 'hash-terms' }]
    }),
    ensureAllActiveDocumentsAccepted: jest.fn().mockReturnValue({ allAccepted: true, missingDocs: [] })
}));
jest.mock('../src/services/referralRewardService', () => ({
    processReferralReward: jest.fn().mockResolvedValue({ success: true })
}));

const authController = require('../src/controllers/authController');
const referralRewardService = require('../src/services/referralRewardService');

function createMockRes() {
    const res = {
        statusCode: 200,
        body: null,
        cookies: {},
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(payload) {
            this.body = payload;
            return this;
        },
        cookie(name, value, opts) {
            this.cookies[name] = { value, opts };
            return this;
        }
    };
    return res;
}

describe('authController - Persistencia y Sanitización Zero-Trust de Referidos', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('registerRequest persiste referral_code válido normalizado en pending_verifications', async () => {
        mockPool.query.mockResolvedValueOnce({
            rows: [
                { setting_key: 'registration_country_restriction_enabled', setting_value: 'false' }
            ]
        });

        mockClient.query.mockImplementation(async (sql) => {
            if (sql.includes('FROM users WHERE username')) {
                return { rows: [] };
            }
            return { rows: [], rowCount: 1 };
        });

        const req = {
            body: {
                username: 'nuevo_usuario',
                email: 'nuevo@example.com',
                password: 'Password123!',
                phone: '+584141234567',
                date_of_birth: '1995-05-10',
                referral_code: '  sosvenezuela-01  ',
                acceptedLegalDocuments: [
                    { type: 'terms_and_conditions', version: '1.0', content_hash: 'hash-terms' }
                ]
            },
            headers: { 'x-forwarded-for': '127.0.0.1' },
            socket: { remoteAddress: '127.0.0.1' }
        };
        const res = createMockRes();

        await authController.registerRequest(req, res);

        expect(res.statusCode).toBe(200);
        const insertCall = mockClient.query.mock.calls.find(([sql]) =>
            typeof sql === 'string' && sql.includes('INSERT INTO pending_verifications')
        );
        expect(insertCall).toBeDefined();
        expect(insertCall[1][4]).toBe('SOSVENEZUELA-01');
    });

    test('registerRequest rechaza y anula payloads XSS en referral_code (guarda null)', async () => {
        mockPool.query.mockResolvedValueOnce({
            rows: [
                { setting_key: 'registration_country_restriction_enabled', setting_value: 'false' }
            ]
        });

        mockClient.query.mockImplementation(async (sql) => {
            if (sql.includes('FROM users WHERE username')) {
                return { rows: [] };
            }
            return { rows: [], rowCount: 1 };
        });

        const req = {
            body: {
                username: 'nuevo_xss',
                email: 'xss@example.com',
                password: 'Password123!',
                phone: '+584141234568',
                date_of_birth: '1995-05-10',
                referral_code: '<script>alert(1)</script>',
                acceptedLegalDocuments: [
                    { type: 'terms_and_conditions', version: '1.0', content_hash: 'hash-terms' }
                ]
            },
            headers: { 'x-forwarded-for': '127.0.0.1' },
            socket: { remoteAddress: '127.0.0.1' }
        };
        const res = createMockRes();

        await authController.registerRequest(req, res);

        expect(res.statusCode).toBe(200);
        const insertCall = mockClient.query.mock.calls.find(([sql]) =>
            typeof sql === 'string' && sql.includes('INSERT INTO pending_verifications')
        );
        expect(insertCall).toBeDefined();
        expect(insertCall[1][4]).toBeNull();
    });

    test('registerVerify recupera pendingUser.referral_code aunque el cliente lo omita al confirmar OTP', async () => {
        const futureExpiry = new Date(Date.now() + 10 * 60 * 1000);
        mockClient.query.mockImplementation(async (sql) => {
            if (sql.includes('SELECT * FROM pending_verifications WHERE email = $1')) {
                return {
                    rowCount: 1,
                    rows: [{
                        id: 99,
                        username: 'invitado_real',
                        email: 'invitado@example.com',
                        password_hash: 'hashed-pw',
                        phone_number: '+584141234569',
                        referral_code: 'PATROCINADOR_77',
                        verification_code_hash: 'hashed-otp-hex',
                        verification_attempts: 0,
                        expires_at: futureExpiry,
                        date_of_birth: '1994-01-01',
                        legal_acceptances_json: [
                            { type: 'terms_and_conditions', version: '1.0', content_hash: 'hash-terms' }
                        ]
                    }]
                };
            }
            if (sql.includes('INSERT INTO users')) {
                return {
                    rowCount: 1,
                    rows: [{ id: 500, username: 'invitado_real', email: 'invitado@example.com' }]
                };
            }
            return { rows: [], rowCount: 1 };
        });

        const req = {
            body: {
                email: 'invitado@example.com',
                verificationCode: '123456',
                referral_code: ''
            },
            headers: { 'user-agent': 'Jest' },
            socket: { remoteAddress: '127.0.0.1' }
        };
        const res = createMockRes();

        await authController.registerVerify(req, res);

        expect(res.statusCode).toBe(200);
        expect(referralRewardService.processReferralReward).toHaveBeenCalledWith(
            expect.objectContaining({
                referralCode: 'PATROCINADOR_77'
            })
        );
    });
});
