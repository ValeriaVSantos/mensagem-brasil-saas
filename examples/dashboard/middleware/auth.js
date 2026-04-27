// middleware/auth.js — JWT verification middleware
//
// Expects an Authorization header of the form: "Bearer <token>"
// On success, attaches req.clienteId for downstream handlers.

const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
    const auth = req.headers['authorization'];
    if (!auth) {
        return res.status(401).json({ erro: 'Token ausente' });
    }

    const token = auth.split(' ')[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.clienteId = decoded.id;
        next();
    } catch (err) {
        return res.status(401).json({ erro: 'Token inválido' });
    }
};
