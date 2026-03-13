require("dotenv").config();
const express = require("express");
const webhookRouter = require("./routes/webhook");

const app = express();

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/", webhookRouter);

module.exports = app;
