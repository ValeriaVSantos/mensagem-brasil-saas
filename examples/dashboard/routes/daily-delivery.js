// routes/daily-delivery.js — endpoint queried by Make every morning at 06:00
//
// Returns all active recipients of all active customers whose WhatsApp is
// currently connected. Make then iterates this list, calls GPT-4o for the
// message and DALL·E 3 for the image, and sends via Evolution API.

const express = require('express');
const { Pool } = require('pg');

const router = express.Router();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

router.get('/envio-diario', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                cl.id           AS cliente_id,
                cl.instance_name,
                ct.nome         AS contato_nome,
                ct.numero       AS contato_numero,
                ct.tom,
                ct.tema
            FROM clientes cl
            JOIN contatos ct ON ct.cliente_id = cl.id
            WHERE cl.ativo = true
              AND cl.whatsapp_status = 'open'
              AND ct.ativo = true
        `);

        res.json(result.rows);
    } catch (err) {
        console.error('Erro na consulta de envio diário:', err);
        res.status(500).json({ erro: 'Erro interno' });
    }
});

module.exports = router;
