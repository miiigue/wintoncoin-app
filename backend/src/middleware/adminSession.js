'use strict';
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const roles = new Set(['superadmin', 'admin', 'auditor']);
const mutates = method => !['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase());
function trustedOrigin(req) {
    const raw = req.headers.origin || req.headers.referer;
    if (!raw) return false;
    try {
        const origin = new URL(raw).origin;
        const allowed = [process.env.FRONTEND_URL, process.env.ADMIN_FRONTEND_URL,
            'https://wintoncoin.com', 'https://admin.wintoncoin.com', 'https://demo.wintoncoin.com'];
        if (process.env.NODE_ENV !== 'production') allowed.push('http://localhost:5173', 'http://localhost:3000');
        return allowed.filter(Boolean).some(value => { try { return new URL(value).origin === origin; } catch { return false; } });
    } catch { return false; }
}
async function verifySession(req, res, next, token = req.cookies?.admin_token) {
    res.setHeader?.('Cache-Control', 'no-store');
    if (!token) return res.status(401).json({message:'Inicia sesión como administrador.'});
    const secret = process.env.ADMIN_SECRET_KEY;
    if (!secret || secret === process.env.JWT_SECRET) return res.status(503).json({message:'La autenticación administrativa requiere una clave independiente.'});
    if (mutates(req.method) && !trustedOrigin(req)) return res.status(403).json({message:'Origen administrativo no autorizado.'});
    let decoded;
    try { decoded = jwt.verify(token, secret, {algorithms:['HS256']}); }
    catch { return res.status(401).json({message:'Sesión administrativa inválida o vencida.'}); }
    if (!decoded.userId || !roles.has(decoded.role) || typeof decoded.pwdVersion !== 'string')
        return res.status(401).json({message:'Vuelve a iniciar sesión administrativa.'});
    try {
        const result = await pool.query('SELECT id, username, role, account_status, password_hash FROM admin_users WHERE id = $1', [decoded.userId]);
        const admin = result.rows[0];
        if (!admin || admin.account_status !== 'active' || !roles.has(admin.role) || admin.role !== decoded.role ||
            !admin.password_hash || admin.password_hash.slice(-10) !== decoded.pwdVersion)
            return res.status(401).json({message:'Sesión administrativa revocada. Vuelve a identificarte.'});
        if (mutates(req.method) && admin.role === 'auditor') return res.status(403).json({message:'Este rol permite consultas, no modificaciones.'});
        req.user = {userId:admin.id, username:admin.username, role:admin.role};
        res.locals.admin = req.user;
        return next();
    } catch { return res.status(503).json({message:'No se pudo verificar la sesión administrativa.'}); }
}
module.exports = {verifySession, trustedOrigin};
