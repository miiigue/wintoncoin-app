'use strict';

/**
 * ============================================================================
 * [WINTONCOIN] - PRUEBA DETERMINISTA UI: DemoInventoryPanel (CODEX-209)
 * ============================================================================
 * Verifica de forma determinista (sin red ni secretos):
 * 1. Higiene de código: cero palabra prohibida, cero llamadas a localStorage /
 *    sessionStorage, cero inputs de URL/host editables, e integración en AdminWeb3Panel.
 * 2. Estados de UI renderizados con React SSR (`renderToStaticMarkup`):
 *    - `idle` (botón habilitado, aviso de solo lectura)
 *    - `loading` (indicador de progreso + botón deshabilitado contra doble clic)
 *    - `error` para HTTP 401, 403, 409, 500 y timeout (`AbortError`) + botón "Reintentar"
 *    - `incomplete` para `completeness.sqlComplete === false` y `completeness.truncated === true`
 *      (alerta explícita de INCOMPLETO, jamás marcado como apto)
 *    - `success` (resumen con `capturedAt`, `demoIdentity`, migraciones 128..131,
 *      conteos SQL y aviso de solo lectura / paridad 1:1)
 * 3. Acción explícita de detalle (`?detail=true`) con `credentials: 'include'` y
 *    `cache: 'no-store'`, más botones "Copiar JSON" y "Descargar JSON".
 * 4. Cero escrituras ni lecturas en `localStorage` / `sessionStorage`.
 * ============================================================================
 */

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const Module = require('node:module');
const esbuild = require('esbuild');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

const frontendRoot = path.resolve(__dirname, '..');
const componentPath = path.join(frontendRoot, 'src/components/admin/DemoInventoryPanel.jsx');
const adminPagePath = path.join(frontendRoot, 'src/pages/AdminWeb3Panel.jsx');

