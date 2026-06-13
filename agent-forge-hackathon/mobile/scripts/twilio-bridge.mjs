import http from 'node:http';
import { randomUUID } from 'node:crypto';
import twilio from 'twilio';

const port = Number.parseInt(process.env.TWILIO_BRIDGE_PORT ?? '8787', 10);
const clients = new Set();
const recentEvents = [];
const startedAtByCallSid = new Map();
const { AccessToken } = twilio.jwt;
const { VoiceGrant } = AccessToken;
let demoRecordingWav;

function send(client, event, payload) {
  client.write(`event: ${event}\n`);
  client.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function broadcast(event, payload) {
  recentEvents.push({
    event,
    payload,
    receivedAt: new Date().toISOString(),
  });
  if (recentEvents.length > 80) {
    recentEvents.shift();
  }

  for (const client of clients) {
    send(client, event, payload);
  }
}

function xmlEscape(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString('utf8');
  const contentType = request.headers['content-type'] ?? '';

  if (contentType.includes('application/json')) {
    return raw ? JSON.parse(raw) : {};
  }

  const params = new URLSearchParams(raw);
  return Object.fromEntries(params.entries());
}

function parseTranscriptionData(raw) {
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return { transcript: raw };
  }
}

function inferRisk(transcript) {
  const lower = transcript.toLowerCase();

  if (lower.includes('one-time passcode') || lower.includes('otp') || lower.includes('password')) {
    return {
      label: 'Credential request',
      severity: 'high',
      reason: 'Caller asks for a credential or one-time passcode.',
    };
  }

  if (lower.includes('do not') && (lower.includes('tell') || lower.includes('hang up'))) {
    return {
      label: 'Secrecy pressure',
      severity: 'high',
      reason: 'Caller asks the user to keep the call secret or stay on the line.',
    };
  }

  if (lower.includes('urgent') || lower.includes('immediately')) {
    return {
      label: 'Urgency pressure',
      severity: 'suspicious',
      reason: 'Caller pushes immediate action.',
    };
  }

  return null;
}

