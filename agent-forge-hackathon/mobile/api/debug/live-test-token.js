import { randomUUID } from 'node:crypto';
import twilio from 'twilio';

const { AccessToken } = twilio.jwt;
const { VoiceGrant } = AccessToken;

function sendJson(response, status, payload) {
  response.statusCode = status;
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Headers', 'content-type');
  response.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  response.setHeader('Content-Type', 'application/json');
  response.end(JSON.stringify(payload));
}

function requestOrigin(request) {
  const host = request.headers['x-forwarded-host'] || request.headers.host;
  const proto = request.headers['x-forwarded-proto'] || 'https';
  return `${proto}://${host}`;
}

export default function handler(request, response) {
  if (request.method === 'OPTIONS') {
    sendJson(response, 204, {});
    return;
  }

  if (request.method !== 'GET') {
    sendJson(response, 405, { error: 'Method not allowed' });
    return;
  }

  const required = {
    TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
    TWILIO_API_KEY_SID: process.env.TWILIO_API_KEY_SID,
    TWILIO_API_KEY_SECRET: process.env.TWILIO_API_KEY_SECRET,
    TWILIO_TWIML_APP_SID: process.env.TWILIO_TWIML_APP_SID,
  };
  const missing = Object.entries(required)
    .filter(([, value]) => !value)
    .map(([name]) => name);

  if (missing.length > 0) {
    sendJson(response, 500, {
      error: 'Missing Twilio Voice SDK configuration',
      missing,
      mode: 'twilio-voice-sdk-live-test',
    });
    return;
  }

  const identity = `jaga-browser-${randomUUID().slice(0, 8)}`;
  const token = new AccessToken(
    required.TWILIO_ACCOUNT_SID,
    required.TWILIO_API_KEY_SID,
    required.TWILIO_API_KEY_SECRET,
    { identity, ttl: 3600 },
  );
  token.addGrant(new VoiceGrant({ outgoingApplicationSid: required.TWILIO_TWIML_APP_SID }));

  sendJson(response, 200, {
    mode: 'twilio-voice-sdk-live-test',
    identity,
    token: token.toJwt(),
    connectParams: {
      Source: 'browser-microphone',
    },
    twimlAppWebhook: `${requestOrigin(request)}/api/twilio/browser-voice`,
  });
}
