// server.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());

// ---------- Statik dosyalar ----------
/*
  Repo kökündeki index.html, payment.html, vb. dosyaları servis eder.
  validation-key.txt de buradan erişilebilir, ama ayrıca aşağıda
  açık bir route da veriyoruz ki doğrulama kesin çalışsın.
*/
app.use(express.static(path.join(__dirname)));

// ---------- Validation Key ----------
/*
  Pi doğrulaması için:
  1) Render > Environment > Add Variable
     KEY: VALIDATION_KEY
     VALUE: <uzun anahtar>
  veya
  2) Repo köküne validation-key.txt dosyasını koy.
*/
app.get("/validation-key.txt", (req, res) => {
  const key = process.env.VALIDATION_KEY;
  if (key && typeof key === "string") {
    res.type("text/plain").send(key.trim());
  } else {
    // Ortam değişkeni yoksa dosyayı gönder
    res.type("text/plain");
    res.sendFile(path.join(__dirname, "validation-key.txt"), (err) => {
      if (err) res.status(404).send("validation-key not found");
    });
  }
});

// ---------- Basit kontroller ----------
app.get("/health", (req, res) => res.json({ ok: true }));
app.get("/metadata", (req, res) => {
  res.json({
    name: "Spiritual Academy",
    description: "Pi payments backend",
    url: "https://spiritualacademy.work",
  });
});

// ---------- Pi Payments ----------
const API_KEY = process.env.API_KEY; // Render -> Environment Variable
const PI_API = "https://api.minepi.com/v2";

// 1) Approve
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
    console.error("approve-payment error:", e);
    res.status(500).json({ error: "approve-failed" });
  }
});

// 2) Complete (txid opsiyonel)
app.post("/complete-payment", async (req, res) => {
  try {
    const { paymentId, txid } = req.body || {};
    if (!paymentId) return res.status(400).json({ error: "paymentId required" });

    const r = await fetch(`${PI_API}/payments/${paymentId}/complete`, {
      method: "POST",
      headers: {
        Authorization: `Key ${API_KEY}`,
        "Content-Type": "application/json",
      },
      body: txid ? JSON.stringify({ txid }) : undefined,
    });
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json(data);
    res.json({ ok: true, data });
  } catch (e) {
    console.error("complete-payment error:", e);
    res.status(500).json({ error: "complete-failed" });
  }
});

// 3) Cancel (opsiyonel)
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
    console.error("cancel-payment error:", e);
    res.status(500).json({ error: "cancel-failed" });
  }
});

// ---------- Sunucu ----------
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("Server listening on", PORT));
