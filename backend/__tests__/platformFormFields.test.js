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

        // Deshabilitar la apertura nativa de puerto simulando éxito
        app.listen = jest.fn();

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

    it('1. POST /api/admin/platform/create-publication - Debe aceptar e insertar formFields correctamente', async () => {
        // Configuramos la respuesta simulada de la BD
        // 1. Verificación del usuario plataforma
        mockPool.query.mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 100 }] });

        // 2. Inserción de la publicación (RETURNING id)
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
                "2": ["Link del Post", "Usuario Creador"]
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
        const insertQueryCall = mockPool.query.mock.calls[1]; // La segunda llamada debe ser el INSERT

        // Verificar que formFields (nuestro interceptado [12] arreglo para inserts de platforma)
        // se está pasando correctamente al pool como el argumento JSON esperado
        expect(insertQueryCall).toBeDefined();

        // El argumento 1 es el query string, el 2 es el array de valores.
        // FormFields se inserta en el parámetro número 13 según el código del backend
        const passedFormFields = insertQueryCall[1][12];

        // Verificamos matemáticamente que el JSON no esté mutilado
        expect(passedFormFields).toBeDefined();
        expect(passedFormFields).toHaveProperty("2");
        expect(passedFormFields["2"]).toContain("Link del Post");
        expect(passedFormFields["2"]).toContain("Usuario Creador");
    });
});
