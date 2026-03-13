require("dotenv").config();
const express = require("express");
const webhookRouter = require("./routes/webhook");

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/", webhookRouter);

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
