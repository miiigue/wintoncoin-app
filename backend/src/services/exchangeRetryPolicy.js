'use strict';
// Log only our own codes and numeric diagnostics, never upstream URLs/errors.
function createRetryPolicy(pollMs = 5000, now = Date.now) {
    let attempts = 0, previousCode, lastLog = -Infinity;
    return {
        failed(error) {
            const candidate = error.indexerCode;
            const code = typeof candidate === 'string' && /^[A-Z_]{1,64}$/.test(candidate) ? candidate : 'SYNC_FAILED';
            if (code !== previousCode) attempts = 0;
            const shouldLog = code !== previousCode || now() - lastLog >= 300000;
            attempts++; previousCode = code;
            const delay = Math.min(60000, pollMs * 2 ** Math.min(attempts - 1, 10));
            const details = {};
            for (const key of ['cursorBlock', 'targetBlock', 'lagBlocks']) {
                if (Number.isSafeInteger(error.indexerDetails?.[key])) details[key] = error.indexerDetails[key];
            }
            if (shouldLog) lastLog = now();
            return { delay, shouldLog, report: { code, attempts, retryMs: delay, ...details } };
        },
        succeeded(result) {
            if (result.status === 'busy') return { recovered: false, delay: pollMs };
            const recovered = attempts > 0;
            attempts = 0; previousCode = undefined; lastLog = -Infinity;
            return { recovered, delay: ['syncing', 'rebuilding'].includes(result.status) ? 100 : pollMs };
        }
    };
}
module.exports = { createRetryPolicy };
