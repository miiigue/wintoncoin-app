'use strict';

const deployment = require('../src/services/chainDeployment');
const gate = require('../src/services/economicWriteGate');

function expectedMode(argv = process.argv.slice(2)) {
    if (argv.includes('--expect-operational')) return 'operational';
    if (argv.includes('--expect-contained')) return 'contained';
    throw new Error('Use --expect-contained o --expect-operational.');
}

async function inspect({ env = process.env, pool = require('../src/config/db'), deploymentService = deployment } = {}) {
    const config = deploymentService.configuration(env);
    const rpc = deploymentService.provider();
    try {
        await deploymentService.validate(rpc, config);
        const operations = await gate.operationalStatus({ pool, env, config });
        return {
            success: true,
            chainId: config.chainId,
            epoch: config.epoch,
            fingerprint: config.fingerprint,
            contractsValidated: true,
            operations: {
                enabled: operations.enabled,
                mode: operations.mode,
                reason: operations.reason || null,
                indexerReady: operations.indexerReady === true
            }
        };
    } finally {
        rpc.destroy?.();
    }
}

async function main() {
    const expectation = expectedMode();
    const result = await inspect();
    const satisfied = expectation === 'operational'
        ? result.epoch === gate.V5_EPOCH && result.operations.enabled && result.operations.indexerReady
        : result.epoch === gate.V5_EPOCH && !result.operations.enabled;
    process.stdout.write(`${JSON.stringify({ ...result, expectation, satisfied }, null, 2)}\n`);
    if (!satisfied) process.exitCode = 2;
}

if (require.main === module) {
    main().catch(() => {
        process.stderr.write('El preflight V5 falló de forma segura; revise época, contratos, indexador y control de escrituras.\n');
        process.exitCode = 2;
    });
}

module.exports = { expectedMode, inspect, main };
