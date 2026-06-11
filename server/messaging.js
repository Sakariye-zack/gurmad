const twilio = require('twilio');

// Load env vars, or use mock if not present
const accountSid = process.env.TWILIO_ACCOUNT_SID || 'AC_mock_sid';
const authToken = process.env.TWILIO_AUTH_TOKEN || 'mock_token';
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER || '+1234567890';
const twilioWhatsAppNumber = process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886';

const isMock = accountSid === 'AC_mock_sid';

let client;
if (!isMock) {
  client = twilio(accountSid, authToken);
}

/**
 * Sends an SMS message using Twilio.
 * @param {string} to - The recipient's phone number.
 * @param {string} body - The text message.
 */
async function sendSMS(to, body) {
  if (isMock) {
    console.log(`[MOCK SMS] To: ${to} | Message: ${body}`);
    return { success: true, mock: true, sid: 'SM_mock_' + Date.now() };
  }

  try {
    const message = await client.messages.create({
      body: body,
      from: twilioPhoneNumber,
      to: to
    });
    console.log(`[Twilio SMS] Sent to ${to}. SID: ${message.sid}`);
    return { success: true, mock: false, sid: message.sid };
  } catch (error) {
    console.error(`[Twilio SMS Error] Failed to send SMS to ${to}:`, error.message);
    throw error;
  }
}

/**
 * Sends a WhatsApp message using Twilio.
 * @param {string} to - The recipient's phone number (without 'whatsapp:' prefix).
 * @param {string} body - The text message.
 */
async function sendWhatsApp(to, body) {
  const toWhatsApp = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;
  
  if (isMock) {
    console.log(`[MOCK WhatsApp] To: ${toWhatsApp} | Message: ${body}`);
    return { success: true, mock: true, sid: 'SM_mock_' + Date.now() };
  }

  try {
    const message = await client.messages.create({
      body: body,
      from: twilioWhatsAppNumber,
      to: toWhatsApp
    });
    console.log(`[Twilio WhatsApp] Sent to ${toWhatsApp}. SID: ${message.sid}`);
    return { success: true, mock: false, sid: message.sid };
  } catch (error) {
    console.error(`[Twilio WhatsApp Error] Failed to send WhatsApp to ${toWhatsApp}:`, error.message);
    throw error;
  }
}

module.exports = {
  sendSMS,
  sendWhatsApp,
  isMock
};
