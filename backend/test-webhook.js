const axios = require('axios');

// We need to send application/x-www-form-urlencoded data to simulate Twilio
const params = new URLSearchParams();
params.append('From', 'whatsapp:+916304230058'); // Change this to the donor's phone number
params.append('Body', 'admin'); // The message content


const config = {
  method: 'post',
  url: 'http://127.0.0.1:3000/api/webhook/twilio',
  headers: { 
    'Content-Type': 'application/x-www-form-urlencoded'
  },
  data: params
};

console.log("Sending simulated Twilio webhook to localhost...");

axios(config)
.then(function (response) {
  console.log("Webhook Response Status:", response.status);
  console.log("Webhook Response Data:", response.data);
})
.catch(function (error) {
  console.error("Error sending webhook:");
  console.error(error);
});
