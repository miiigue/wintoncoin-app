const request = require('supertest');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = 'test-secret-key-12345';
process.env.ADMIN_SECRET_KEY = 'admin-secret-key-12345';
process.env.PLATFORM_USERNAME = 'Plataforma WintonCoin';

// Apagamos los CronJobs que colapsan Jest
jest.mock('node-cron', () => ({
    schedule: jest.fn()
}));

// Prevenir ejecución de migraciones en la prueba unitaria (evita process.exit(1))
jest.mock('../scripts/migrationRunner', () => ({
    runPendingMigrations: jest.fn().mockResolvedValue(true)
}));

// Prevenir creación de tablas e inicializadores demorados
jest.mock('../src/config/databaseInit', () => ({
    initializeDatabase: jest.fn().mockResolvedValue(true),
    generateUniqueReferralCode: jest.fn().mockReturnValue('TEST_REF')
}));

// Mockear el pool
jest.mock('pg', () => {
    const mClient = {
        query: jest.fn().mockResolvedValue({ rowCount: 0, rows: [] }),
        release: jest.fn()
    };
    const mPool = {
        query: jest.fn().mockResolvedValue({ rowCount: 0, rows: [] }),
        connect: jest.fn().mockResolvedValue(mClient),
        release: jest.fn(),
        on: jest.fn()
    };
    return { Pool: jest.fn(() => mPool) };
});

const { app, startServer } = require('../server');

// Interceptar el middleware JWT directo en runtime si es posible, o asegurarnos de devolver rows válidos en las consultas middleware.
const { Pool } = require('pg');

describe('Admin Form Fields Processor Tests', () => {
    let adminToken;
    let mockPool;

    beforeAll(async () => {
        mockPool = new Pool();

        // Esperemos a que el backend cargue las rutas
        await startServer();

        adminToken = jwt.sign(
            { id: 1, role: 'admin', username: 'admin' },
            process.env.ADMIN_SECRET_KEY,
            { expiresIn: '1h' }
        );
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('1. POST /api/admin/platform/create-publication - Debe aceptar e insertar formFields (legacy strings → objetos tipados)', async () => {
        // Configuramos la respuesta simulada de la BD
        // 1. Verificación del usuario plataforma
        mockPool.query.mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 100 }] });

        // 2. Consulta de configuración máxima de imágenes
        mockPool.query.mockResolvedValueOnce({ rowCount: 1, rows: [{ setting_value: '3' }] });

        // 3. Inserción de la publicación (RETURNING id)
        mockPool.query.mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 999 }] });

        const payload = {
            title: "Test de Sub-Formulario",
            description: "Crea una tarea con formulario",
            cost: "3.5",
            availableSlots: "10",
            isSellPost: false,
            autoApprove: true,
            isBoosterTask: false,
            allowRepeatParticipation: true,
            maxRepeatPerUser: 3,
            repeatCooldownMinutes: 15,
            formFields: {
                "2": ["Link del Post", "Usuario Creador"]  // Formato legacy: strings simples
            }
        };

        const res = await request(app)
            .post('/api/admin/platform/create-publication')
            .set('Cookie', [`admin_token=${adminToken}`]) // Inyectar token JWT seguro como admin_token
            .send(payload);

        // Verificar código de estado y mensaje esperado
        expect(res.statusCode).toEqual(201);
        expect(res.body.message).toMatch(/Publicación de la plataforma creada/);

        // EXTRAER LA CONSULTA REALIZADA A LA BASE DE DATOS
        const insertQueryCall = mockPool.query.mock.calls[2]; // La tercera llamada debe ser el INSERT

        // Verificar que formFields se convirtió de strings a objetos {label, type}
        expect(insertQueryCall).toBeDefined();
        const passedFormFields = insertQueryCall[1][13];

        // Verificamos que el formato legacy se convirtió correctamente a objetos tipados
        expect(passedFormFields).toBeDefined();
        expect(passedFormFields).toHaveProperty("2");
        // Formato nuevo: array de objetos con label y type
        expect(passedFormFields["2"]).toEqual([
            { label: "Link del Post", type: "text" },
            { label: "Usuario Creador", type: "text" }
        ]);
    });

    it('2. POST /api/admin/platform/create-publication - Debe aceptar formFields con tipos mixtos (text/textarea)', async () => {
        // 1. Verificación del usuario plataforma
        mockPool.query.mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 100 }] });
        // 2. Consulta de configuración máxima de imágenes
        mockPool.query.mockResolvedValueOnce({ rowCount: 1, rows: [{ setting_value: '3' }] });
        // 3. Inserción de la publicación (RETURNING id)
        mockPool.query.mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 1001 }] });

        const payload = {
            title: "Test QA con tipos mixtos",
            description: "Tarea de QA testing",
            cost: "5.0",
            availableSlots: "5",
            isSellPost: false,
            autoApprove: true,
            isBoosterTask: false,
            allowRepeatParticipation: false,
            formFields: {
                "2": [
                    { label: "URL del bug", type: "text" },
                    { label: "Pasos de reproducción", type: "textarea" },
                    { label: "Resultado esperado", type: "textarea" }
                ]
            }
        };

        const res = await request(app)
            .post('/api/admin/platform/create-publication')
            .set('Cookie', [`admin_token=${adminToken}`])
            .send(payload);

        expect(res.statusCode).toEqual(201);

        const insertQueryCall = mockPool.query.mock.calls[2];
        const passedFormFields = insertQueryCall[1][13];

        expect(passedFormFields).toBeDefined();
        expect(passedFormFields["2"]).toEqual([
            { label: "URL del bug", type: "text" },
            { label: "Pasos de reproducción", type: "textarea" },
            { label: "Resultado esperado", type: "textarea" }
        ]);
    });

    it('3. POST /api/admin/platform/create-publication - Debe rechazar tipos no autorizados (seguridad)', async () => {
        // 1. Verificación del usuario plataforma
        mockPool.query.mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 100 }] });
        // 2. Consulta de configuración máxima de imágenes
        mockPool.query.mockResolvedValueOnce({ rowCount: 1, rows: [{ setting_value: '3' }] });
        // 3. Inserción de la publicación (RETURNING id)
        mockPool.query.mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 1002 }] });

        const payload = {
            title: "Test de seguridad de tipos",
            description: "Tipos no autorizados",
            cost: "1.0",
            availableSlots: "1",
            isSellPost: false,
            autoApprove: false,
            isBoosterTask: false,
            allowRepeatParticipation: false,
            formFields: {
                "2": [
                    { label: "Campo válido", type: "text" },
                    { label: "Campo malicioso", type: "script" },       // Tipo inválido → debe caer a 'text'
                    { label: "Otro malicioso", type: "<img src=x>" }     // Tipo inválido → debe caer a 'text'
                ]
            }
        };

        const res = await request(app)
            .post('/api/admin/platform/create-publication')
            .set('Cookie', [`admin_token=${adminToken}`])
            .send(payload);

        expect(res.statusCode).toEqual(201);

        const insertQueryCall = mockPool.query.mock.calls[2];
        const passedFormFields = insertQueryCall[1][13];

        // Todos los tipos inválidos deben caer a 'text' (whitelist)
        expect(passedFormFields["2"]).toEqual([
            { label: "Campo válido", type: "text" },
            { label: "Campo malicioso", type: "text" },
            { label: "Otro malicioso", type: "text" }
        ]);
    });
});
