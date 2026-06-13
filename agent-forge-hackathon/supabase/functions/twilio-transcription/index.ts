import { corsHeaders } from '../_shared/cors.ts';
import { createServiceClient, readFormOrJson } from '../_shared/supabase.ts';

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

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const payload = await readFormOrJson(request);
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
});
