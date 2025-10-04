// server.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const fetch = require("node-fetch"); // package.json: "node-fetch": "^2.6.x"

const app = express();
app.use(cors());
app.use(express.json());

// ---------- Statik dosyalar (index.html, payment.html, validation-key.txt vs.)
app.use(express.static(__dirname));

// ---------- Validation Key (iki kaynaktan da çalışsın)
app.get("/validation-key.txt", (req, res) => {
  const key = process.env.VALIDATION_KEY;
  res.type("text/plain");
  if (key && typeof key === "string") {
    return res.send(key.trim());
  }
  return res.sendFile(path.join(__dirname, "validation-key.txt"), (err) => {
    if (err) res.status(404).send("validation-key not found");
  });
});

// ---------- Sağlık & metadata
app.get("/health", (req, res) => res.json({ ok: true }));
app.get("/metadata", (req, res) => {
  res.json({
    name: "Spiritual Academy",
    description: "Mainnet backend",
    url: "https://spiritualacademy.work",
  });
});

// ---------- Pi Payments ----------
const API_KEY = process.env.API_KEY; // Render -> Environment Variable (MAINNET key)
const PI_API = "https://api.minepi.com/v2";

if (!API_KEY) {
  console.error("ERROR: API_KEY is missing!");
  process.exit(1);
}

// Küçük yardımcı: Pi API çağrısı (hata/log yönetimi ile)
async function piFetch(pathname, opts = {}) {
  const url = `${PI_API}${pathname}`;
  const headers = Object.assign({}, opts.headers || {}, {
    Authorization: `Key ${API_KEY}`,
    "Content-Type": "application/json",
  });
  const res = await fetch(url, Object.assign({}, opts, { headers }));
  const text = await res.text().catch(() => "");
  let data;
  try { data = JSON.parse(text); } catch (e) { data = text; }
  return { ok: res.ok, status: res.status, data };
}

// 1) Approve (SDK akışına göre opsiyonel ama hazır dursun)
app.post("/approve-payment", async (req, res) => {
  try {
    const { paymentId } = req.body || {};
    if (!paymentId) return res.status(400).json({ error: "paymentId missing" });

    const r = await piFetch(`/payments/${paymentId}/approve`, { method: "POST" });
    console.log("approve-payment:", paymentId, r.status);
    if (!r.ok) return res.status(r.status || 500).json(r.data);
    res.json({ ok: true, data: r.data });
  } catch (e) {
    console.error("approve-payment error:", e);
    res.status(500).json({ error: "approve-failed" });
  }
});

// 2) Complete + DOĞRULAMA
app.post("/complete-payment", async (req, res) => {
  try {
    const { paymentId, txid } = req.body || {};
    if (!paymentId) return res.status(400).json({ error: "paymentId required" });

    // Complete isteği
    const complete = await piFetch(`/payments/${paymentId}/complete`, {
      method: "POST",
      body: txid ? JSON.stringify({ txid }) : undefined,
    });
    console.log("complete-payment:", paymentId, complete.status);
    if (!complete.ok) return res.status(complete.status || 500).json(complete.data);

    // Ödeme detaylarını çek ve doğrula
    const detail = await piFetch(`/payments/${paymentId}`, { method: "GET" });
    if (!detail.ok) {
      console.warn("detail-fetch-failed:", paymentId, detail.status, detail.data);
      return res.json({ ok: true, note: "completed but detail-fetch-failed", data: complete.data });
    }

    const p = detail.data || {};
    console.log("payment-detail:", JSON.stringify(p));

    // ---- Zorunlu doğrulamalar ----
    const status = (p.status || p.state || "").toString().toLowerCase();
    if (!/completed|approved/.test(status)) {
      return res.status(400).json({ error: "payment-not-completed", detail: p });
    }

    // Ağ kontrolü (mainnet)
    if (p.network && typeof p.network === "string") {
      const net = p.network.toLowerCase();
      if (!net.includes("main")) {
        return res.status(400).json({ error: "wrong-network", detail: p });
      }
    }

    // (Opsiyonel) Beklenen tutar kontrolü örneği:
    // if (Number(p.amount) !== 5.99) {
    //   return res.status(400).json({ error: "wrong-amount", detail: p });
    // }

    // Buraya geldiğinde ödeme başarıyla doğrulandı.
    // TODO: veritabanına kaydet / kullanıcıya premium yetki ver vb.
    return res.json({ ok: true, data: p });
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

    const r = await piFetch(`/payments/${paymentId}/cancel`, { method: "POST" });
    console.log("cancel-payment:", paymentId, r.status);
    if (!r.ok) return res.status(r.status || 500).json(r.data);
    res.json({ ok: true, data: r.data });
  } catch (e) {
    console.error("cancel-payment error:", e);
    res.status(500).json({ error: "cancel-failed" });
  }
});

// ---------- Sunucu ----------
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("Server listening on", PORT));
