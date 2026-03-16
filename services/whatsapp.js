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

  console.log("Sending WhatsApp message →", to);
  console.log("Message body →", body);

  try {

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: to,
        type: "text",
        text: {
          body: body
        }
      })
    });

    const data = await response.json();

    console.log("WhatsApp API response:", data);

    if (!response.ok) {
      console.error("WhatsApp send error:", data);
      throw new Error(`WhatsApp send failed`);
    }

    return data;

  } catch (error) {

    console.error("WhatsApp API call failed:", error.message);
    throw error;

  }
}

module.exports = {
  sendTextMessage
};