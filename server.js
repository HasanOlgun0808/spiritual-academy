// server.js
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
app.use(cors());                // test için herkese açık
app.use(bodyParser.json());

// Basit sağlık kontrolü
app.get('/health', (req, res) => res.json({ ok: true }));

// PiNet metadata (backend seçtiğin için basit bir çıktı verelim)
app.get('/metadata', (req, res) => {
  res.json({
    name: "Spiritual Academy",
    description: "Testnet backend",
    url: "https://spiritualacademy.work"
  });
});

// Pi Wallet / Platform bu uçları çağırır:
// Testnet için her şeyi otomatik onayla ve tamamla
app.post('/approve-payment', (req, res) => {
  res.json({ approved: true });
});

app.post('/complete-payment', (req, res) => {
  res.json({ completed: true });
});

app.post('/cancel-payment', (req, res) => {
  res.json({ cancelled: true });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log('Server listening on', PORT));
