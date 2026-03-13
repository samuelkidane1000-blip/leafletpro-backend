const express = require("express");
const cors = require("cors");
const fs = require("fs");
require("dotenv").config();

const Stripe = require("stripe");
const nodemailer = require("nodemailer");

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 10000;

app.get("/", (req, res) => {
  res.send("LeafletPro Backend Running");
});

app.post("/api/quote", (req, res) => {
  const {
    postcode = "",
    quantity = 1000,
    deliveryType = "shared",
    trackedDistribution = false,
    printIncluded = false,
    designNeeded = false
  } = req.body || {};

  const qty = Number(quantity) || 1000;

  let ratePerThousand = 55;
  if (qty >= 5000) ratePerThousand = 42;
  if (qty >= 10000) ratePerThousand = 36;
  if (qty >= 20000) ratePerThousand = 32;

  const distributionCost = (qty / 1000) * ratePerThousand;
  const printCost = printIncluded ? (qty / 1000) * 18 : 0;
  const trackingCost = trackedDistribution ? 25 : 0;
  const designCost = designNeeded ? 65 : 0;
  const setupCost = 15;
  const priorityCost = deliveryType === "solus" ? 40 : 0;

  const subtotal = distributionCost + printCost + trackingCost + designCost + setupCost + priorityCost;
  const vatCost = subtotal * 0.2;
  const totalCost = subtotal + vatCost;

  res.json({
    postcode,
    zoneKey: postcode.slice(0, 2).toUpperCase() || "LD",
    zoneName: "London Delivery Zone",
    distributionCost,
    printCost,
    trackingCost,
    designCost,
    setupCost,
    priorityCost,
    subtotalCost: subtotal,
    vatCost,
    totalCost,
    estimatedHomes: Math.round(qty * 0.92),
    estimatedDays: deliveryType === "solus" ? "2-3 days" : "5-7 days",
    ratePerThousand,
    summaryZone: "London Delivery Zone",
    summaryInsight: "Tracked distribution with live quote pricing"
  });
});

app.post("/order", (req, res) => {
  const order = req.body || {};

  let orders = [];
  if (fs.existsSync("orders.json")) {
    orders = JSON.parse(fs.readFileSync("orders.json"));
  }

  orders.push(order);
  fs.writeFileSync("orders.json", JSON.stringify(orders, null, 2));

  transporter.sendMail(
    {
      from: process.env.EMAIL_USER,
      to: process.env.EMAIL_USER,
      subject: "New LeafletPro Order",
      text:
        "New order received\n\n" +
        "Postcode: " + (order.postcode || "") + "\n" +
        "Quantity: " + (order.quantity || "") + "\n" +
        "Total: £" + (order.totalCost || "0") + "\n" +
        "Delivery: " + (order.deliveryType || "") + "\n" +
        "Email: " + (order.email || "") + "\n" +
        "Phone: " + (order.phone || "")
    },
    (error, info) => {
      if (error) {
        console.error("Email send error:", error);
      } else {
        console.log("Email sent:", info.response);
      }
    }
  );

  res.json({ success: true });
});

app.get("/orders", (req, res) => {
  if (!fs.existsSync("orders.json")) {
    return res.json([]);
  }

  const orders = JSON.parse(fs.readFileSync("orders.json"));
  res.json(orders);
});

app.post("/create-checkout", async (req, res) => {
  try {
    const { amount } = req.body;

    if (!amount || amount < 50) {
      return res.status(400).json({ error: "Invalid amount" });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "gbp",
            product_data: {
              name: "Leaflet Distribution Booking"
            },
            unit_amount: amount
          },
          quantity: 1
        }
      ],
      success_url: "https://leafletpro-website-1.onrender.com/?success=true",
      cancel_url: "https://leafletpro-website-1.onrender.com/?cancel=true"
    });

    return res.json({ id: session.id });
  } catch (error) {
    console.error("Stripe checkout error:", error);
    return res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
