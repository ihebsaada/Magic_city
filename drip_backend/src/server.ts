import "dotenv/config";
import express from "express";
import cors from "cors";

import collectionRoutes from "./routes/collectionRoutes";
import productRoutes from "./routes/productRoutes";
import { stripeWebhook } from "./controllers/stripeWebhookController";
import { getCollectionBrands } from "./controllers/collectionController";
import orderRoutes from "./routes/orderRoutes";
import adminAuthRoutes from "./routes/adminAuthRoutes";
import adminDiscountRouter from "./routes/discountRoutes";
// src/server.ts

const app = express();

app.use(cors());

app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  stripeWebhook,
);

app.use(express.json());

// Juste pour tester
app.get("/", (_req, res) => {
  res.send("Magic City Drip API 🧥👟👜");
});
app.use("/api", adminAuthRoutes);
app.use("/api", collectionRoutes);
app.use("/api", productRoutes);
app.use("/api", orderRoutes);
app.use("/api/admin", adminDiscountRouter);
app.use("/api", adminDiscountRouter);

app.get("/api/collections/:handle/brands", getCollectionBrands);

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
