require('../config');
const jwt = require('jsonwebtoken');
const http = require('http');

// 1. Crear Token Maestro para un usuario de prueba ("user_auditor")
const jwtSecret = process.env.JWT_SECRET;
const testToken = jwt.sign(
    { userId: 1, username: 'user_auditor', role: 'user' },
    jwtSecret,
    { expiresIn: '1h' }
);

// 2. Levantar el Servidor
process.env.PORT = 4004;
const { startServer } = require('../server.js');

let server;

const makeRequest = (method, path) => {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 4004,
            path: path,
            method: method,
            headers: {
                'Authorization': 'Bearer ' + testToken,
                'Content-Type': 'application/json'
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => resolve({ statusCode: res.statusCode, body: data }));
        });
        req.on('error', (e) => reject(e));
        req.end();
    });
};

async function runTests() {
    try {
        console.log('[TEST] Iniciando servidor en puerto 4004...');
        server = await startServer(4004);
        await new Promise(r => setTimeout(r, 1500));

        console.log('\\n[TEST] Ejecutando ataque a las nuevas rutas modulares (userRoutes.js)...');
        
        // Probamos el endpoint de balance
        const resBalance = await makeRequest('GET', '/api/me/balance');
        console.log('\\n--- RESULTADO BALANCE (/api/me/balance) ---');
        console.log('HTTP STATUS: ' + resBalance.statusCode);
        console.log('RESPUESTA JSON: ' + resBalance.body.substring(0, 100) + '...');

        // Probamos el endpoint de historial
        const resHistory = await makeRequest('GET', '/api/me/history');
        console.log('\\n--- RESULTADO HISTORIAL (/api/me/history) ---');
        console.log('HTTP STATUS: ' + resHistory.statusCode);
        console.log('RESPUESTA JSON: ' + resHistory.body.substring(0, 100) + '...');

    } catch (err) {
        console.error('[TEST] Falla:', err);
    } finally {
        if (server) {
            server.close(() => process.exit(0));
        } else {
            process.exit(1);
        }
    }
}
runTests();
