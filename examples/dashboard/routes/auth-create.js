// routes/auth-create.js — onboarding endpoint called by Make
//
// When a customer completes payment, Kiwify fires a webhook to Make.
// Make then POSTs to this endpoint with { email, nome, plano }.
// We:
//   1. Verify a shared secret in the X-Make-Secret header
//   2. Generate a random initial password
//   3. Hash it with bcrypt
//   4. Generate a unique Evolution-API instance name
//   5. Insert the customer
//   6. Return the plaintext temporary password to Make so it can email it

const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { Pool } = require('pg');

const router = express.Router();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

router.post('/criar-do-make', async (req, res) => {
    // 1. Verify shared secret
    const makeSecret = req.headers['x-make-secret'];
    if (makeSecret !== process.env.MAKE_SECRET) {
        return res.status(401).json({ erro: 'Não autorizado' });
    }

    const { email, nome, plano } = req.body;

    if (!email || !nome) {
        return res.status(400).json({ erro: 'email e nome são obrigatórios' });
    }

    // 2. Generate a temporary password (16 hex chars)
    const senhaTemp = crypto.randomBytes(8).toString('hex');

    // 3. Hash with bcrypt (salt rounds = 10)
    const senhaHash = await bcrypt.hash(senhaTemp, 10);

    // 4. Generate a unique Evolution-API instance name
    //    Strip non-alphanumeric chars from the email and append a timestamp
    const instance = 'inst_' +
        email.replace(/[^a-z0-9]/gi, '').slice(0, 10) +
        '_' + Date.now();

    // 5. Insert
    try {
        await pool.query(
            `INSERT INTO clientes (nome, email, senha, plano, instance_name)
             VALUES ($1, $2, $3, $4, $5)`,
            [nome, email, senhaHash, plano || 'basico', instance]
        );
    } catch (err) {
        if (err.code === '23505') {
            // Unique violation on email
            return res.status(409).json({ erro: 'E-mail já cadastrado' });
        }
        console.error('Erro ao criar cliente:', err);
        return res.status(500).json({ erro: 'Erro interno' });
    }

    // 6. Return the plaintext password so Make can include it in the welcome email
    res.json({ sucesso: true, senhaTemp, instance });
});

module.exports = router;
