const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(bodyParser.json());
app.use(cors());

// API KEY ve Secret (Pi Developer Portal'dan aldığın)
const API_KEY = process.env.PI_API_KEY || "BURAYA_API_KEYIN_GELECEK";

// Basit test route
app.get("/", (req, res) => {
  res.send("Pi Backend Çalışıyor 🚀");
});

// Ödeme endpoint (örnek)
app.post("/create-payment", (req, res) => {
  const { amount, memo } = req.body;
  if (!amount) return res.status(400).send("Amount required");

  res.json({
    identifier: "test_payment_123",
    amount,
    memo: memo || "Test Ödemesi",
    status: "created"
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server ${PORT} portunda çalışıyor...`);
});
