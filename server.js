const express = require("express");
const cors = require("cors");
const fs = require("fs");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 10000;

app.get("/", (req, res) => {
  res.send("LeafletPro Backend Running");
});

app.post("/order", (req, res) => {
  const order = req.body;

  let orders = [];
  if (fs.existsSync("orders.json")) {
    orders = JSON.parse(fs.readFileSync("orders.json"));
  }

  orders.push(order);

  fs.writeFileSync("orders.json", JSON.stringify(orders, null, 2));

  res.json({ success: true });
});

app.get("/orders", (req, res) => {
  if (!fs.existsSync("orders.json")) {
    return res.json([]);
  }

  const orders = JSON.parse(fs.readFileSync("orders.json"));
  res.json(orders);
});

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
