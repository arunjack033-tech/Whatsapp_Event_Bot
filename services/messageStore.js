const MAX_MESSAGES = 100;

const state = {
  latestMessage: "No message yet",
  messages: []
};

function addMessage(direction, phoneNumber, text, meta = {}) {
  const safeText = text || "(empty)";

  state.latestMessage = `${phoneNumber}: ${safeText}`;
  state.messages.push({
    direction,
    meta,
    phoneNumber,
    text: safeText,
    timestamp: new Date().toISOString()
  });

  if (state.messages.length > MAX_MESSAGES) {
    state.messages.splice(0, state.messages.length - MAX_MESSAGES);
  }
}

function getLatestMessage() {
  return state.latestMessage;
}

function getMessages() {
  return [...state.messages];
}

module.exports = {
  addMessage,
  getLatestMessage,
  getMessages
};
