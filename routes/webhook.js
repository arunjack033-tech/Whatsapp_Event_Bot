const express = require("express");
const supabase = require("../supabaseClient");
const { sendTextMessage } = require("../services/whatsapp");

const router = express.Router();
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;

const WELCOME_TEXT = `Welcome to Church Event Registration 🙏
1 Register
2 Event Details`;

const EVENT_DETAILS_TEXT = `Church Event Registration:
Date: Sunday, 10:00 AM
Venue: Church Community Hall
Registration fee: ₹300`;

const PAYMENT_LINK = "upi://pay?pa=church@upi&pn=ChurchEvent&am=300";

router.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
});

router.post("/webhook", async (req, res) => {
  try {
    const changes = req.body?.entry?.[0]?.changes?.[0]?.value;
    const messages = changes?.messages || [];

    if (messages.length === 0) {
      return res.sendStatus(200);
    }

    const message = messages[0];
    const from = message.from;

    if (!from) {
      return res.sendStatus(200);
    }

    await handleIncomingMessage(from, message);
    return res.sendStatus(200);
  } catch (error) {
    console.error("Webhook processing error:", error.message);
    return res.sendStatus(500);
  }
});

router.get("/admin/registrations", async (req, res) => {
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

    if (error) {
      throw error;
    }

    return res.json({ registrations: data });
  } catch (error) {
    console.error("Admin list error:", error.message);
    return res.status(500).json({ error: "Failed to fetch registrations" });
  }
});

async function handleIncomingMessage(phoneNumber, message) {
  const messageType = message.type;
  const text =
    messageType === "text"
      ? (message.text?.body || "").trim()
      : messageType === "image"
        ? "[image]"
        : messageType === "document"
          ? "[document]"
          : "";

  if (!text) {
    return;
  }

  const lowered = text.toLowerCase();

  if (lowered === "hi" || lowered === "hello") {
    await sendTextMessage(phoneNumber, WELCOME_TEXT);
    return;
  }

  if (text === "2") {
    await sendTextMessage(phoneNumber, EVENT_DETAILS_TEXT);
    return;
  }

  if (text === "1") {
    await upsertRegistration(phoneNumber, {
      name: null,
      tshirt_size: null,
      payment_status: "started"
    });
    await sendTextMessage(phoneNumber, "Please enter your name");
    return;
  }

  const registration = await getRegistrationByPhone(phoneNumber);

  if (!registration) {
    await sendTextMessage(phoneNumber, `Please send "Hi" to begin registration.`);
    return;
  }

  if (!registration.name) {
    const name = text.substring(0, 100);
    await upsertRegistration(phoneNumber, {
      name,
      payment_status: "name_collected"
    });
    await sendTextMessage(phoneNumber, "Select your T-shirt size: S / M / L / XL");
    return;
  }

  if (!registration.tshirt_size) {
    const size = text.toUpperCase();
    const allowedSizes = new Set(["S", "M", "L", "XL"]);

    if (!allowedSizes.has(size)) {
      await sendTextMessage(phoneNumber, "Please select a valid size: S / M / L / XL");
      return;
    }

    await upsertRegistration(phoneNumber, {
      tshirt_size: size,
      payment_status: "pending_payment"
    });

    await sendTextMessage(
      phoneNumber,
      `Registration fee ₹300. Click below to pay.\n${PAYMENT_LINK}`
    );
    await sendTextMessage(
      phoneNumber,
      "After payment please send screenshot or UPI transaction ID."
    );
    return;
  }

  if (registration.payment_status !== "paid") {
    await upsertRegistration(phoneNumber, {
      payment_status: "payment_proof_received"
    });
    await sendTextMessage(
      phoneNumber,
      "Payment proof received. Our team will verify and confirm your registration."
    );
    return;
  }
}

async function getRegistrationByPhone(phoneNumber) {
  const { data, error } = await supabase
    .from("registrations")
    .select("name, phone_number, tshirt_size, payment_status, created_at")
    .eq("phone_number", phoneNumber)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

async function upsertRegistration(phoneNumber, fields) {
  const existing = await getRegistrationByPhone(phoneNumber);

  const payload = {
    phone_number: phoneNumber,
    name: fields.name !== undefined ? fields.name : existing?.name || null,
    tshirt_size:
      fields.tshirt_size !== undefined
        ? fields.tshirt_size
        : existing?.tshirt_size || null,
    payment_status:
      fields.payment_status !== undefined
        ? fields.payment_status
        : existing?.payment_status || "started"
  };

  if (existing?.created_at) {
    payload.created_at = existing.created_at;
  }

  const { error } = await supabase
    .from("registrations")
    .upsert(payload, { onConflict: "phone_number" });

  if (error) {
    throw error;
  }
}

module.exports = router;
