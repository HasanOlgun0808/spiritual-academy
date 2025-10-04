// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fetch = require('node-fetch'); // v2

const app = express();
app.use(cors());
app.use(bodyParser.json());

// ---- Ayarlar ----
const API_KEY = process.env.API_KEY; // Render'da tanımladık
const PI_API = 'https://api.minepi.com/v2';

// ---- Basit kontroller ----
app.get('/health', (req, res) => res.json({ ok: true }));
app.get('/metadata', (req, res) => {
  res.json({
    name: 'Spiritual Academy',
    description: 'Testnet backend',
    url: 'https://spiritualacademy.work'
  });
});

// ---- Ödeme akışı ----
// 1) Onay
app.post('/approve-payment', async (req, res) => {
  const { paymentId } = req.body || {};
  if (!paymentId) return res.status(400).json({ error: 'paymentId missing' });

  try {
    const r = await fetch(`${PI_API}/payments/${paymentId}/approve`, {
      method: 'POST',
      headers: {
        'Authorization': `Key ${API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json(data);
    res.json({ ok: true, data });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'approve-failed' });
  }
});

// 2) Tamamlama (cüzdanın verdiği txid ile)
app.post('/complete-payment', async (req, res) => {
  const { paymentId, txid } = req.body || {};
  if (!paymentId || !txid) {
    return res.status(400).json({ error: 'paymentId and txid required' });
  }

  try {
    const r = await fetch(`${PI_API}/payments/${paymentId}/complete`, {
      method: 'POST',
      headers: {
        'Authorization': `Key ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ txid })
    });
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json(data);
    res.json({ ok: true, data });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'complete-failed' });
  }
});

// 3) İptal
app.post('/cancel-payment', async (req, res) => {
  const { paymentId } = req.body || {};
  if (!paymentId) return res.status(400).json({ error: 'paymentId missing' });

  try {
    const r = await fetch(`${PI_API}/payments/${paymentId}/cancel`, {
      method: 'POST',
      headers: {
        'Authorization': `Key ${API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json(data);
    res.json({ ok: true, data });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'cancel-failed' });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log('Server listening on', PORT));