function timestampFor(callSid) {
  const startedAt = startedAtByCallSid.get(callSid) ?? Date.now();
  const elapsed = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
  const minutes = Math.floor(elapsed / 60);
  const seconds = String(elapsed % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function demoRecordingBuffer() {
  if (demoRecordingWav) return demoRecordingWav;

  const sampleRate = 8000;
  const durationSeconds = 42;
  const dataSize = sampleRate * durationSeconds;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate, 28);
  buffer.writeUInt16LE(1, 32);
  buffer.writeUInt16LE(8, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < dataSize; i += 1) {
    const seconds = i / sampleRate;
    const inEvidenceWindow =
      (seconds >= 8 && seconds <= 15)
      || (seconds >= 18 && seconds <= 25)
      || (seconds >= 30 && seconds <= 38);
    const frequency = inEvidenceWindow ? 520 : 220;
    const amplitude = inEvidenceWindow ? 42 : 18;
    buffer[44 + i] = 128 + Math.round(Math.sin(2 * Math.PI * frequency * seconds) * amplitude);
  }

  demoRecordingWav = buffer;
  return demoRecordingWav;
}

function videodbEvidenceFor(callSid, recordingUrl) {
  return [
    {
      id: `media-${callSid}-urgency`,
      callId: callSid,
      source: 'videodb',
      timestamp: '0:08-0:15',
      startMs: 8000,
      endMs: 15000,
      label: 'Urgency pressure',
      summary: 'VideoDB indexes the recording moment where the caller pushes immediate verification.',
      confidence: 0.82,
      playbackUrl: recordingUrl,
    },
    {
      id: `media-${callSid}-secrecy`,
      callId: callSid,
      source: 'videodb',
      timestamp: '0:18-0:25',
      startMs: 18000,
      endMs: 25000,
      label: 'Secrecy request',
      summary: 'Timestamped evidence captures the instruction not to hang up or tell family.',
      confidence: 0.91,
      playbackUrl: recordingUrl,
    },
    {
      id: `media-${callSid}-credential`,
      callId: callSid,
      source: 'videodb',
      timestamp: '0:30-0:38',
      startMs: 30000,
      endMs: 38000,
      label: 'Credential request',
      summary: 'The recording segment links the one-time passcode request to report evidence.',
      confidence: 0.94,
      playbackUrl: recordingUrl,
    },
  ];
}

function bridgeUrl(request) {
  const host = request.headers['x-forwarded-host'] ?? request.headers.host;
  const proto = request.headers['x-forwarded-proto'] ?? 'https';
  return `${proto}://${host}`;
}

function twimlFor(request) {
  const baseUrl = bridgeUrl(request);
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">JAGA is now listening for safety signals.</Say>
  <Start>
    <Recording recordingStatusCallback="${xmlEscape(baseUrl)}/twilio/recording" recordingStatusCallbackEvent="in-progress completed absent" />
  </Start>
  <Start>
    <Transcription statusCallbackUrl="${xmlEscape(baseUrl)}/twilio/transcription" track="both_tracks" partialResults="true" />
  </Start>
  <Pause length="3600" />
</Response>`;
}

function createVoiceToken() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const apiKeySid = process.env.TWILIO_API_KEY_SID;
  const apiKeySecret = process.env.TWILIO_API_KEY_SECRET;
  const twimlAppSid = process.env.TWILIO_TWIML_APP_SID;

  const missing = Object.entries({
    TWILIO_ACCOUNT_SID: accountSid,
    TWILIO_API_KEY_SID: apiKeySid,
    TWILIO_API_KEY_SECRET: apiKeySecret,
    TWILIO_TWIML_APP_SID: twimlAppSid,
  })
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    return { missing };
  }

  const identity = `jaga-browser-${randomUUID().slice(0, 8)}`;
  const token = new AccessToken(accountSid, apiKeySid, apiKeySecret, {
    identity,
    ttl: 3600,
  });
  token.addGrant(new VoiceGrant({ outgoingApplicationSid: twimlAppSid }));

  return {
    identity,
    token: token.toJwt(),
  };
}

function writeVoiceToken(response, { debug = false } = {}) {
  const token = createVoiceToken();
  if ('missing' in token) {
    writeJson(response, 500, {
      error: 'Missing Twilio Voice SDK configuration',
      missing: token.missing,
    });
    return;
  }

  broadcast('trace', { message: `Issued Voice SDK token for ${token.identity}` });
  writeJson(response, 200, debug
    ? {
      mode: 'twilio-voice-sdk-live-test',
      identity: token.identity,
      token: token.token,
      connectParams: {
        Source: 'debug-live-test-button',
      },
      twimlAppWebhook: '/twilio/browser-voice',
      fallbackEndpoint: '/demo/happy-path',
    }
    : token);
}

function writeJson(response, status, payload) {
  response.writeHead(status, {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  });
  response.end(JSON.stringify(payload));
}

function broadcastDemoTranscript(callSid) {
  const lines = [
    {
      text: 'Hello, this is calling from your bank security department.',
      timestamp: '0:04',
    },
    {
      text: 'There has been an urgent transaction on your account and we need to verify you now.',
      timestamp: '0:11',
    },
    {
      text: 'Do not hang up or tell anyone else, this is a confidential investigation.',
      timestamp: '0:18',
    },
    {
      text: 'Please read me the one-time passcode you just received so I can block the transfer.',
      timestamp: '0:28',
    },
  ];

  for (const [index, line] of lines.entries()) {
    const segment = {
      id: `${callSid}-demo-${index + 1}`,
      callId: callSid,
      speaker: 'Caller',
      text: line.text,
      timestamp: line.timestamp,
      isFinal: true,
      sequenceId: index + 1,
    };
    broadcast('transcript-final', segment);

    const risk = inferRisk(line.text);
    if (risk) {
      broadcast('risk-signal', {
        id: `risk-${segment.id}`,
        callId: callSid,
        transcriptSegmentId: segment.id,
        timestamp: line.timestamp,
        ...risk,
      });
    }
  }
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);

  if (request.method === 'OPTIONS') {
    response.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'content-type,x-twilio-signature',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    });
    response.end();
    return;
  }

  if (request.method === 'GET' && url.pathname === '/events') {
    response.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'Content-Type': 'text/event-stream',
    });
    clients.add(response);
    send(response, 'bridge-ready', { status: 'connected' });
    request.on('close', () => clients.delete(response));
    return;
  }

  if (request.method === 'GET' && url.pathname === '/health') {
    writeJson(response, 200, { ok: true, clients: clients.size });
    return;
  }

  if (request.method === 'GET' && url.pathname === '/debug/events') {
    writeJson(response, 200, {
      clients: clients.size,
      events: recentEvents,
    });
    return;
  }

  if (request.method === 'GET' && url.pathname === '/demo/recording.wav') {
    const recording = demoRecordingBuffer();
    response.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Content-Length': String(recording.length),
      'Content-Type': 'audio/wav',
    });
    response.end(recording);
    return;
  }

  if (request.method === 'POST' && url.pathname === '/demo/happy-path') {
    const payload = await readBody(request);
    const callSid = payload.CallSid || `CA_DEMO_${randomUUID().replaceAll('-', '')}`;
    const recordingUrl = payload.RecordingUrl || `http://${request.headers.host}/demo/recording.wav`;
    startedAtByCallSid.set(callSid, Date.now());

    broadcast('call-started', {
      callSid,
      caller: payload.From || '+65 8654 9635',
      startedAt: 'Live now',
      summary: 'Demo scam call with recording evidence',
    });
    broadcastDemoTranscript(callSid);
    broadcast('recording-status', {
      id: payload.RecordingSid || `recording-${callSid}`,
      callId: callSid,
      status: 'completed',
      duration: '0:42',
      url: recordingUrl,
      storagePath: payload.StoragePath || undefined,
    });
    broadcast('trace', { message: 'VideoDB videodb-index job completed with timestamped evidence.' });
    broadcast('videodb-evidence', {
      callSid,
      evidence: videodbEvidenceFor(callSid, recordingUrl),
    });

    writeJson(response, 200, { ok: true, callSid, recordingUrl });
    return;
  }

  if (request.method === 'GET' && url.pathname === '/twilio/token') {
    writeVoiceToken(response);
    return;
  }

  if (request.method === 'GET' && url.pathname === '/debug/live-test-token') {
    writeVoiceToken(response, { debug: true });
    return;
  }

  if (
    request.method === 'POST'
    && (url.pathname === '/twilio/voice' || url.pathname === '/twilio/browser-voice')
  ) {
    const payload = await readBody(request);
    const callSid = payload.CallSid || `CA_LOCAL_${randomUUID().replaceAll('-', '')}`;
    startedAtByCallSid.set(callSid, Date.now());
    broadcast('call-started', {
      callSid,
      caller: payload.From || payload.Source || 'Browser microphone',
      startedAt: 'Live now',
      summary: url.pathname === '/twilio/browser-voice'
        ? 'Live browser microphone session through Twilio Voice SDK'
        : 'Live Twilio call through local bridge',
    });
    response.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'text/xml',
    });
    response.end(twimlFor(request));
    return;
  }

  if (request.method === 'POST' && url.pathname === '/twilio/transcription') {
    const payload = await readBody(request);
    const callSid = payload.CallSid || 'CA_UNKNOWN';
    const event = payload.TranscriptionEvent || 'transcription-content';

    if (event !== 'transcription-content') {
      broadcast('trace', { message: `Twilio ${event}` });
      response.writeHead(204, { 'Access-Control-Allow-Origin': '*' });
      response.end();
      return;
    }

    const data = parseTranscriptionData(payload.TranscriptionData);
    const transcript = String(data.transcript ?? data.Transcript ?? '').trim();
    const sequenceId = Number.parseInt(payload.SequenceId || '0', 10);
    const track = payload.Track || 'inbound_track';
    const isFinal = String(payload.Final).toLowerCase() === 'true';

    if (!transcript) {
      response.writeHead(204, { 'Access-Control-Allow-Origin': '*' });
      response.end();
      return;
    }

    if (!isFinal) {
      broadcast('transcript-partial', {
        callSid,
        text: transcript,
        speaker: track === 'outbound_track' ? 'You' : 'Caller',
        sequenceId,
      });
    } else {
      const segment = {
        id: `${callSid}-${sequenceId}-${track}`,
        callId: callSid,
        speaker: track === 'outbound_track' ? 'You' : 'Caller',
        text: transcript,
        timestamp: timestampFor(callSid),
        isFinal: true,
        sequenceId,
      };
      broadcast('transcript-final', segment);

      const risk = inferRisk(transcript);
      if (risk) {
        broadcast('risk-signal', {
          id: `risk-${segment.id}`,
          callId: callSid,
          transcriptSegmentId: segment.id,
          timestamp: segment.timestamp,
          ...risk,
        });
      }
    }

    response.writeHead(204, { 'Access-Control-Allow-Origin': '*' });
    response.end();
    return;
  }

  if (request.method === 'POST' && url.pathname === '/twilio/recording') {
    const payload = await readBody(request);
    const callSid = payload.CallSid || 'CA_UNKNOWN';
    const status = payload.RecordingStatus === 'absent' ? 'missing' : payload.RecordingStatus || 'pending';
    const recordingUrl = payload.RecordingUrl || 'simulated://twilio-recording/RE_LOCAL';
    broadcast('recording-status', {
      id: payload.RecordingSid || `recording-${callSid}`,
      callId: callSid,
      status,
      duration: payload.RecordingDuration ? `0:${String(payload.RecordingDuration).padStart(2, '0')}` : undefined,
      url: recordingUrl,
    });
    if (status === 'completed') {
      broadcast('trace', { message: 'VideoDB videodb-index job queued from recording callback.' });
      broadcast('videodb-evidence', {
        callSid,
        evidence: videodbEvidenceFor(callSid, recordingUrl),
      });
    }
    response.writeHead(204, { 'Access-Control-Allow-Origin': '*' });
    response.end();
    return;
  }

  writeJson(response, 404, { error: 'Not found' });
});

server.listen(port, () => {
  console.log(`Twilio bridge listening on http://127.0.0.1:${port}`);
  console.log(`Twilio voice webhook path: /twilio/voice`);
  console.log(`Twilio browser Voice SDK webhook path: /twilio/browser-voice`);
});
