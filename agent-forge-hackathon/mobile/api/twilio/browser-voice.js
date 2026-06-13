const supabaseVoiceUrl = 'https://ysfynixbiemcobthtduf.supabase.co/functions/v1/twilio-voice';
const supabaseRecordingUrl = 'https://ysfynixbiemcobthtduf.supabase.co/functions/v1/twilio-recording';

async function startRecording(callSid) {
  const required = {
    TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
    TWILIO_API_KEY_SID: process.env.TWILIO_API_KEY_SID,
    TWILIO_API_KEY_SECRET: process.env.TWILIO_API_KEY_SECRET,
  };

  if (!callSid || Object.values(required).some((value) => !value)) {
    return false;
  }

  const twilio = await import('twilio');
  const client = twilio.default(
    required.TWILIO_API_KEY_SID,
    required.TWILIO_API_KEY_SECRET,
    { accountSid: required.TWILIO_ACCOUNT_SID },
  );

  try {
    await client.calls(callSid).recordings.create({
      recordingChannels: 'dual',
      recordingStatusCallback: supabaseRecordingUrl,
      recordingStatusCallbackEvent: ['in-progress', 'completed', 'absent'],
      recordingStatusCallbackMethod: 'POST',
      recordingTrack: 'both',
      trim: 'do-not-trim',
    });
    return true;
  } catch (error) {
    console.error('Unable to start Twilio call recording', {
      callSid,
      status: error?.status,
      code: error?.code,
      message: error?.message,
    });
    return false;
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

export default async function handler(request, response) {
  if (request.method !== 'POST' && request.method !== 'GET') {
    response.statusCode = 405;
    response.setHeader('Allow', 'GET,POST');
    response.end('Method not allowed');
    return;
  }

  const callSid = request.body?.CallSid || request.query?.CallSid;
  const recordingStarted = request.method === 'POST'
    ? await startRecording(callSid)
    : false;
  const redirectUrl = new URL(supabaseVoiceUrl);
  if (recordingStarted) {
    redirectUrl.searchParams.set('recordingStartedBy', 'vercel-rest');
  }

  response.statusCode = 200;
  response.setHeader('Content-Type', 'text/xml');
  response.end(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Redirect method="POST">${xmlEscape(redirectUrl.toString())}</Redirect>
</Response>`);
}
