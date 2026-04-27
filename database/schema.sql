-- Mensagem Brasil — application schema
--
-- Apply against the same PostgreSQL instance used by Evolution API:
--   docker exec -i evolution-postgres psql -U evolution -d evolution < database/schema.sql

-- Customers (paying users of the SaaS)
CREATE TABLE IF NOT EXISTS clientes (
    id                   SERIAL PRIMARY KEY,
    nome                 VARCHAR(255) NOT NULL,
    email                VARCHAR(255) UNIQUE NOT NULL,
    senha                TEXT NOT NULL,                  -- bcrypt hash, salt rounds = 10
    plano                VARCHAR(50)  DEFAULT 'basico',
    instance_name        VARCHAR(255),                   -- Evolution API instance identifier
    whatsapp_status      VARCHAR(50)  DEFAULT 'desconectado',
    ativo                BOOLEAN      DEFAULT true,
    onboarding_completo  BOOLEAN      DEFAULT false,
    reset_token          TEXT,
    reset_expiry         TIMESTAMP,
    criado_em            TIMESTAMP    DEFAULT NOW()
);

-- Recipients configured by each customer
CREATE TABLE IF NOT EXISTS contatos (
    id           SERIAL PRIMARY KEY,
    cliente_id   INTEGER REFERENCES clientes(id) ON DELETE CASCADE,
    nome         VARCHAR(255),
    numero       VARCHAR(50),
    tom          VARCHAR(50)  DEFAULT 'carinhoso',  -- carinhoso | motivacional | espiritual | divertido
    tema         VARCHAR(50)  DEFAULT 'geral',      -- semantic anchor for the LLM
    horario      VARCHAR(10)  DEFAULT '06:00',
    ativo        BOOLEAN      DEFAULT true,
    criado_em    TIMESTAMP    DEFAULT NOW()
);

-- Delivery history (one row per delivered message)
CREATE TABLE IF NOT EXISTS envios (
    id              SERIAL PRIMARY KEY,
    cliente_id      INTEGER REFERENCES clientes(id),
    contato_nome    VARCHAR(255),
    contato_numero  VARCHAR(50),
    mensagem        TEXT,
    status          VARCHAR(50),
    enviado_em      TIMESTAMP DEFAULT NOW()
);

-- Indexes that the daily-delivery query depends on
CREATE INDEX IF NOT EXISTS idx_clientes_ativo_status   ON clientes(ativo, whatsapp_status);
CREATE INDEX IF NOT EXISTS idx_contatos_cliente_ativo  ON contatos(cliente_id, ativo);
CREATE INDEX IF NOT EXISTS idx_envios_cliente_data     ON envios(cliente_id, enviado_em);
