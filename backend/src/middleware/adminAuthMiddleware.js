'use strict';
module.exports = { verifyAdminToken: (req, res, next) => require('./adminSession').verifySession(req, res, next) };
