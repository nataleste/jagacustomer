import { corsHeaders } from '../_shared/cors.ts';
import { createServiceClient, readFormOrJson } from '../_shared/supabase.ts';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const payload = await readFormOrJson(request);
  const supabase = createServiceClient();
  const callSid = payload.CallSid || 'CA_UNKNOWN';

  const { data: call } = await supabase
    .from('calls')
    .select('id')
    .eq('twilio_call_sid', callSid)
    .maybeSingle();

  await supabase.from('twilio_events').insert({
    call_id: call?.id,
    event_type: `recording-${payload.RecordingStatus || 'unknown'}`,
    twilio_call_sid: callSid,
    payload,
  });

  if (call?.id && payload.RecordingSid) {
    await supabase.from('recordings').upsert({
      call_id: call.id,
      twilio_call_sid: callSid,
      recording_sid: payload.RecordingSid,
      status: payload.RecordingStatus || 'unknown',
      recording_url: payload.RecordingUrl || null,
      duration_seconds: payload.RecordingDuration ? Number.parseInt(payload.RecordingDuration, 10) : null,
      track: payload.RecordingTrack || null,
      channels: payload.RecordingChannels ? Number.parseInt(payload.RecordingChannels, 10) : null,
    }, { onConflict: 'recording_sid' });

    if (payload.RecordingStatus === 'completed') {
      await supabase.from('jobs').insert({
        call_id: call.id,
        job_type: 'videodb-index',
        status: 'queued',
        payload: { recording_sid: payload.RecordingSid, recording_url: payload.RecordingUrl },
      });
    }
  }

  return new Response(null, { status: 204, headers: corsHeaders });
});
