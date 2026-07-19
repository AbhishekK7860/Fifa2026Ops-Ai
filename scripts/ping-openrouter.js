require('dotenv').config({ path: '.env.local' });
const key = process.env.OPENROUTER_API_KEY;

// Try fallback model
const body = JSON.stringify({
  model: 'nousresearch/hermes-3-llama-3.1-405b:free',
  messages: [
    { role: 'system', content: 'You are a JSON generator. Always respond with valid JSON.' },
    { role: 'user', content: 'Respond with exactly this JSON: {"status":"ok","ping":"pong"}' }
  ],
  response_format: { type: 'json_object' },
  temperature: 0.1
});

const https = require('https');
const opts = {
  hostname: 'openrouter.ai',
  path: '/api/v1/chat/completions',
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + key,
    'Content-Type': 'application/json',
    'HTTP-Referer': 'https://stadiumops.ai',
    'X-Title': 'StadiumOps AI',
    'Content-Length': Buffer.byteLength(body)
  }
};

const req = https.request(opts, res => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    try {
      const j = JSON.parse(d);
      console.log('HTTP_STATUS:', res.statusCode);
      console.log('MODEL_USED:', j.model);
      console.log('CONTENT:', j.choices?.[0]?.message?.content);
      if (j.error) console.log('FULL_ERROR:', JSON.stringify(j.error));
    } catch(e) { console.log('PARSE_ERROR:', d.substring(0, 600)); }
  });
});
req.on('error', e => console.log('NETWORK_ERROR:', e.message));
req.write(body);
req.end();
