// server.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());

// --- STATIC SERVE (kritik) ---
// Bu satır, repo kökündeki tüm dosyaları (validation-key.txt dahil) servis eder.
app.use(express.static(__dirname));

// Ek güvence: validation-key.txt'yi açıkça düz metin olarak servis et
app.get("/validation-key.txt", (req, res) => {
  res.type("text/plain");
  res.sendFile(path.join(__dirname, "validation-key.txt"));
});

// ---- Ayarlar ----
const API_KEY = process.env.API_KEY; // Render -> Environment Variable
const PI_API = "https://api.minepi.com/v2";

// ---- Basit kontroller ----
app.get("/health", (req, res) => res.json({ ok: true }));
app.get("/metadata", (req, res) => {
  res.json({
    name: "Spiritual Academy",
    description: "Testnet backend",
    url: "https://spiritualacademy.work",
  });
});

// ---- Ödeme akışı ----
// 1) Onay
app.post("/approve-payment", async (req, res) => {
  try {
    const { paymentId } = req.body || {};
    if (!paymentId) return res.status(400).json({ error: "paymentId missing" });

    const r = await fetch(`${PI_API}/payments/${paymentId}/approve`, {
      method: "POST",
      headers: {
        Authorization: `Key ${API_KEY}`,
        "Content-Type": "application/json",
      },
    });
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json(data);
    res.json({ ok: true, data });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "approve-failed" });
  }
});

// 2) Tamamlama
app.post("/complete-payment", async (req, res) => {
  try {
    const { paymentId, txid } = req.body || {};
    if (!paymentId) return res.status(400).json({ error: "paymentId required" });

    const body = txid ? { txid } : undefined;

    const r = await fetch(`${PI_API}/payments/${paymentId}/complete`, {
      method: "POST",
      headers: {
        Authorization: `Key ${API_KEY}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json(data);
    res.json({ ok: true, data });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "complete-failed" });
  }
});

// 3) İptal (opsiyonel)
app.post("/cancel-payment", async (req, res) => {
  try {
    const { paymentId } = req.body || {};
    if (!paymentId) return res.status(400).json({ error: "paymentId missing" });

    const r = await fetch(`${PI_API}/payments/${paymentId}/cancel`, {
      method: "POST",
      headers: {
        Authorization: `Key ${API_KEY}`,
        "Content-Type": "application/json",
      },
    });
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json(data);
    res.json({ ok: true, data });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "cancel-failed" });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("Server listening on", PORT));
