'use strict';

/**
 * ============================================================================
 * GUARDIÁN DE AUDITORÍA DE DEPENDENCIAS FRONTEND (SOC 2 / FINTECH CI)
 * ============================================================================
 * Política Fail-Closed:
 * 1. Exige CERO vulnerabilidades high o critical en dependencias de producción
 *    (`npm audit --omit=dev --audit-level=high`).
 * 2. Bloquea cualquier vulnerabilidad `critical` en dependencias de desarrollo.
 * 3. Bloquea cualquier vulnerabilidad `high` en dependencias de desarrollo que NO
 *    esté explícitamente documentada y acotada en ALLOWED_BUILD_TOOL_ADVISORIES.
 * ============================================================================
 */

const path = require('node:path');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');

const FRONTEND_DIR = path.resolve(__dirname, '..');

// Excepciones temporales exclusivamente de herramientas de build sin parche upstream en npm.
const ALLOWED_BUILD_TOOL_ADVISORIES = Object.freeze({
  'GHSA-fc5q-39xc-vjpf': {
    packageName: 'picomatch',
    reason: 'ReDoS en globs de compilación (vite/@rollup/pluginutils); no procesa input de usuarios ni llega al bundle del navegador; 4.0.7 es latest en npm.'
  }
});

function extractGhsaId(advisoryObj) {
  const url = typeof advisoryObj?.url === 'string' ? advisoryObj.url : '';
  const match = url.match(/(GHSA-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4})/i);
  return match ? match[1] : null;
}

/**
 * Evalúa el árbol completo de `npm audit --json` con política fail-closed.
 * @param {object} auditReport - JSON parseado de `npm audit --json`.
 * @returns {{ ok: boolean, blockingIssues: string[], toleratedAdvisories: string[] }}
 */
function evaluateFullAuditReport(auditReport) {
  if (!auditReport || typeof auditReport !== 'object' || auditReport.error || !auditReport.vulnerabilities || typeof auditReport.vulnerabilities !== 'object') {
    const errDetail = auditReport?.error?.summary || 'Respuesta inválida o vacía de npm audit --json';
    return {
      ok: false,
      blockingIssues: [`Fallo al consultar auditoría npm (fail-closed): ${errDetail}`],
      toleratedAdvisories: []
    };
  }

  const vulnerabilities = auditReport.vulnerabilities;
  const blockingIssues = [];
  const tolerated = new Set();

  // Resolver recursivamente si un paquete vulnerable solo depende de avisos permitidos
  const cache = new Map();
  const inspectPackage = (pkgName, trail = new Set()) => {
    if (cache.has(pkgName)) return cache.get(pkgName);
    const entry = vulnerabilities[pkgName];
    if (!entry) return { unapproved: [] };

    if (entry.severity === 'critical') {
      const res = { unapproved: [`${pkgName}: severidad CRITICAL no permitida`] };
      cache.set(pkgName, res);
      return res;
    }

    if (entry.severity !== 'high') {
      return { unapproved: [] };
    }

    if (trail.has(pkgName)) return { unapproved: [] };
    const nextTrail = new Set(trail);
    nextTrail.add(pkgName);

    const unapproved = [];
    const viaList = Array.isArray(entry.via) ? entry.via : [];
    if (viaList.length === 0) {
      unapproved.push(`${pkgName}: vulnerabilidad HIGH sin detalle verifiable`);
    }

    for (const via of viaList) {
      if (typeof via === 'string') {
        const sub = inspectPackage(via, nextTrail);
        unapproved.push(...sub.unapproved);
      } else if (via && typeof via === 'object') {
        const ghsa = extractGhsaId(via);
        if (ghsa && Object.prototype.hasOwnProperty.call(ALLOWED_BUILD_TOOL_ADVISORIES, ghsa)) {
          tolerated.add(`${ghsa} (${pkgName})`);
        } else {
          unapproved.push(`${pkgName}: aviso HIGH no autorizado (${ghsa || via.title || 'sin GHSA'})`);
        }
      }
    }

    const res = { unapproved };
    cache.set(pkgName, res);
    return res;
  };

  for (const [pkgName, entry] of Object.entries(vulnerabilities)) {
    if (entry?.severity === 'critical' || entry?.severity === 'high') {
      const result = inspectPackage(pkgName);
      for (const issue of result.unapproved) {
        if (!blockingIssues.includes(issue)) {
          blockingIssues.push(issue);
        }
      }
    }
  }

  return {
    ok: blockingIssues.length === 0,
    blockingIssues,
    toleratedAdvisories: [...tolerated]
  };
}

