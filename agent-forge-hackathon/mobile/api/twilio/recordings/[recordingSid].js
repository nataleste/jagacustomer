import { Readable } from 'node:stream';

function sendJson(response, status, payload) {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json');
  response.end(JSON.stringify(payload));
}

function authHeader(username, password) {
  return `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
}

export default async function handler(request, response) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.statusCode = 405;
    response.setHeader('Allow', 'GET,HEAD');
    response.end('Method not allowed');
    return;
  }

  const recordingSid = String(request.query.recordingSid || '').replace(/\.mp3$/i, '');
  if (!/^RE[a-f0-9]{32}$/i.test(recordingSid || '')) {
    sendJson(response, 400, { error: 'Invalid recording SID' });
    return;
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const apiKeySid = process.env.TWILIO_API_KEY_SID;
  const apiKeySecret = process.env.TWILIO_API_KEY_SECRET;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const username = apiKeySid || accountSid;
  const password = apiKeySecret || authToken;
  if (!accountSid || !username || !password) {
    sendJson(response, 500, { error: 'Missing Twilio playback configuration' });
    return;
  }

  const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Recordings/${recordingSid}.mp3`;
  const headers = {
    Authorization: authHeader(username, password),
  };
  if (request.headers.range) {
    headers.Range = request.headers.range;
  }

  const twilioResponse = await fetch(twilioUrl, { headers, method: request.method });
  if (!twilioResponse.ok && twilioResponse.status !== 206) {
    sendJson(response, twilioResponse.status, { error: 'Recording media unavailable' });
    return;
  }

  response.statusCode = twilioResponse.status;
  response.setHeader('Content-Type', twilioResponse.headers.get('content-type') || 'audio/mpeg');
  response.setHeader('Cache-Control', 'private, max-age=300');
  for (const header of ['content-length', 'content-range', 'accept-ranges']) {
    const value = twilioResponse.headers.get(header);
    if (value) response.setHeader(header, value);
  }

  if (request.method === 'HEAD' || !twilioResponse.body) {
    response.end();
    return;
  }

  Readable.fromWeb(twilioResponse.body).pipe(response);
}
