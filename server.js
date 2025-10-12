// server.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const fetch = require("node-fetch"); // ^2.6.x
const fs = require("fs"); // ← (ADD) i18n dosyaları için

const app = express();
app.use(cors());
app.use(express.json());

// ---------- Statik dosyalar ----------
app.use(express.static(__dirname));

// Kök: index.html
app.get("/", (req, res) => {
  return res.sendFile(path.join(__dirname, "index.html"));
});

// Ödeme sayfası: payment.html
app.get("/payment.html", (req, res) => {
  return res.sendFile(path.join(__dirname, "payment.html"));
});

// Eski adları kırmayalım:
app.get("/dizin.html", (req, res) => res.redirect("/"));
app.get("/odeme.html", (req, res) => res.redirect("/payment.html"));

/* =========================
   (ADD) I18N – Çok dillilik
   ========================= */
const SUPPORTED_LANGS = ["en", "tr", "de", "zh", "ru"];

/** İstekten uygun dili seçer (query.lang > Accept-Language > en). */
function pickLang(req) {
  const q = (req.query.lang || "").toLowerCase();
  if (SUPPORTED_LANGS.includes(q)) return q;

  const al = (req.headers["accept-language"] || "").toLowerCase();
  const parts = al.split(",").map(s => s.split(";")[0].trim());
  for (const p of parts) {
    if (SUPPORTED_LANGS.includes(p)) return p;
    const base = p.split("-")[0];
    if (SUPPORTED_LANGS.includes(base)) return base;
  }
  return "en";
}

/** İstenen dilin JSON'unu gönder (yoksa en.json). */
function sendLocale(res, lang) {
  const file = path.join(__dirname, "locales", `${lang}.json`);
  res.set("Cache-Control", "public, max-age=3600");
  if (fs.existsSync(file)) return res.sendFile(file);
  return res.sendFile(path.join(__dirname, "locales", "en.json"));
}

// Otomatik dil algılayan endpoint
app.get("/i18n/auto.json", (req, res) => {
  const lang = pickLang(req);
  return sendLocale(res, lang);
});

// Dil kodu ile alan endpoint (en, tr, de, zh, ru)
app.get("/i18n/:lang.json", (req, res) => {
  const lang = (req.params.lang || "").toLowerCase();
  const chosen = SUPPORTED_LANGS.includes(lang) ? lang : "en";
  return sendLocale(res, chosen);
});
/* ====== I18N SON ====== */

// ---------- Validation Key ----------
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

// ---------- Sağlık & metadata ----------
app.get("/health", (req, res) => res.json({ ok: true }));
app.get("/metadata", (req, res) => {
  res.json({
    name: "Spiritual Academy",
    description: "Mainnet backend",
    url: "https://spiritualacademy.work",
  });
});

// ---------- Pi Payments ----------
const API_KEY = process.env.API_KEY; // Render → Environment: API_KEY
const PI_API = "https://api.minepi.com/v2"; // Mainnet

if (!API_KEY) {
  console.error("ERROR: API_KEY is missing!");
  process.exit(1);
}

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

// 1) Approve
app.post("/approve-payment", async (req, res) => {
  try {
    const { paymentId } = req.body || {};
    if (!paymentId) return res.status(400).json({ error: "paymentId missing" });

    const r = await piFetch(`/payments/${paymentId}/approve`, { method: "POST" });
    console.log("approve-payment:", paymentId, r.status);
    if (!r.ok) return res.status(r.status || 500).json(r.data);
    return res.json({ ok: true, data: r.data });
  } catch (e) {
    console.error("approve-payment error:", e);
    return res.status(500).json({ error: "approve-failed" });
  }
});

// 2) Complete (+ esnek doğrulama, her durumda 200 döner)
app.post("/complete-payment", async (req, res) => {
  try {
    const { paymentId, txid } = req.body || {};
    if (!paymentId) return res.status(400).json({ error: "paymentId required" });

    const complete = await piFetch(`/payments/${paymentId}/complete`, {
      method: "POST",
      body: txid ? JSON.stringify({ txid }) : undefined,
    });
    console.log("complete-payment:", paymentId, complete.status);
    if (!complete.ok) {
      // Pi API gecikmeleri/yeniden denemeleri kullanıcıya hata olarak dönmesin
      return res.status(200).json({ ok: true, note: "complete-accepted", data: complete.data });
    }

    // İsteğe bağlı: ödeme detayını çek
    const detail = await piFetch(`/payments/${paymentId}`, { method: "GET" });
    if (!detail.ok) {
      console.warn("detail-fetch-failed:", paymentId, detail.status);
      return res.status(200).json({ ok: true, note: "completed; detail fetch failed", data: complete.data });
    }

    const p = detail.data || {};
    // Ağı/tutarı katı doğrulamak istersen ileride burada kontrol edebilirsin.

    return res.status(200).json({ ok: true, data: p });
  } catch (e) {
    console.error("complete-payment error:", e);
    return res.status(200).json({ ok: true, note: "complete-error-bypassed" }); // UX için hata yerine 200
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
    return res.json({ ok: true, data: r.data });
  } catch (e) {
    console.error("cancel-payment error:", e);
    return res.status(500).json({ error: "cancel-failed" });
  }
});

// ---------- Sunucu ----------
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("Server listening on", PORT));
