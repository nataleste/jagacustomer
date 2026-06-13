import { corsHeaders } from '../_shared/cors.ts';
import { createServiceClient, readFormOrJson } from '../_shared/supabase.ts';
import { demoUserId, publicFunctionsBaseUrl } from '../_shared/twilio.ts';

function parseTranscriptionData(raw: string) {
  try {
    return JSON.parse(raw || '{}') as { transcript?: string; confidence?: number };
  } catch {
    return { transcript: raw };
  }
}

function inferRisk(transcript: string) {
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

async function handleTranscriptionCallback(payload: Record<string, string>) {
  const supabase = createServiceClient();
  const callSid = payload.CallSid || 'CA_UNKNOWN';
  const event = payload.TranscriptionEvent || 'transcription-content';
  const sequenceId = Number.parseInt(payload.SequenceId || '0', 10);
  const track = payload.Track || 'inbound_track';

  const { data: call } = await supabase
    .from('calls')
    .select('id')
    .eq('twilio_call_sid', callSid)
    .maybeSingle();

  const callId = call?.id;

  await supabase.from('twilio_events').insert({
    call_id: callId,
    event_type: event,
    twilio_call_sid: callSid,
    payload,
  });

  if (event === 'transcription-stopped' && callId) {
    await supabase
      .from('calls')
      .update({ status: 'completed', ended_at: new Date().toISOString() })
      .eq('id', callId);
  }

  if (event !== 'transcription-content' || !callId) {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const parsed = parseTranscriptionData(payload.TranscriptionData || '{}');
  const transcript = parsed.transcript?.trim();
  if (!transcript) {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const isFinal = String(payload.Final).toLowerCase() === 'true';

  if (!isFinal) {
    await supabase.from('transcript_partials').upsert({
      call_id: callId,
      transcription_sid: payload.TranscriptionSid,
      sequence_id: sequenceId,
      track,
      transcript,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'call_id,transcription_sid,sequence_id,track' });
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const { data: segment } = await supabase.from('transcript_segments').insert({
    call_id: callId,
    twilio_call_sid: callSid,
    transcription_sid: payload.TranscriptionSid,
    sequence_id: sequenceId,
    track,
    speaker: track === 'outbound_track' ? 'You' : 'Caller',
    transcript,
    confidence: parsed.confidence ?? null,
  }).select('id').single();

  await supabase.from('jobs').insert({
    call_id: callId,
    job_type: 'live-risk-detection',
    status: 'queued',
    payload: { transcript_segment_id: segment?.id, sequence_id: sequenceId },
  });

  const risk = inferRisk(transcript);
  if (risk && segment?.id) {
    const { data: signal } = await supabase.from('risk_signals').insert({
      call_id: callId,
      transcript_segment_id: segment.id,
      ...risk,
    }).select('id').single();

    await supabase.from('evidence_moments').insert({
      call_id: callId,
      transcript_segment_id: segment.id,
      risk_signal_id: signal?.id,
      note: risk.reason,
    });
  }

  return new Response(null, { status: 204, headers: corsHeaders });
}

async function handleCallStatusCallback(payload: Record<string, string>) {
  const supabase = createServiceClient();
  const callSid = payload.CallSid || 'CA_UNKNOWN';
  const callStatus = payload.CallStatus || 'unknown';

  const { data: call } = await supabase
    .from('calls')
    .select('id')
    .eq('twilio_call_sid', callSid)
    .maybeSingle();

  const callId = call?.id;

  await supabase.from('twilio_events').insert({
    call_id: callId,
    event_type: `call-status-${callStatus}`,
    twilio_call_sid: callSid,
    payload,
  });

  if (callId && ['completed', 'busy', 'failed', 'no-answer', 'canceled'].includes(callStatus)) {
    await supabase
      .from('calls')
      .update({ status: 'completed', ended_at: new Date().toISOString() })
      .eq('id', callId);
  }

  return new Response(null, { status: 204, headers: corsHeaders });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const payload = await readFormOrJson(request);
  const url = new URL(request.url);
  const recordingStartedBy = url.searchParams.get('recordingStartedBy');
  const mode = url.searchParams.get('mode');
  if (url.searchParams.get('status') === '1') {
    return await handleCallStatusCallback(payload);
  }

  if (payload.TranscriptionEvent) {
    return await handleTranscriptionCallback(payload);
  }

  const callSid = payload.CallSid || `CA_SIM_${crypto.randomUUID()}`;
  const callbackBaseUrl = publicFunctionsBaseUrl(request);
  const supabase = createServiceClient();

  await supabase.from('calls').upsert({
    user_id: demoUserId(),
    twilio_call_sid: callSid,
    caller: payload.From || 'Unknown caller',
    status: 'live',
    summary: 'Twilio Native Real-Time Transcription call',
  }, { onConflict: 'twilio_call_sid' });

  await supabase.from('twilio_events').insert({
    event_type: 'voice-inbound',
    twilio_call_sid: callSid,
    payload,
  });

  const isMinimalMode = mode === 'minimal';
  const recordingTwiML = recordingStartedBy === 'vercel-rest'
    ? ''
    : `  <Start>
    <Recording
      recordingStatusCallback="${callbackBaseUrl}/twilio-recording"
      recordingStatusCallbackMethod="POST"
      recordingStatusCallbackEvent="in-progress completed absent"
      track="both"
      channels="dual"
      trim="do-not-trim" />
  </Start>
`;

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">${isMinimalMode ? 'JAGA is listening.' : 'This call is being transcribed and recorded.'}</Say>
${recordingTwiML}  <Start>
    <Transcription
      statusCallbackUrl="${callbackBaseUrl}/twilio-voice"
      track="both_tracks"
      partialResults="true" />
  </Start>
  <Pause length="3600" />
</Response>`;

  return new Response(twiml, {
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/xml',
    },
  });
});
