require('../config');
const { seoMiddlewareCauses, seoMiddlewareReferrals } = require('../src/middleware/seoMiddleware');
const pool = require('../src/config/db');

async function runTests() {
    console.log('🧪 Iniciando pruebas unitarias de seoMiddleware...\n');
    let passed = 0;
    let failed = 0;

    // Helper para aserciones sencillas
    const assert = (condition, message) => {
        if (condition) {
            console.log(`✅ ${message}`);
            passed++;
        } else {
            console.error(`❌ ${message}`);
            failed++;
        }
    };

    // Mock de Express Response
    const createMockRes = () => {
        const res = {
            headers: {},
            statusCode: 200,
            body: '',
            setHeader: (name, value) => {
                res.headers[name] = value;
                return res;
            },
            send: (data) => {
                res.body = data;
                return res;
            }
        };
        return res;
    };

    // Test 1: seoMiddlewareCauses con ID numérico inválido
    try {
        const req = {
            query: { id: 'invalid_id' },
            get: () => 'localhost:3000',
            protocol: 'http'
        };
        const res = createMockRes();
        let nextCalled = false;
        const next = () => { nextCalled = true; };

        await seoMiddlewareCauses(req, res, next);
        assert(nextCalled === true, 'seoMiddlewareCauses se degrada elegantemente llamando a next() si el ID no es numérico.');
    } catch (e) {
        assert(false, `Error en Test 1: ${e.message}`);
    }

    // Test 2: seoMiddlewareCauses con ID de causa inexistente en BD
    try {
        const req = {
            query: { id: '999999' },
            get: () => 'localhost:3000',
            protocol: 'http'
        };
        const res = createMockRes();
        let nextCalled = false;
        const next = () => { nextCalled = true; };

        await seoMiddlewareCauses(req, res, next);
        assert(nextCalled === true, 'seoMiddlewareCauses se degrada elegantemente llamando a next() si la causa no existe.');
    } catch (e) {
        assert(false, `Error en Test 2: ${e.message}`);
    }

    // Test 3: seoMiddlewareReferrals inyecta Open Graph y fallback al logo
    try {
        const req = {
            query: {},
            get: () => 'localhost:3000',
            protocol: 'http'
        };
        const res = createMockRes();
        let nextCalled = false;
        const next = () => { nextCalled = true; };

        await seoMiddlewareReferrals(req, res, next);
        assert(res.body.includes('<title>Regístrate en WintonCoin</title>'), 'seoMiddlewareReferrals inyecta el título de registro.');
        assert(res.body.includes('og:image'), 'seoMiddlewareReferrals inyecta la etiqueta og:image.');
        assert(res.body.includes('http://localhost:3000/assets/logo-high-res.png'), 'seoMiddlewareReferrals hace fallback al logo absoluto oficial.');
    } catch (e) {
        assert(false, `Error en Test 3: ${e.message}`);
    }

    // Test 4: seoMiddlewareReferrals con código de referido adjunto
    try {
        const req = {
            query: { ref: 'SOSVENEZUELA' },
            get: () => 'localhost:3000',
            protocol: 'http'
        };
        const res = createMockRes();
        const next = () => {};

        await seoMiddlewareReferrals(req, res, next);
        assert(res.body.includes('SOSVENEZUELA'), 'seoMiddlewareReferrals incluye el código de referido en la descripción og:description.');
    } catch (e) {
        assert(false, `Error en Test 4: ${e.message}`);
    }

    console.log(`\n📊 Resumen: ${passed} pruebas exitosas, ${failed} fallidas.`);
    
    // Cerrar la conexión de la BD al finalizar
    await pool.end();

    if (failed > 0) {
        process.exit(1);
    } else {
        process.exit(0);
    }
}

runTests();
