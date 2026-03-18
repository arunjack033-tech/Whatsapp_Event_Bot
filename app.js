require("dotenv").config();
const express = require("express");
const webhookRouter = require("./routes/webhook");
const { getLatestMessage, getMessages } = require("./services/messageStore");

const app = express();

app.use(express.json({ type: ["application/json", "application/*+json", "text/plain"] }));
app.use(express.urlencoded({ extended: true }));

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/debug/messages", (_req, res) => {
  res.json({
    latestMessage: getLatestMessage(),
    messages: getMessages()
  });
});

app.use("/", webhookRouter);

app.get("/", (_req, res) => {
  const messages = getMessages()
    .map((message) => {
      const side = message.direction === "outgoing" ? "right" : "left";
      const bg = message.direction === "outgoing" ? "#dcf8c6" : "#ffffff";
      const label = message.direction === "outgoing" ? "Bot" : message.phoneNumber;
      const time = new Date(message.timestamp).toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit"
      });
      const text = escapeHtml(message.text);

      return `
        <div style="display:flex;justify-content:${side === "right" ? "flex-end" : "flex-start"};margin:10px 0;">
          <div style="max-width:70%;background:${bg};padding:12px 14px;border-radius:14px;box-shadow:0 1px 2px rgba(0,0,0,.08);">
            <div style="font-size:12px;color:#667781;margin-bottom:6px;">${escapeHtml(label)}</div>
            <div style="white-space:pre-wrap;font-size:15px;color:#111b21;">${text}</div>
            <div style="font-size:11px;color:#667781;text-align:right;margin-top:6px;">${time}</div>
          </div>
        </div>
      `;
    })
    .join("");

  res.send(`
    <html>
      <head>
        <meta charset="utf-8" />
        <meta http-equiv="refresh" content="2" />
        <title>WhatsApp Event Bot Live</title>
      </head>
      <body style="margin:0;font-family:Segoe UI,Arial,sans-serif;background:#efeae2;">
        <div style="background:#075e54;color:white;padding:16px 20px;font-size:20px;font-weight:600;position:sticky;top:0;">
          WhatsApp Event Bot Live
          <div style="font-size:12px;font-weight:400;opacity:.9;margin-top:4px;">Latest: ${escapeHtml(getLatestMessage())}</div>
        </div>
        <div style="max-width:980px;margin:0 auto;padding:20px;">
          ${messages || '<div style="text-align:center;color:#667781;padding:40px;">No messages yet</div>'}
        </div>
      </body>
    </html>
  `);
});

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

module.exports = app;
