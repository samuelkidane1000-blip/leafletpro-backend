const express = require("express");
const cors = require("cors");
const fs = require("fs");
require("dotenv").config();

const Stripe = require("stripe");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 10000;

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const ORDERS_FILE = "orders.json";
const USERS_FILE = "users.json";

function readJsonFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      return [];
    }

    const raw = fs.readFileSync(filePath, "utf8");

    if (!raw.trim()) {
      return [];
    }

    return JSON.parse(raw);
  } catch (error) {
    console.error(`Error reading ${filePath}:`, error);
    return [];
  }
}

function writeJsonFile(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error(`Error writing ${filePath}:`, error);
    throw error;
  }
}

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
  try {
    const order = req.body || {};
    const orders = readJsonFile(ORDERS_FILE);

    const newOrder = {
      id: Date.now(),
      ...order,
      createdAt: new Date().toISOString()
    };

    orders.push(newOrder);
    writeJsonFile(ORDERS_FILE, orders);

    res.json({ success: true, order: newOrder });
  } catch (error) {
    console.error("Order save error:", error);
    res.status(500).json({ success: false });
  }
});

app.get("/orders", (req, res) => {
  try {
    const orders = readJsonFile(ORDERS_FILE);
    res.json(orders);
  } catch (error) {
    console.error("Orders fetch error:", error);
    res.status(500).json([]);
  }
});

app.post("/signup", (req, res) => {
  try {
    const {
      firstName = "",
      lastName = "",
      company = "",
      email = "",
      phone = "",
      businessType = "",
      password = ""
    } = req.body || {};

    if (!firstName || !lastName || !company || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields"
      });
    }

    const users = readJsonFile(USERS_FILE);

    const existingUser = users.find(
      (user) => String(user.email).toLowerCase() === String(email).toLowerCase()
    );

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Email already exists"
      });
    }

    const newUser = {
      id: Date.now(),
      firstName,
      lastName,
      company,
      email,
      phone,
      businessType,
      password,
      plan: "starter",
      createdAt: new Date().toISOString()
    };

    users.push(newUser);
    writeJsonFile(USERS_FILE, users);

    res.json({
      success: true,
      message: "Account created",
      user: newUser
    });
  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({
      success: false,
      message: "Signup failed"
    });
  }
});

app.get("/users", (req, res) => {
  try {
    const users = readJsonFile(USERS_FILE);
    res.json(users);
  } catch (error) {
    console.error("Users fetch error:", error);
    res.status(500).json([]);
  }
});

app.post("/create-checkout", async (req, res) => {
  try {
    const { amount } = req.body || {};

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

    res.json({ id: session.id });
  } catch (error) {
    console.error("Stripe checkout error:", error);
    res.status(500).json({ error: error.message });
  }
});
// SaaS login
app.post("/login", (req, res) => {

  const { email, password } = req.body;

  const users = readJsonFile(USERS_FILE);

  const user = users.find(
    u => u.email === email && u.password === password
  );

  if (!user) {
    return res.json({
      success: false,
      message: "Invalid email or password"
    });
  }

  res.json({
    success: true,
    user
  });

});
app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
