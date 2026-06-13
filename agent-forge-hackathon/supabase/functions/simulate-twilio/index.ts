import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { createServiceClient } from '../_shared/supabase.ts';
import { demoUserId } from '../_shared/twilio.ts';

const lines = [
  {
    timestamp: '0:03',
    transcript: 'Hello, this is calling from your bank security department.',
  },
  {
    timestamp: '0:11',
    transcript: 'There has been an urgent transaction on your account and we need to verify you now.',
    risk: {
      label: 'Urgency pressure',
      severity: 'suspicious',
      reason: 'Caller pushes immediate action.',
    },
  },
  {
    timestamp: '0:20',
    transcript: 'Do not hang up or tell anyone else, this is a confidential investigation.',
    risk: {
      label: 'Secrecy pressure',
      severity: 'high',
      reason: 'Caller asks the user to keep the call secret or stay on the line.',
    },
  },
  {
    timestamp: '0:32',
    transcript: 'Please read me the one-time passcode you just received so I can block the transfer.',
    risk: {
      label: 'Credential request',
      severity: 'high',
      reason: 'Caller asks for a credential or one-time passcode.',
    },
  },
];

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabase = createServiceClient();
  const callSid = `CA_SIM_${crypto.randomUUID().replaceAll('-', '')}`;

  const { data: call, error } = await supabase.from('calls').insert({
    user_id: demoUserId(),
    caller: '+65 8654 9635',
    status: 'live',
    twilio_call_sid: callSid,
    summary: 'Simulated Twilio callback trace',
  }).select('id').single();

  if (error || !call) {
    return jsonResponse({ error: error?.message ?? 'Unable to create call' }, { status: 500 });
  }

  const transcriptState = [];
  const signalState = [];

  for (const [index, line] of lines.entries()) {
    const { data: segment } = await supabase.from('transcript_segments').insert({
      call_id: call.id,
      twilio_call_sid: callSid,
      transcription_sid: 'GT_SIMULATED',
      sequence_id: index + 1,
      track: 'inbound_track',
      speaker: 'Caller',
      transcript: line.transcript,
    }).select('id').single();

    if (!segment) continue;

    transcriptState.push({
      id: segment.id,
      callId: call.id,
      speaker: 'Caller',
      timestamp: line.timestamp,
      text: line.transcript,
      isFinal: true,
      sequenceId: index + 1,
    });

    if (line.risk) {
      const { data: signal } = await supabase.from('risk_signals').insert({
        call_id: call.id,
        transcript_segment_id: segment.id,
        ...line.risk,
      }).select('id').single();

      await supabase.from('evidence_moments').insert({
        call_id: call.id,
        transcript_segment_id: segment.id,
        risk_signal_id: signal?.id,
        timestamp_label: line.timestamp,
        note: line.risk.reason,
      });

      signalState.push({
        id: signal?.id ?? `risk-${segment.id}`,
        callId: call.id,
        transcriptSegmentId: segment.id,
        label: line.risk.label,
        severity: line.risk.severity,
        reason: line.risk.reason,
      });
    }
  }

  const recordingSid = `RE_SIM_${crypto.randomUUID().replaceAll('-', '')}`;
  const { data: recording } = await supabase.from('recordings').insert({
    call_id: call.id,
    twilio_call_sid: callSid,
    recording_sid: recordingSid,
    status: 'completed',
    recording_url: 'simulated://twilio-recording',
    duration_seconds: 42,
    track: 'inbound',
    channels: 1,
  }).select('id, recording_url, duration_seconds, status').single();

  const { data: job } = await supabase.from('jobs').insert({
    call_id: call.id,
    job_type: 'videodb-index',
    status: 'completed',
    payload: {
      recording_sid: recordingSid,
      recording_url: recording?.recording_url ?? 'simulated://twilio-recording',
    },
    result: { media_evidence_count: 3 },
  }).select('id').single();

  const mediaEvidenceRows = [
    {
      call_id: call.id,
      recording_id: recording?.id,
      job_id: job?.id,
      source: 'videodb',
      source_media_id: recordingSid,
      start_seconds: 8,
      end_seconds: 15,
      start_ms: 8000,
      end_ms: 15000,
      timestamp_label: '0:08-0:15',
      label: 'Urgency pressure',
      summary: 'VideoDB indexes the recording moment where the caller pushes immediate verification.',
      confidence: 0.82,
      playback_url: recording?.recording_url ?? 'simulated://twilio-recording',
      metadata: { mode: 'simulated' },
    },
    {
      call_id: call.id,
      recording_id: recording?.id,
      job_id: job?.id,
      source: 'videodb',
      source_media_id: recordingSid,
      start_seconds: 18,
      end_seconds: 25,
      start_ms: 18000,
      end_ms: 25000,
      timestamp_label: '0:18-0:25',
      label: 'Secrecy request',
      summary: 'Timestamped evidence captures the instruction not to hang up or tell family.',
      confidence: 0.91,
      playback_url: recording?.recording_url ?? 'simulated://twilio-recording',
      metadata: { mode: 'simulated' },
    },
    {
      call_id: call.id,
      recording_id: recording?.id,
      job_id: job?.id,
      source: 'videodb',
      source_media_id: recordingSid,
      start_seconds: 30,
      end_seconds: 38,
      start_ms: 30000,
      end_ms: 38000,
      timestamp_label: '0:30-0:38',
      label: 'Credential request',
      summary: 'The recording segment links the one-time passcode request to report evidence.',
      confidence: 0.94,
      playback_url: recording?.recording_url ?? 'simulated://twilio-recording',
      metadata: { mode: 'simulated' },
    },
  ];

  const { data: mediaEvidence } = await supabase
    .from('media_evidence')
    .insert(mediaEvidenceRows)
    .select('id, timestamp_label, start_ms, end_ms, label, summary, confidence, playback_url');

  await supabase.from('calls').update({
    status: 'completed',
    ended_at: new Date().toISOString(),
  }).eq('id', call.id);

  return jsonResponse({
    ok: true,
    call_id: call.id,
    twilio_call_sid: callSid,
    tracer_state: {
      call: {
        id: call.id,
        caller: '+65 8654 9635',
        status: 'completed',
        startedAt: 'Completed',
        summary: 'Simulated Twilio callback trace',
      },
      transcript: transcriptState,
      signals: signalState,
      recording: {
        id: recording?.id ?? 'recording-simulated',
        callId: call.id,
        status: recording?.status ?? 'completed',
        duration: recording?.duration_seconds ? `0:${String(recording.duration_seconds).padStart(2, '0')}` : '0:42',
        url: recording?.recording_url ?? 'simulated://twilio-recording',
      },
      mediaEvidence: (mediaEvidence ?? []).map((evidence) => ({
        id: evidence.id,
        callId: call.id,
        source: 'videodb',
        timestamp: evidence.timestamp_label,
        startMs: evidence.start_ms,
        endMs: evidence.end_ms,
        label: evidence.label,
        summary: evidence.summary,
        confidence: evidence.confidence,
        playbackUrl: evidence.playback_url,
      })),
      partialText: '',
    },
  });
});