async function main() {
  // 1. Verificaciones estáticas de higiene e integración
  const componentSource = fs.readFileSync(componentPath, 'utf8');
  const adminPageSource = fs.readFileSync(adminPagePath, 'utf8');

  assert.equal(
    /deuda/i.test(componentSource),
    false,
    'DemoInventoryPanel.jsx no debe contener la palabra prohibida; usar "compromiso RED".'
  );
  assert.equal(
    /\b(localStorage|sessionStorage)\s*\./.test(componentSource),
    false,
    'DemoInventoryPanel.jsx no debe invocar métodos de localStorage ni sessionStorage.'
  );
  assert.equal(
    /<input\b/i.test(componentSource),
    false,
    'DemoInventoryPanel.jsx no debe exponer inputs editables de URL, host o SQL.'
  );
  assert(
    adminPageSource.includes("import DemoInventoryPanel from '../components/admin/DemoInventoryPanel.jsx';"),
    'AdminWeb3Panel.jsx debe importar DemoInventoryPanel.'
  );
  assert(
    adminPageSource.includes('<DemoInventoryPanel />'),
    'AdminWeb3Panel.jsx debe renderizar <DemoInventoryPanel />.'
  );
  assert(
    /\['demo\.wintoncoin\.com',\s*'www\.demo\.wintoncoin\.com'\]\.includes\(window\.location\.hostname\)\s*&&\s*\(\s*<DemoInventoryPanel\s*\/>\s*\)/.test(adminPageSource),
    'AdminWeb3Panel.jsx debe condicionar <DemoInventoryPanel /> al entorno Demo.'
  );

  // 2. Compilar el componente real con esbuild (mismo patrón que check-wallet-render.cjs)
  const build = await esbuild.build({
    entryPoints: [componentPath],
    bundle: true,
    write: false,
    platform: 'node',
    format: 'cjs',
    jsx: 'transform',
    plugins: [
      {
        name: 'demo-inventory-fixtures',
        setup(b) {
          b.onResolve({ filter: /^react$/ }, () => ({ path: 'react', external: true }));
          b.onResolve({ filter: /modules\/config\.js$/ }, (args) => ({
            path: args.path,
            namespace: 'fixture'
          }));
          b.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({
            contents: 'export const getApiUrl = () => "https://demo-api.example.test";'
          }));
        }
      }
    ]
  });

  const compiled = new Module(path.join(frontendRoot, 'demo-inventory-fixture.cjs'), module);
  compiled.filename = path.join(frontendRoot, 'demo-inventory-fixture.cjs');
  compiled.paths = Module._nodeModulePaths(frontendRoot);
  compiled._compile(build.outputFiles[0].text, compiled.filename);

  const DemoInventoryPanel = compiled.exports.default;
  const { fetchDemoInventory } = compiled.exports;

  // 3. Trampas estrictas en localStorage y sessionStorage para garantizar cero persistencia
  let storageTouches = 0;
  const storageTrap = new Proxy(
    {},
    {
      get(_target, prop) {
        storageTouches += 1;
        throw new Error(`Acceso prohibido a Web Storage: ${String(prop)}`);
      }
    }
  );
  const prevLocalStorage = global.localStorage;
  const prevSessionStorage = global.sessionStorage;
  global.localStorage = storageTrap;
  global.sessionStorage = storageTrap;

  try {
    // Escenario A: Estado idle
    const idleHtml = renderToStaticMarkup(React.createElement(DemoInventoryPanel));
    assert(idleHtml.includes('Generar inventario Demo'), 'Debe mostrar el botón "Generar inventario Demo".');
    const idleBtn = idleHtml.match(/<button[^>]*>Generar inventario Demo<\/button>/)?.[0];
    assert(idleBtn && !idleBtn.includes('disabled'), 'El botón principal debe estar habilitado en idle.');
    assert(idleHtml.includes('No activa contratos'), 'Debe mostrar el aviso de solo lectura.');
    assert(idleHtml.includes('compromiso RED'), 'Debe usar la terminología canónica "compromiso RED".');
    console.log('PASS: estado idle');

    // Escenario B: Estado loading (botón deshabilitado para evitar doble clic)
    const loadingHtml = renderToStaticMarkup(
      React.createElement(DemoInventoryPanel, {
        initialState: { status: 'loading', loadingMode: 'summary' }
      })
    );
    assert(loadingHtml.includes('aria-busy="true"'), 'La sección debe marcar aria-busy="true" durante loading.');
    assert(loadingHtml.includes('role="status"'), 'Debe mostrar indicador de progreso accesible.');
    const loadingBtn = loadingHtml.match(/<button[^>]*>Generando inventario Demo…<\/button>/)?.[0];
    assert(loadingBtn && loadingBtn.includes('disabled'), 'El botón debe estar deshabilitado en loading.');
    console.log('PASS: estado loading');

    // Escenario C: Estados de error HTTP (401, 403, 409, 500) y timeout
    for (const errCase of [
      { status: 401, match: /no está autorizada/i, relogin: true },
      { status: 403, match: /no está autorizada/i, relogin: true },
      { status: 409, match: /conflicto|en curso/i, relogin: false },
      { status: 500, match: /HTTP 500/i, relogin: false },
      { status: 'timeout', match: /tiempo de espera/i, relogin: false }
    ]) {
      let capturedRequest = null;
      const result = await fetchDemoInventory({
        apiUrl: 'https://demo-api.example.test',
        includeDetail: false,
        fetchImpl: async (url, opts) => {
          capturedRequest = { url, opts };
          if (errCase.status === 'timeout') {
            throw Object.assign(new Error('Aborted'), { name: 'AbortError' });
          }
          return {
            status: errCase.status,
            ok: false,
            json: async () => ({ success: false })
          };
        }
      });

      assert.equal(capturedRequest.url, 'https://demo-api.example.test/api/admin/web3/demo-inventory');
      assert.equal(capturedRequest.opts.credentials, 'include');
      assert.equal(capturedRequest.opts.cache, 'no-store');
      assert.equal(result.status, 'error');
      assert.match(result.error.message, errCase.match);
      assert.equal(result.error.requiresRelogin, errCase.relogin);

      const errHtml = renderToStaticMarkup(
        React.createElement(DemoInventoryPanel, {
          initialState: { status: 'error', error: result.error }
        })
      );
      assert(errHtml.includes('role="alert"'), `Error ${errCase.status} debe usar role="alert".`);
      assert(errHtml.includes('Reintentar'), `Error ${errCase.status} debe ofrecer botón "Reintentar".`);
      if (errCase.relogin) {
        assert(errHtml.includes('/admin.html'), `Error ${errCase.status} debe enlazar a /admin.html.`);
      }
      console.log(`PASS: estado error (${errCase.status})`);
    }

    // Escenario D: Estados incompletos (sqlComplete: false y truncated: true)
    for (const incompleteCase of [
      { name: 'sqlComplete=false', completeness: { sqlComplete: false, truncated: false } },
      { name: 'truncated=true', completeness: { sqlComplete: true, truncated: true } }
    ]) {
      const payload = {
        success: true,
        capturedAt: '2026-11-25T17:30:00.000Z',
        demoIdentity: {
          environmentId: 'demo',
          epoch: 'V6_DEMO',
          chainId: '11155420',
          databaseName: 'wintoncoin_demo_db'
        },
        completeness: incompleteCase.completeness,
        errors: [{ code: 'SQL_ROW_LIMIT', message: 'Snapshot excedió límite de filas permitido.' }]
      };

      const result = await fetchDemoInventory({
        apiUrl: 'https://demo-api.example.test',
        includeDetail: false,
        fetchImpl: async () => ({
          status: 200,
          ok: true,
          json: async () => payload
        })
      });

      assert.equal(result.status, 'incomplete', `${incompleteCase.name} debe clasificarse como incomplete.`);
      const incompleteHtml = renderToStaticMarkup(
        React.createElement(DemoInventoryPanel, {
          initialState: {
            status: result.status,
            data: result.data,
            completenessFlags: result.completenessFlags
          }
        })
      );
      assert(incompleteHtml.includes('role="alert"'), 'Estado incomplete debe renderizar role="alert".');
      assert(
        incompleteHtml.includes('Inventario INCOMPLETO — No apto para conciliación ni corte'),
        'Estado incomplete debe advertir explícitamente que no es apto.'
      );
      assert(
        !incompleteHtml.includes('Inventario SQL Demo capturado en modo solo lectura'),
        'Estado incomplete jamás debe mostrar el banner de éxito.'
      );
      assert(incompleteHtml.includes('Reintentar'), 'Estado incomplete debe incluir botón Reintentar.');
      console.log(`PASS: estado incomplete (${incompleteCase.name})`);
    }

    // Escenario E: Estado success (resumen completo con forma exacta de adminDemoInventoryController.js)
    const summaryPayload = {
      capturedAt: '2026-11-25T17:35:00.000Z',
      demoIdentity: {
        chainId: '11155420',
        epoch: 'V6_DEMO',
        databaseNameObserved: 'wintoncoin_demo_db'
      },
      exporterVersion: 'v6-demo-inventory/1.0',
      mode: 'summary',
      completeness: {
        sqlComplete: true,
        truncated: false,
        errorsCount: 0
      },
      schema: {
        missingRequiredTables: [],
        optionalMigrations: {
          '128_credit_penalty_episode': { present: true },
          '129_credit_notification_outbox': { present: true },
          '130_credit_referral_episode_awards': { present: false },
          '131_publication_base_precision': { present: true }
        }
      },
      summaryCounts: {
        users: 5,
        publicationsActive: 3,
        publicationAcceptancesPending: 2,
        publicationAcceptancesByStatus: { pending: '2', completed: '4' },
        escrowHoldsActive: 1,
        moraEpisodes: 1,
        creditPolicyIssuesUnresolved: 2,
        deadLetterCount: 1,
        creditPolicyIssuesByStatus: { pending: '1', dead_letter: '1' },
        outboxPending: 1,
        outboxByStatus: { pending: '1' },
        referralAwardsActive: 1,
        referralAwardsByBaseline: { baseline: '0', active: '1' },
        chainOpsActive: 1,
        countsByState: { pending: '1' }
      },
      atomicityNotice:
        'SQL (REPEATABLE READ READ ONLY) y blockchain (bloque finalized) NO son atómicos entre sí.',
      errors: []
    };

    const summaryResult = await fetchDemoInventory({
      apiUrl: 'https://demo-api.example.test',
      includeDetail: false,
      fetchImpl: async () => ({
        status: 200,
        ok: true,
        json: async () => summaryPayload
      })
    });

    assert.equal(summaryResult.status, 'success');
    const summaryHtml = renderToStaticMarkup(
      React.createElement(DemoInventoryPanel, {
        initialState: {
          status: summaryResult.status,
          data: summaryResult.data,
          completenessFlags: summaryResult.completenessFlags,
          detailLoaded: false
        }
      })
    );
    assert(summaryHtml.includes('2026-11-25T17:35:00.000Z'), 'Debe mostrar capturedAt.');
    assert(summaryHtml.includes('11155420'), 'Debe mostrar chainId Demo.');
    assert(summaryHtml.includes('wintoncoin_demo_db'), 'Debe mostrar databaseNameObserved Demo.');
    assert(summaryHtml.includes('Migración 128'), 'Debe mostrar migración 128.');
    assert(summaryHtml.includes('Migración 129'), 'Debe mostrar migración 129.');
    assert(summaryHtml.includes('Migración 130'), 'Debe mostrar migración 130.');
    assert(summaryHtml.includes('Migración 131'), 'Debe mostrar migración 131.');
    assert(summaryHtml.includes('Aplicada') && summaryHtml.includes('Pendiente'), 'Debe diferenciar migraciones aplicadas y pendientes.');
    // Verificar renderizado de los conteos escalares reales de summaryCounts
    assert(summaryHtml.includes('Usuarios registrados') && summaryHtml.includes('>5<'), 'Debe mostrar users=5.');
    assert(summaryHtml.includes('Publicaciones activas') && summaryHtml.includes('>3<'), 'Debe mostrar publicationsActive=3.');
    assert(summaryHtml.includes('Aceptaciones pendientes') && summaryHtml.includes('>2<'), 'Debe mostrar publicationAcceptancesPending=2.');
    assert(summaryHtml.includes('Retenciones escrow activas') && summaryHtml.includes('>1<'), 'Debe mostrar escrowHoldsActive=1.');
    assert(summaryHtml.includes('Episodios de mora (compromiso RED)'), 'Debe mostrar moraEpisodes.');
    assert(summaryHtml.includes('Incidencias de política sin resolver'), 'Debe mostrar creditPolicyIssuesUnresolved.');
    assert(summaryHtml.includes('Incidencias en dead-letter'), 'Debe mostrar deadLetterCount.');
    assert(summaryHtml.includes('Notificaciones outbox pendientes'), 'Debe mostrar outboxPending.');
    assert(summaryHtml.includes('Premios de referidos activos'), 'Debe mostrar referralAwardsActive.');
    assert(summaryHtml.includes('Operaciones on-chain activas'), 'Debe mostrar chainOpsActive.');
    // Garantía crítica: objetos anidados jamás se serializan como "[object Object]"
    assert(!summaryHtml.includes('[object Object]'), 'El HTML de resumen JAMÁS debe contener "[object Object]".');
    assert(summaryHtml.includes('Cargar detalle para conciliación'), 'Debe ofrecer botón explícito de detalle.');
    assert(summaryHtml.includes('Copiar JSON'), 'Debe ofrecer botón "Copiar JSON".');
    assert(summaryHtml.includes('Descargar JSON'), 'Debe ofrecer botón "Descargar JSON".');
    assert(
      summaryHtml.includes('NO se guarda en localStorage ni sessionStorage'),
      'Debe mostrar aviso de no persistencia en Web Storage.'
    );
    assert(!summaryHtml.includes('<pre'), 'El resumen no debe auto-mostrar la vista previa de detalle.');
    console.log('PASS: estado success (resumen con contrato real summaryCounts y cero [object Object])');

    // Escenario F: Acción explícita de detalle (?detail=true) con forma exacta de adminDemoInventoryController.js
    let detailUrlCalled = null;
    const detailPayload = {
      ...summaryPayload,
      mode: 'detail',
      detail: {
        linkableAdminDataNotice:
          'Los identificadores de usuario y direcciones de billetera incluidos en modo detail son datos vinculables de uso exclusivo administrativo.',
        users: [{ id: 101, walletAddress: '0x1111111111111111111111111111111111111111' }],
        moraEpisodes: [],
        openCreditPolicyIssues: [],
        publicationsActive: [],
        publicationAcceptancesPending: [],
        escrowHoldsActive: [],
        creditNotificationOutboxPending: [],
        creditReferralAwardsActive: [],
        chainOperationsActive: []
      }
    };
    const detailResult = await fetchDemoInventory({
      apiUrl: 'https://demo-api.example.test',
      includeDetail: true,
      fetchImpl: async (url, opts) => {
        detailUrlCalled = url;
        assert.equal(opts.credentials, 'include');
        assert.equal(opts.cache, 'no-store');
        return {
          status: 200,
          ok: true,
          json: async () => detailPayload
        };
      }
    });

    assert.equal(detailUrlCalled, 'https://demo-api.example.test/api/admin/web3/demo-inventory?detail=true');
    assert.equal(detailResult.status, 'success');
    const detailHtml = renderToStaticMarkup(
      React.createElement(DemoInventoryPanel, {
        initialState: {
          status: detailResult.status,
          data: detailResult.data,
          completenessFlags: detailResult.completenessFlags,
          detailLoaded: true
        }
      })
    );
    assert(detailHtml.includes('<pre'), 'Al cargar detalle explícitamente debe mostrarse la vista previa JSON.');
    assert(detailHtml.includes('0x1111111111111111111111111111111111111111'), 'El detalle debe incluir las direcciones para conciliación.');
    assert(!detailHtml.includes('[object Object]'), 'El HTML de detalle JAMÁS debe contener "[object Object]".');
    console.log('PASS: acción explícita ?detail=true (contrato real detail y cero [object Object])');

    // Verificación final de cero persistencia en localStorage / sessionStorage
    assert.equal(storageTouches, 0, 'No debe haber ningún acceso a localStorage ni sessionStorage.');
    console.log('PASS: cero accesos a localStorage/sessionStorage');
  } finally {
    if (prevLocalStorage === undefined) delete global.localStorage;
    else global.localStorage = prevLocalStorage;
    if (prevSessionStorage === undefined) delete global.sessionStorage;
    else global.sessionStorage = prevSessionStorage;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