function runSelfTests() {
  const onlyAllowed = evaluateFullAuditReport({
    vulnerabilities: {
      picomatch: {
        severity: 'high',
        via: [{ url: 'https://github.com/advisories/GHSA-fc5q-39xc-vjpf', title: 'picomatch ReDoS' }]
      },
      vite: {
        severity: 'high',
        via: ['picomatch']
      }
    }
  });
  assert.equal(onlyAllowed.ok, true, 'Debe permitir únicamente la excepción documentada de build');
  assert(onlyAllowed.toleratedAdvisories.some(x => x.includes('GHSA-fc5q-39xc-vjpf')));

  const unapprovedHigh = evaluateFullAuditReport({
    vulnerabilities: {
      'serialize-javascript': {
        severity: 'high',
        via: [{ url: 'https://github.com/advisories/GHSA-m5mm-p8h7-m29v', title: 'XSS' }]
      }
    }
  });
  assert.equal(unapprovedHigh.ok, false, 'Debe bloquear avisos HIGH no autorizados');

  const anyCritical = evaluateFullAuditReport({
    vulnerabilities: {
      picomatch: {
        severity: 'critical',
        via: [{ url: 'https://github.com/advisories/GHSA-fc5q-39xc-vjpf', title: 'CRITICAL' }]
      }
    }
  });
  assert.equal(anyCritical.ok, false, 'Debe bloquear severidad CRITICAL aunque coincida el GHSA');

  const malformed = evaluateFullAuditReport({ error: { summary: 'ENOTFOUND' } });
  assert.equal(malformed.ok, false, 'Debe fallar cerrado ante errores de consulta npm');

  console.log('PASS check-ci-audit self-tests (4/4 escenarios fail-closed verificados).');
}

function runNpmCommand(args) {
  return spawnSync('npm', args, {
    cwd: FRONTEND_DIR,
    encoding: 'utf8',
    shell: process.platform === 'win32',
    maxBuffer: 10 * 1024 * 1024
  });
}

if (require.main === module) {
  if (process.argv.includes('--self-test')) {
    runSelfTests();
    process.exit(0);
  }

  runSelfTests();

  // 1. Auditoría estricta de dependencias reales de producción/navegador (cero tolerancia)
  const prodAudit = runNpmCommand(['audit', '--omit=dev', '--audit-level=high']);
  if (prodAudit.status !== 0) {
    console.error('[CI AUDIT] FAIL: Vulnerabilidades high/critical detectadas en dependencias de runtime (--omit=dev):');
    if (prodAudit.stdout) console.error(prodAudit.stdout);
    if (prodAudit.stderr) console.error(prodAudit.stderr);
    process.exit(1);
  }
  console.log('[CI AUDIT] PASS: 0 vulnerabilidades high/critical en dependencias de runtime (--omit=dev).');

  // 2. Auditoría completa dev + prod con validación estricta de excepciones permitidas
  const fullAudit = runNpmCommand(['audit', '--json']);
  let parsedReport;
  try {
    parsedReport = JSON.parse(fullAudit.stdout || '{}');
  } catch (parseErr) {
    console.error('[CI AUDIT] FAIL: No se pudo parsear JSON de npm audit (fail-closed):', parseErr.message);
    process.exit(1);
  }

  const verdict = evaluateFullAuditReport(parsedReport);
  if (!verdict.ok) {
    console.error('[CI AUDIT] FAIL: Se detectaron vulnerabilidades bloqueantes en herramientas/dependencias:');
    verdict.blockingIssues.forEach((msg) => console.error(`  - ${msg}`));
    process.exit(1);
  }

  if (verdict.toleratedAdvisories.length > 0) {
    console.log('[CI AUDIT] Excepción temporal de build-time acotada y vigente:');
    verdict.toleratedAdvisories.forEach((item) => console.log(`  - ${item}`));
  }
  console.log('[CI AUDIT] PASS: Auditoría de dependencias frontend aprobada bajo política fail-closed.');
}

module.exports = {
  evaluateFullAuditReport,
  ALLOWED_BUILD_TOOL_ADVISORIES
};
