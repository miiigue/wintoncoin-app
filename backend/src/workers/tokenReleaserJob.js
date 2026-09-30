'use strict';
// Compatibility export: never mutate legacy SQL balances or infer a burn from time.
// Both old callers share the same bounded on-chain worker.
const workers = require('./onchainMaintenanceJob');
module.exports = workers;
