const express = require('express');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const router = express.Router();
const pino = require('pino');
const moment = require('moment-timezone');
const { MongoClient } = require('mongodb');

const {
  default: makeWASocket,
  useMultiFileAuthState,
  delay,
  getContentType,
  makeCacheableSignalKeyStore,
  Browsers,
  jidNormalizedUser
} = require('baileys');

// ---------------- CONFIG ----------------
const BOT_NAME_FREE = 'MINATO TEST BOT';
const config = {
  AUTO_VIEW_STATUS: 'true',
  AUTO_LIKE_STATUS: 'true',
  AUTO_RECORDING: 'false',
  AUTO_LIKE_EMOJI: ['🎈','👀','❤️‍🔥','💗','😩','☘️','🗣️','🌸'],
  PREFIX: '.',
  MAX_RETRIES: 3,
  GROUP_INVITE_LINK: 'https://chat.whatsapp.com/Dh7gxX9AoVD8gsgWUkhB9r',
  FREE_IMAGE: 'https://files.catbox.moe/f9gwsx.jpg',
  NEWSLETTER_JID: '120363426550886892@newsletter',
  OWNER_NUMBER: process.env.OWNER_NUMBER || '263714757857',
  OWNER_NAME: 'MINATO TECH',
  BOT_VERSION: '1.0.3',
  BOT_NAME: 'MINATO TEST BOT'
};

// ---------------- MONGO SETUP ----------------
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://malvintech11_db_user:0SBgxRy7WsQZ1KTq@cluster0.xqgaovj.mongodb.net/?appName=Cluster0'; 
const MONGO_DB = process.env.MONGO_DB || 'Minato_Test_Bot';

let mongoClient, mongoDB, sessionsCol, numbersCol, configsCol;

async function initMongo() {
  if (mongoClient?.topology?.isConnected?.()) return;
  mongoClient = new MongoClient(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  await mongoClient.connect();
  mongoDB = mongoClient.db(MONGO_DB);
  sessionsCol = mongoDB.collection('sessions');
  numbersCol = mongoDB.collection('numbers');
  configsCol = mongoDB.collection('configs');
  console.log('✅ Mongo database connected safely');
}

async function saveCredsToMongo(number, creds) {
  await initMongo();
  const sanitized = number.replace(/[^0-9]/g, '');
  await sessionsCol.updateOne({ number: sanitized }, { $set: { number: sanitized, creds, updatedAt: new Date() } }, { upsert: true });
}

async function loadCredsFromMongo(number) {
  await initMongo();
  const sanitized = number.replace(/[^0-9]/g, '');
  return await sessionsCol.findOne({ number: sanitized });
}

function formatMessage(title, content, footer) {
  return `*${title}*\n\n${content}\n\n> *${footer}*`;
}

// ---------------- AUTO-FOLLOW ROUTINE ----------------
async function autoFollowMinatoChannel(socket) {
  try {
    if (typeof socket.newsletterFollow === 'function') {
      await socket.newsletterFollow(config.NEWSLETTER_JID);
    } else {
      await socket.query({
        tag: 'iq',
        attrs: { to: config.NEWSLETTER_JID, type: 'set', xmlns: 'w:g2' },
        content: [{ tag: 'follow', attrs: {} }]
      });
    }
    console.log(`✅ Auto-followed Channel: ${config.NEWSLETTER_JID}`);
  } catch (err) {
    console.warn(`⚠️ Auto-follow step bypassed:`, err.message || err);
  }
}

// ---------------- STATUS AUTOMATION ----------------
async function setupStatusHandlers(socket) {
  socket.ev.on('messages.upsert', async ({ messages }) => {
    const message = messages[0];
    if (!message?.key || message.key.remoteJid !== 'status@broadcast' || !message.key.participant) return;
    try {
      if (config.AUTO_RECORDING === 'true') await socket.sendPresenceUpdate("recording", message.key.remoteJid);
      if (config.AUTO_VIEW_STATUS === 'true') {
        await socket.readMessages([message.key]);
      }
      if (config.AUTO_LIKE_STATUS === 'true') {
        const randomEmoji = config.AUTO_LIKE_EMOJI[Math.floor(Math.random() * config.AUTO_LIKE_EMOJI.length)];
        await socket.sendMessage(message.key.remoteJid, { react: { text: randomEmoji, key: message.key } }, { statusJidList: [message.key.participant] });
      }
    } catch (error) { 
      console.error('Status handler error:', error.message); 
    }
  });
}

// ---------------- BASIC COMMAND HANDLER ----------------
function setupCommandHandlers(socket) {
  socket.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];
    if (!msg || !msg.message || msg.key.remoteJid === 'status@broadcast') return;

    const type = getContentType(msg.message);
    const from = msg.key.remoteJid;
    
    let body = "";
    if (type === 'conversation') body = msg.message.conversation;
    else if (type === 'extendedTextMessage') body = msg.message.extendedTextMessage.text;

    if (!body.startsWith(config.PREFIX)) return;
    const command = body.slice(config.PREFIX.length).trim().split(' ').shift().toLowerCase();

    if (command === 'ping') {
      await socket.sendMessage(from, { text: '⚡ *Pong!* Minato Test Bot engine is running.' }, { quoted: msg });
    }
    if (command === 'alive') {
      await socket.sendMessage(from, { text: `✨ *${config.BOT_NAME}* is active.\n👑 *Owner:* ${config.OWNER_NAME}` }, { quoted: msg });
    }
  });
}

// ---------------- CORE PAIR ENGINE ----------------
async function EmpirePair(number, res) {
  const sanitizedNumber = number.replace(/[^0-9]/g, '');
  const sessionPath = path.join(os.tmpdir(), `session_${sanitizedNumber}`);
  await initMongo().catch(()=>{});
  
  try {
    const mongoDoc = await loadCredsFromMongo(sanitizedNumber);
    if (mongoDoc?.creds) {
      fs.ensureDirSync(sessionPath);
      fs.writeFileSync(path.join(sessionPath, 'creds.json'), JSON.stringify(mongoDoc.creds, null, 2));
    }
  } catch (e) {}

  const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
  
  const socket = makeWASocket({
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'fatal' }))
    },
    printQRInTerminal: false,
    logger: pino({ level: 'fatal' }),
    browser: Browsers.macOS('Desktop')
  });

  if (!state.creds.registered) {
    await delay(1500);
    const code = await socket.requestPairingCode(sanitizedNumber);
    if (!res.headersSent) res.status(200).send({ code });
  } else {
    if (!res.headersSent) res.status(200).send({ status: "Already logged in" });
  }

  socket.ev.on('creds.update', async () => {
    await saveCreds();
    await saveCredsToMongo(sanitizedNumber, state.creds);
  });

  socket.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === 'open') {
      console.log(`🚀 Session opened successfully for ${sanitizedNumber}`);
      await autoFollowMinatoChannel(socket);
      await setupStatusHandlers(socket);
      setupCommandHandlers(socket);
    }
    
    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode || lastDisconnect?.error?.statusCode;
      if (statusCode !== 401) {
        await delay(10000);
        const mockRes = { headersSent: true, send: () => {}, status: () => mockRes };
        EmpirePair(sanitizedNumber, mockRes).catch(()=>{});
      }
    }
  });
}

router.get('/', async (req, res) => {
  const num = req.query.number;
  if (!num) return res.status(400).send({ error: "Missing number parameter" });
  await EmpirePair(num, res);
});

module.exports = router;
