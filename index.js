const express = require('express');
const bodyParser = require("body-parser");
const path = require('path');
const app = express();

const PORT = process.env.PORT || 8000;
const __path = process.cwd();

// 1. Prevent payload memory leak warnings for scale
require('events').EventEmitter.defaultMaxListeners = 500;

// 2. Global Middleware (Must sit BEFORE router definitions)
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// 3. Mount Backend Pairing API Core
const code = require('./pair'); 
app.use('/code', code);

// 4. Serve User Interface Static Routing via GET
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

// 5. Initialize Server Listener
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
