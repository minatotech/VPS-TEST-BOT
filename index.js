const express = require('express');
const bodyParser = require("body-parser");
const path = require('path');
const app = express();

const PORT = process.env.PORT || 8000;
const __path = process.cwd();

// 1. Prevent memory leak warnings during extensive multi-device operations
require('events').EventEmitter.defaultMaxListeners = 500;

// 2. GLOBAL MIDDLEWARE FIRST: Parse payloads BEFORE the routes attempt to read them
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// 3. ROUTERS: Mount the optimized backend pairing API logic
const code = require('./pair'); 
app.use('/code', code);

// 4. STATIC PAGES: Safer path rendering with absolute path resolution
app.get('/pair', (req, res) => {
    try {
        res.sendFile(path.join(__path, 'pair.html'));
    } catch (error) {
        res.status(500).send("Error loading pairing interface.");
    }
});

app.get('/', (req, res) => {
    try {
        res.sendFile(path.join(__path, 'main.html'));
    } catch (error) {
        res.status(500).send("Error loading main interface.");
    }
});

// 5. BOOT SERVER
app.listen(PORT, () => {
    console.log(`
⚡ MINATO TEST BOT SYSTEM INITIALIZED ⚡
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👑 Owner: MINATO TECH
📡 Status: Web Server Active
🔗 Endpoint: http://localhost:${PORT}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    `);
});

module.exports = app;
