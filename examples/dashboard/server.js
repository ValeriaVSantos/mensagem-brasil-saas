// server.js — Express dashboard entry point
//
// Security middleware order matters:
//   1. trust proxy (BEFORE rate-limit, so Cloudflare's X-Forwarded-For is honored)
//   2. helmet (HTTP security headers)
//   3. rate-limit (general)
//   4. rate-limit (auth-specific, more restrictive)
//   5. body parsers
//   6. static + routes

require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();

// 1. Trust the Cloudflare proxy. Without this, every request appears to come
//    from a Cloudflare IP and rate-limit blocks all real users.
app.set('trust proxy', 1);

// 2. HTTP security headers. CSP is disabled to permit inline scripts in the
//    dashboard; this is a deliberate trade-off, not an oversight.
app.use(helmet({ contentSecurityPolicy: false }));

// 3. General rate limiting: 100 requests per 15 minutes per real client IP.
app.use(rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
}));

// 4. Stricter rate limiting on auth endpoints: 10 requests per 15 minutes.
//    Protects against brute-force attempts on /api/auth/login.
const authLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
});
app.use('/api/auth', authLimit);

// 5. Body parsers.
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 6. Static assets and routes.
app.use(express.static('public'));

const authRoutes = require('./routes/auth-create');
const dailyDeliveryRoutes = require('./routes/daily-delivery');

app.use('/api/auth', authRoutes);
app.use('/api/envio', dailyDeliveryRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Dashboard listening on port ${PORT}`);
});
