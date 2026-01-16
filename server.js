import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();
const app = express();
app.use(express.json());

// In-memory DB (testing)
const ORDERS = {};

/* ======================
   ORDER CREATE API
====================== */
app.post("/api/order/create", async (req, res) => {
  const { user_id, amount } = req.body;

  const order_id = "ORD_" + Date.now();

  const response = await fetch("https://api.cashfree.com/pg/orders", {
    method: "POST",
    headers: {
      "x-client-id": process.env.CASHFREE_APP_ID,
      "x-client-secret": process.env.CASHFREE_SECRET,
      "x-api-version": "2023-08-01",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      order_id,
      order_amount: amount,
      order_currency: "INR",
      customer_details: {
        customer_id: user_id,
        customer_phone: "9999999999"
      },
      order_meta: {
        return_url:
          `https://yourdomain.com/api/payment/success?order_id=${order_id}`
      }
    })
  });

  const data = await response.json();

  ORDERS[order_id] = {
    user_id,
    status: "CREATED",
    amount
  };

  res.json({
    success: true,
    order_id,
    payment_link: data.payment_link
  });
});

/* ======================
   PAYMENT LINK API
====================== */
app.get("/api/payment/link", (req, res) => {
  const { order_id } = req.query;

  if (!ORDERS[order_id]) {
    return res.json({ success: false, message: "Invalid Order" });
  }

  res.json({
    success: true,
    payment_link: ORDERS[order_id].payment_link
  });
});

/* ======================
   CASHFREE WEBHOOK
====================== */
app.post("/api/webhook/cashfree", (req, res) => {
  const event = req.body;

  const orderId = event?.data?.order?.order_id;

  if (!ORDERS[orderId]) return res.sendStatus(200);

  if (event.type === "PAYMENT_SUCCESS") {
    ORDERS[orderId].status = "PAID";
  }

  if (event.type === "PAYMENT_FAILED") {
    ORDERS[orderId].status = "FAILED";
  }

  res.sendStatus(200);
});

/* ======================
   ORDER STATUS API
====================== */
app.get("/api/order/status", (req, res) => {
  const { order_id } = req.query;

  if (!ORDERS[order_id]) {
    return res.json({ success: false });
  }

  res.json({
    success: true,
    status: ORDERS[order_id].status
  });
});

/* ======================
   SUCCESS REDIRECT
====================== */
app.get("/api/payment/success", (req, res) => {
  const { order_id } = req.query;

  res.send(`
    <h2>✅ Payment Successful</h2>
    <p>Order ID: ${order_id}</p>
  `);
});

/* ======================
   FAILED REDIRECT
====================== */
app.get("/api/payment/failed", (req, res) => {
  res.send("<h2>❌ Payment Failed</h2>");
});

app.listen(process.env.PORT, () => {
  console.log("Payment API running on port", process.env.PORT);
});
