/**
 * Test Standalone en Tiempo de Ejecución: Ficha de Usuario 360° (adminUserDossier.standalone.test.js)
 * ══════════════════════════════════════════════════════════════════════════════════════════════════
 * Valida la lógica de getUserDossier360, control de acceso, sanitización Zero-Secrets
 * y la auditoría SOC 2 ("Auditar al Auditor") usando assert nativo de Node.js.
 * ══════════════════════════════════════════════════════════════════════════════════════════════════
 */

'use strict';

const assert = require('assert');

// 1. Simulación del pool de base de datos
let mockQueryResponses = [];
let queryCallIndex = 0;
let loggedAuditEvents = [];

const mockPool = {
    query: async (sql, params) => {
        const resp = mockQueryResponses[queryCallIndex] || { rowCount: 0, rows: [] };
        queryCallIndex++;
        if (resp instanceof Error) throw resp;
        return resp;
    }
};

// Reemplazar pool en adminUserController inyectando mock
const proxyquire = (modulePath, stubs) => {
    // Sobrescribir require cache temporalmente para inyectar mocks
    const origDb = require.cache[require.resolve('../src/config/db')];
    const origAudit = require.cache[require.resolve('../src/services/auditService')];

    require.cache[require.resolve('../src/config/db')] = {
        exports: stubs['../../config/db'] || mockPool
    };

    require.cache[require.resolve('../src/services/auditService')] = {
        exports: stubs['../../services/auditService'] || {
            logAuditEvent: async (p, req, ev) => {
                loggedAuditEvents.push(ev);
                return true;
            }
        }
    };

    delete require.cache[require.resolve('../src/controllers/admin/adminUserController')];
    const controller = require('../src/controllers/admin/adminUserController');

    // Restaurar
    if (origDb) require.cache[require.resolve('../src/config/db')] = origDb;
    if (origAudit) require.cache[require.resolve('../src/services/auditService')] = origAudit;

    return controller;
};

const adminUserController = proxyquire('../src/controllers/admin/adminUserController', {
    '../../config/db': mockPool,
    '../../services/auditService': {
        logAuditEvent: async (p, req, ev) => {
            loggedAuditEvents.push(ev);
            return true;
        }
    }
});

console.log('--- INICIANDO PRUEBAS UNITARIAS DE getUserDossier360 (STANDALONE) ---');

