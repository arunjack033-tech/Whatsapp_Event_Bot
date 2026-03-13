const WHATSAPP_API_VERSION = process.env.WHATSAPP_API_VERSION || "v20.0";
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;

if (!WHATSAPP_PHONE_NUMBER_ID || !WHATSAPP_ACCESS_TOKEN) {
  throw new Error(
    "Missing WhatsApp configuration. Set WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN."
  );
}

async function sendTextMessage(to, body) {
  const url = `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${WHATSAPP_PHONE_NUMBER_ID}/messages`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body }
    })
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(`WhatsApp send failed: ${JSON.stringify(data)}`);
  }

  return data;
}

module.exports = {
  sendTextMessage
};
