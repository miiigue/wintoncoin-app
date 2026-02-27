const request = require('supertest');
const { app, pool } = require('../server'); // Asegurarnos de exportar app desde server.js para Testing
const publicationRoutes = require('../src/routes/publicationRoutes');

// Montar las rutas en el entorno de pruebas usando mocks para middlewares
const mockRequireAcceptedLegal = () => (req, res, next) => next();
const mockVerifyAdminToken = (req, res, next) => next();
const mockLogAuditEvent = jest.fn().mockResolvedValue(true);

app.use('/', publicationRoutes(pool, mockRequireAcceptedLegal, mockVerifyAdminToken, mockLogAuditEvent));
// Mocks para evitar enviar emails reales o depender de la configuración externa en los tests unitarios
jest.mock('../src/services/emailService', () => ({
    sendTransactionEmail: jest.fn().mockResolvedValue(true),
    sendAnnouncementEmail: jest.fn().mockResolvedValue(true),
    processPendingBroadcasts: jest.fn().mockResolvedValue(true),
    normalizeEmail: jest.fn().mockImplementation(email => email.toLowerCase())
}));

jest.mock('../src/services/auditService', () => ({
    logAuditEvent: jest.fn().mockResolvedValue(true),
    startAuditCleanupJob: jest.fn()
}));

jest.mock('node-cron', () => ({
    schedule: jest.fn()
}));

describe('Publication Controllers', () => {

    it('1. GET /api/public-settings: Debe devolver las configuraciones públicas (Verificación Básica)', async () => {
        const res = await request(app).get('/api/public-settings');
        expect(res.statusCode).toEqual(200);
        expect(typeof res.body).toBe('object');
        // Al menos debe venir 'public_profiles_enabled'
        expect(res.body).toHaveProperty('public_profiles_enabled');
    });

    it('2. POST /publish: Debe rechazar la creación si faltan campos obligatorios', async () => {
        const res = await request(app)
            .post('/publish')
            .send({ title: "Incompleta" }); // Faltan data crucial intencionalmente

        expect(res.statusCode).toEqual(400);
        expect(res.body.message).toMatch(/Faltan datos requeridos/);
    });

    it('3. GET /api/publications/:id: Debe manejar la búsqueda de una publicación inexistente sin que el servidor muera', async () => {
        const res = await request(app).get('/api/publications/999999999?user=testuser');
        // Esperamos un error manejado (ej. 404 o un json con mensaje en 500) pero nunca que la API colapse o se cuelgue.
        expect([404, 500]).toContain(res.statusCode);
        expect(typeof res.body).toBe('object');
    });

});
