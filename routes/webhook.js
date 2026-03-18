const express = require("express");
const supabase = require("../supabaseClient");
const { sendTextMessage } = require("../services/whatsapp");
const { addMessage } = require("../services/messageStore");

const router = express.Router();
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;

router.get("/test", (req, res) => {
  res.status(200).json({
    status: "Server working",
    message: "WhatsApp Event Bot is running"
  });
});

const WELCOME_TEXT = `Welcome to Church Event Registration
1 Register
2 Event Details`;

const EVENT_DETAILS_TEXT = `Church Event Registration:
Date: Sunday, 10:00 AM
Venue: Church Community Hall
Registration fee: Rs.300`;

const PAYMENT_LINK = "upi://pay?pa=church@upi&pn=ChurchEvent&am=300";
const ALLOWED_SIZES = new Set(["S", "M", "L", "XL"]);
const SUPPORTED_GREETING_TEXT = new Set(["hi", "hello", "hey", "start", "menu"]);

router.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("Webhook verified successfully");
    return res.status(200).send(challenge);
  }

  console.error("Webhook verification failed");
  return res.sendStatus(403);
});

router.post("/webhook", async (req, res) => {
  try {
    console.log("Webhook payload:", JSON.stringify(req.body, null, 2));

    const entry = req.body?.entry?.find((item) => item?.changes?.length);
    const change = entry?.changes?.find((item) => item?.value);
    const value = change?.value;

    if (!value) {
      console.log("Webhook event without value");
      return res.sendStatus(200);
    }

    const message = value.messages?.[0];

    if (!message) {
      console.log(value.statuses?.length ? "Webhook status update received" : "Webhook event without messages");
      return res.sendStatus(200);
    }

    const from = message.from;
    if (!from) {
      console.log("Webhook message missing sender");
      return res.sendStatus(200);
    }

    const incomingText = getIncomingText(message);
    addMessage("incoming", from, incomingText || message.type || "unknown", { type: message.type || "unknown" });

    console.log("Message from:", from);
    console.log("Incoming text:", incomingText);

    try {
      await handleIncomingMessage(from, message);
    } catch (err) {
      console.error("Message handling failed:", err.message);
      addMessage("system", from, `Handler error: ${err.message}`);
    }

    return res.sendStatus(200);
  } catch (error) {
    console.error("Webhook processing error:", error);
    addMessage("system", "webhook", `Webhook processing error: ${error.message}`);
    return res.sendStatus(200);
  }
});

async function handleAdminRegistrations(req, res) {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.replace("Bearer ", "");
    const adminApiKey = process.env.ADMIN_API_KEY;

    if (adminApiKey && token !== adminApiKey) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { data, error } = await supabase
      .from("registrations")
      .select("name, phone_number, tshirt_size, payment_status, created_at")
      .order("created_at", { ascending: false });

    if (error) throw error;

    return res.json({ registrations: data });
  } catch (error) {
    console.error("Admin list error:", error.message);
    return res.status(500).json({ error: "Failed to fetch registrations" });
  }
}

router.get("/admin/registrations", handleAdminRegistrations);
router.get("/webhook/admin/registrations", handleAdminRegistrations);

async function handleIncomingMessage(phoneNumber, message) {
  const messageType = message.type || "unknown";
  const text = getIncomingText(message).trim();
  const lowered = text.toLowerCase();

  console.log("Incoming text:", text);

  try {
    if (SUPPORTED_GREETING_TEXT.has(lowered)) {
      await reply(phoneNumber, WELCOME_TEXT);
      return;
    }

    if (text === "2" || lowered === "event details") {
      await reply(phoneNumber, EVENT_DETAILS_TEXT);
      return;
    }

    if (text === "1" || lowered === "register") {
      await upsertRegistration(phoneNumber, {
        name: null,
        tshirt_size: null,
        payment_status: "started"
      });

      await reply(phoneNumber, "Please enter your name");
      return;
    }

    const registration = await getRegistrationByPhone(phoneNumber);

    if (!registration) {
      if (!text) {
        console.log("Ignoring empty or unsupported message from unregistered user");
        return;
      }

      await reply(phoneNumber, 'Please send "Hi" to begin registration.');
      return;
    }

    if (!registration.name) {
      if (!text) {
        await reply(phoneNumber, "Please type your name to continue registration.");
        return;
      }

      const name = text.substring(0, 100);

      await upsertRegistration(phoneNumber, {
        name,
        payment_status: "name_collected"
      });

      await reply(phoneNumber, "Select your T-shirt size: S / M / L / XL");
      return;
    }

    if (!registration.tshirt_size) {
      if (!text) {
        await reply(phoneNumber, "Please select your T-shirt size: S / M / L / XL");
        return;
      }

      const size = text.toUpperCase();

      if (!ALLOWED_SIZES.has(size)) {
        await reply(phoneNumber, "Please select a valid size: S / M / L / XL");
        return;
      }

      await upsertRegistration(phoneNumber, {
        tshirt_size: size,
        payment_status: "pending_payment"
      });

      await reply(phoneNumber, `Registration fee Rs.300. Click below to pay.\n${PAYMENT_LINK}`);
      await reply(phoneNumber, "After payment please send screenshot, document, or UPI transaction ID.");
      return;
    }

    if (registration.payment_status !== "paid") {
      const isPaymentProofMedia = messageType === "image" || messageType === "document";

      if (!text && !isPaymentProofMedia) {
        await reply(phoneNumber, "Please send screenshot, document, or UPI transaction ID after payment.");
        return;
      }

      await upsertRegistration(phoneNumber, {
        payment_status: "payment_proof_received"
      });

      await reply(phoneNumber, "Payment proof received. Our team will verify and confirm your registration.");
    }
  } catch (err) {
    console.error("Bot logic error:", err.message);
    addMessage("system", phoneNumber, `Bot logic error: ${err.message}`);
  }
}

async function reply(phoneNumber, text) {
  try {
    await sendTextMessage(phoneNumber, text);
    addMessage("outgoing", phoneNumber, text);
  } catch (error) {
    addMessage("system", phoneNumber, `Send failed: ${error.message}`);
    throw error;
  }
}

function getIncomingText(message) {
  const type = message?.type || "unknown";

  if (type === "text") {
    return message.text?.body || "";
  }

  if (type === "button") {
    return message.button?.text || "";
  }

  if (type === "interactive") {
    return (
      message.interactive?.button_reply?.title ||
      message.interactive?.list_reply?.title ||
      ""
    );
  }

  if (type === "image") {
    return "Image received";
  }

  if (type === "document") {
    return "Document received";
  }

  return "";
}

async function getRegistrationByPhone(phoneNumber) {
  const { data, error } = await supabase
    .from("registrations")
    .select("*")
    .eq("phone_number", phoneNumber)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function upsertRegistration(phoneNumber, fields) {
  const payload = {
    phone_number: phoneNumber,
    ...fields
  };

  const { error } = await supabase
    .from("registrations")
    .upsert(payload, { onConflict: "phone_number" });

  if (error) throw error;
}

module.exports = router;
