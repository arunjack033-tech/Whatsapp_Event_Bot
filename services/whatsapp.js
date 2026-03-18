function getWhatsAppConfig() {
  const apiVersion = process.env.WHATSAPP_API_VERSION || "v20.0";
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!phoneNumberId || !accessToken) {
    throw new Error(
      "Missing WhatsApp configuration. Set WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN."
    );
  }

  return {
    accessToken,
    apiVersion,
    phoneNumberId
  };
}

async function sendTextMessage(to, body) {
  const { accessToken, apiVersion, phoneNumberId } = getWhatsAppConfig();
  const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;

  console.log("Sending WhatsApp message to:", to);
  console.log("Message body:", body);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "text",
        text: {
          preview_url: false,
          body
        }
      })
    });

    const data = await response.json();

    console.log("WhatsApp API response:", data);

    if (!response.ok) {
      console.error("WhatsApp send error:", data);
      throw new Error(data?.error?.message || "WhatsApp send failed");
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
