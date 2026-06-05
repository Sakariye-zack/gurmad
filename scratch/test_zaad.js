const merchantUid = 'M0913870';
const apiUserId = '1007991';
const apiKey = 'API-1650550641AHX';

const payload = {
  schemaVersion: "1.0",
  requestId: "REQ-" + Date.now(),
  timestamp: new Date().toISOString(),
  channelName: "WEB",
  serviceName: "API_PURCHASE",
  serviceParams: {
    merchantUid,
    apiUserId,
    apiKey,
    paymentMethod: "MWALLET_ACCOUNT",
    payerInfo: {
      accountNo: "252634362751" // the phone number from the user's screenshot
    },
    transactionInfo: {
      referenceId: "REF-" + Date.now(),
      invoiceId: "INV-" + Date.now(),
      amount: "7",
      currency: "USD",
      description: "Test Payment"
    }
  }
};

fetch('https://api.waafipay.net/asm', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload)
})
.then(res => res.json())
.then(data => console.log('RESPONSE:', JSON.stringify(data, null, 2)))
.catch(err => console.error('ERROR:', err));
