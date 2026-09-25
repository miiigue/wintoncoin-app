'use strict';
// Apply the reviewed schema even where the initial revision of 110 was already
// recorded. Non-empty legacy refunds require blockchain reconciliation first.
module.exports = require('./110_add_suspended_status_and_held_refunds');
