const twilio = require('twilio');
require('dotenv').config();

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886';
const toNumber = 'whatsapp:+252634259981';

console.log('Testing Twilio LIVE WhatsApp with:');
console.log('Account SID:', accountSid);
console.log('From:', fromNumber);
console.log('To:', toNumber);

const client = twilio(accountSid, authToken);

client.messages.create({
  from: fromNumber,
  to: toNumber,
  body: 'GURMAD: Kani waa tijaabo WhatsApp ah oo LIVE ah. Haddii aad fariintan heshay, nidaamkaagu wuxuu u shaqaynayaa si sax ah!'
})
.then(message => console.log('Successfully sent! Message SID:', message.sid))
.catch(err => {
  console.error('Failed to send message:');
  console.error(err);
});