async function runTests() {
    // ------------------------------------------------------------------------
    // PRUEBA 1: Usuario inexistente debe retornar 404
    // ------------------------------------------------------------------------
    queryCallIndex = 0;
    mockQueryResponses = [
        { rowCount: 0, rows: [] } // SELECT user -> not found
    ];
    loggedAuditEvents = [];

    let statusCalled = null;
    let jsonResult = null;

    const mockRes404 = {
        status: (code) => { statusCalled = code; return mockRes404; },
        json: (data) => { jsonResult = data; }
    };

    await adminUserController.getUserDossier360({ params: { userId: '99999' } }, mockRes404);

    assert.strictEqual(statusCalled, 404, 'Debe responder con status 404 cuando el usuario no existe');
    assert.strictEqual(jsonResult.message, 'Usuario no encontrado en la base de datos.', 'Mensaje correcto de usuario no encontrado');
    console.log('✅ PASÓ: Prueba 1 - Respuesta 404 para usuario inexistente.');

    // ------------------------------------------------------------------------
    // PRUEBA 2: Usuario existente debe retornar 200 con la estructura 360° completa
    // ------------------------------------------------------------------------
    queryCallIndex = 0;
    mockQueryResponses = [
        // 1. Base User
        {
            rowCount: 1,
            rows: [{
                id: 42,
                username: 'carolaydia_641',
                email: 'carolay@example.com',
                phone_number: '+584120001122',
                account_status: 'active',
                liquid_blue_balance: '150.5000',
                escrow_blue_balance: '10.0000',
                red_balance: '0.0000',
                average_rating: '4.8',
                ratings_count: 12,
                created_at: '2026-08-20T10:00:00Z',
                updated_at: '2026-08-29T15:30:00Z',
                referral_code: 'CAROL2026',
                referrer_id: 1,
                referrer_username: 'sponsor_user',
                web3_wallet_address: '0x19a28b030f895cba89736c0a0c4fec8e5454fecf',
                kyc_verified: true,
                is_minor: false,
                tutor_id: null,
                tutor_username: null,
                trust_score: 85,
                trust_score_level: 'Gold',
                sos_dossier: 'SOS-VZLA-2532-00008',
                vol_dossier: null
            }]
        },
        // 2. Booster Balance
        { rowCount: 1, rows: [{ booster_blue_balance: '200.0000' }] },
        // 3. Web3 Transactions
        { rowCount: 1, rows: [{ id: 1, type: 'payment_received', amount: '50.0000', tx_hash: '0xabc', created_at: '2026-08-25T12:00:00Z' }] },
        // 4. Booster Transactions
        { rowCount: 1, rows: [{ id: 1, type: 'referral_bonus', amount: '20.0000', created_at: '2026-08-26T12:00:00Z' }] },
        // 5. Publications Created
        { rowCount: 1, rows: [{ id: 10, title: 'Tarea de Diseño', blue_cost: '15.0000', status: 'active' }] },
        // 6. Tasks Accepted
        { rowCount: 1, rows: [{ id: 20, publication_title: 'Trabajo Realizado', status: 'completed' }] },
        // 7. Referrals
        { rowCount: 1, rows: [{ id: 1, referred_id: 100, referred_username: 'invitado_1', account_status: 'active', kyc_verified: true }] },
        // 8. Debts
        { rowCount: 0, rows: [] },
        // 9. SOS Victim
        { rowCount: 1, rows: [{ id: 5, dossier_number: 'SOS-VZLA-2532-00008', full_name: 'Carolay D', status: 'approved' }] },
        // 10. SOS Disbursements
        { rowCount: 0, rows: [] },
        // 11. Volunteer
        { rowCount: 0, rows: [] },
        // 12. Causes
        { rowCount: 0, rows: [] },
        // 13. Donations Sent
        { rowCount: 0, rows: [] },
        // 14. Audit Events
        { rowCount: 1, rows: [{ id: 1, event_type: 'user.login', actor_username: 'carolaydia_641', created_at: '2026-08-29T10:00:00Z' }] },
        // 15. Legal Acceptances
        { rowCount: 1, rows: [{ id: 1, document_type: 'terms_of_service', document_version: 'v1.0', accepted_at: '2026-08-20T10:05:00Z' }] }
    ];
    loggedAuditEvents = [];

    const mockReq = {
        params: { userId: '42' },
        user: { username: 'admin_inspector' },
        ip: '192.168.1.100'
    };

    const mockRes200 = {
        status: (code) => { statusCalled = code; return mockRes200; },
        json: (data) => { jsonResult = data; }
    };

    await adminUserController.getUserDossier360(mockReq, mockRes200);

    assert.strictEqual(statusCalled, 200, 'Debe responder con status 200');
    assert.strictEqual(jsonResult.success, true, 'Propiedad success debe ser true');
    assert.strictEqual(jsonResult.dossier.profile.username, 'carolaydia_641', 'Username debe coincidir');
    assert.strictEqual(jsonResult.dossier.profile.kyc_verified, true, 'KYC verificado debe ser true');
    assert.strictEqual(jsonResult.dossier.balances.liquid_blue_balance, 150.5, 'Balance liquid_blue_balance correcto');
    assert.strictEqual(jsonResult.dossier.balances.booster_blue_balance, 200, 'Balance booster_blue_balance correcto');
    assert.strictEqual(jsonResult.dossier.web3_transactions.length, 1, 'Debe contener 1 transacción Web3');
    assert.strictEqual(jsonResult.dossier.publications_created.length, 1, 'Debe contener 1 publicación creada');
    assert.strictEqual(jsonResult.dossier.tasks_accepted.length, 1, 'Debe contener 1 tarea trabajada');
    assert.strictEqual(jsonResult.dossier.referrals.length, 1, 'Debe contener 1 referido');
    assert.strictEqual(jsonResult.dossier.sos_case.dossier_number, 'SOS-VZLA-2532-00008', 'Expediente SOS cargado');

    console.log('✅ PASÓ: Prueba 2 - Estructura completa 360° consolidada.');

    // ------------------------------------------------------------------------
    // PRUEBA 3: Cumplimiento Bancario SOC 2 ("Auditar al Auditor")
    // ------------------------------------------------------------------------
    assert.strictEqual(loggedAuditEvents.length, 1, 'Debe registrar exactamente 1 evento de auditoría');
    const auditEvent = loggedAuditEvents[0];
    assert.strictEqual(auditEvent.eventType, 'admin.user.view_dossier', 'Tipo de evento debe ser admin.user.view_dossier');
    assert.strictEqual(auditEvent.actorUsername, 'admin_inspector', 'El actor debe ser el admin que realizó la consulta');
    assert.strictEqual(auditEvent.targetUsername, 'carolaydia_641', 'El usuario objetivo debe ser el inspeccionado');
    assert.strictEqual(auditEvent.category, 'compliance', 'Categoría de cumplimiento SOC 2');
    console.log('✅ PASÓ: Prueba 3 - Cumplimiento SOC 2: Auditoría registrada ("Auditar al Auditor").');

    // ------------------------------------------------------------------------
    // PRUEBA 4: Principio Zero Hardcoded Secrets (Nunca exponer hashes)
    // ------------------------------------------------------------------------
    const serializedOutput = JSON.stringify(jsonResult);
    assert.strictEqual(serializedOutput.includes('password_hash'), false, 'El JSON no debe contener password_hash');
    assert.strictEqual(serializedOutput.includes('token_hash'), false, 'El JSON no debe contener token_hash');
    console.log('✅ PASÓ: Prueba 4 - Zero Hardcoded Secrets: No se filtran credenciales ni hashes.');

    // ------------------------------------------------------------------------
    // PRUEBA 5: Validación estricta de entrada (Input Validation & DoS Protection)
    // ------------------------------------------------------------------------
    let status400 = null;
    let json400 = null;
    const mockRes400 = {
        status: (code) => { status400 = code; return mockRes400; },
        json: (data) => { json400 = data; }
    };
    await adminUserController.getUserDossier360({ params: { userId: '   ' } }, mockRes400);
    assert.strictEqual(status400, 400, 'Debe rechazar userId vacío o en blanco con 400');

    status400 = null;
    await adminUserController.getUserDossier360({ params: { userId: 'A'.repeat(150) } }, mockRes400);
    assert.strictEqual(status400, 400, 'Debe rechazar userId excesivamente largo (>100 caracteres) con 400');
    console.log('✅ PASÓ: Prueba 5 - Validación de entrada estricta (rechazo de strings vacíos y >100 chars).');

    // ------------------------------------------------------------------------
    // PRUEBA 6: Purga defensiva de metadatos sensibles en bitácora de auditoría
    // ------------------------------------------------------------------------
    queryCallIndex = 0;
    mockQueryResponses = [
        { rowCount: 1, rows: [{ id: 99, username: 'audit_test_user', account_status: 'active' }] },
        { rows: [] }, { rows: [] }, { rows: [] }, { rows: [] }, { rows: [] }, { rows: [] },
        { rows: [] }, { rows: [] }, { rows: [] }, { rows: [] }, { rows: [] }, { rows: [] },
        // Audit log con metadata que contiene campos sensibles
        { 
            rowCount: 1, 
            rows: [{ 
                id: 1, 
                event_type: 'user.password_reset', 
                actor_username: 'system',
                metadata: {
                    ip: '127.0.0.1',
                    temp_token: 'secret_leak_attempt_123',
                    old_password_hash: '$2b$10$dangerous_hash',
                    safe_action: 'requested_reset'
                }
            }] 
        },
        { rows: [] } // legal
    ];
    let sanitizedJson = null;
    const mockResSanitized = {
        status: () => mockResSanitized,
        json: (d) => { sanitizedJson = d; }
    };
    await adminUserController.getUserDossier360({ params: { userId: '99' }, user: { username: 'admin' } }, mockResSanitized);
    const auditMeta = sanitizedJson.dossier.audit_events[0].metadata;
    assert.strictEqual(auditMeta.temp_token, undefined, 'temp_token debe ser purgado de metadata');
    assert.strictEqual(auditMeta.old_password_hash, undefined, 'old_password_hash debe ser purgado de metadata');
    assert.strictEqual(auditMeta.safe_action, 'requested_reset', 'campos seguros se preservan en metadata');
    console.log('✅ PASÓ: Prueba 6 - Purga de metadatos sensibles de auditoría completada con éxito.');

    console.log('\n🎉 TODAS LAS 6 PRUEBAS DE SEGURIDAD BANCARIA Y FINTECH PASARON SATISFACTORIAMENTE (100% ÉXITO)');
}

runTests().catch(err => {
    console.error('❌ Error en pruebas:', err);
    process.exit(1);
});
