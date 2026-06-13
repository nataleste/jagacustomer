import { supabase } from './supabaseClient';
import { formatElapsedTimestamp, timestampFromSequence } from './transcriptTimestamps';
import type { CallStatus, MediaEvidence, Recording, RiskSignal, TranscriptSegment, TracerState } from './types';

type CallRow = {
  id: string;
  caller: string | null;
  status: string;
  twilio_call_sid: string | null;
  started_at: string | null;
  ended_at: string | null;
  summary: string | null;
  created_at: string;
};

type TranscriptRow = {
  id: string;
  call_id: string;
  speaker: string;
  transcript: string;
  sequence_id: number | null;
  occurred_at: string | null;
};

type PartialRow = {
  transcript: string;
  sequence_id: number | null;
  updated_at: string;
};

type RiskRow = {
  id: string;
  call_id: string;
  transcript_segment_id: string;
  label: string;
  severity: string;
  reason: string;
};

type RecordingRow = {
  id: string;
  call_id: string;
  recording_sid: string | null;
  status: string;
  recording_url: string | null;
  duration_seconds: number | null;
};

type MediaEvidenceRow = {
  id: string;
  call_id: string;
  source: string;
  metadata: Record<string, unknown> | null;
  timestamp_label: string;
  start_ms: number | null;
  end_ms: number | null;
  label: string;
  summary: string;
  confidence: number | null;
  playback_url: string | null;
};

function normalizeStatus(status: string): CallStatus {
  if (status === 'live' || status === 'completed') return status;
  return 'idle';
}

function formatCallStarted(row: CallRow) {
  if (row.status === 'completed') return 'Completed';
  if (row.status === 'live') return 'Live now';
  const value = row.started_at || row.created_at;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not started';

  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDuration(seconds: number | null) {
  if (!seconds || seconds < 0) return undefined;

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
}

function transcriptTimestamp(
  sequenceId: number | null,
  occurredAt: string | null,
  callStartedAt: string | null,
) {
  if (occurredAt && callStartedAt) {
    const occurredTime = new Date(occurredAt).getTime();
    const startedTime = new Date(callStartedAt).getTime();

    if (!Number.isNaN(occurredTime) && !Number.isNaN(startedTime) && occurredTime >= startedTime) {
      return formatElapsedTimestamp((occurredTime - startedTime) / 1000);
    }
  }

  return timestampFromSequence(sequenceId);
}

function normalizeSeverity(severity: string): RiskSignal['severity'] {
  if (severity === 'high' || severity === 'suspicious') return severity;
  return 'low';
}

function isMissingOptionalTable(error: { code?: string } | null) {
  return error?.code === 'PGRST205';
}

function isSeededDemoCall(call: CallRow) {
  const summary = call.summary?.toLowerCase() ?? '';

  return (
    call.twilio_call_sid?.startsWith('CA_SIM_')
    || summary.includes('simulated twilio callback trace')
  );
}

function isStaleLiveCall(call: CallRow) {
  if (call.status !== 'live') return false;

  const createdAt = new Date(call.created_at).getTime();
  if (Number.isNaN(createdAt)) return false;

  return Date.now() - createdAt > 10 * 60 * 1000;
}

function normalizeRecordingStatus(status: string): Recording['status'] {
  if (status === 'completed' || status === 'in-progress') return status;
  if (status === 'absent' || status === 'failed' || status === 'missing') return 'missing';
  return 'pending';
}

function recordingSidFromUrl(url: string | null) {
  return url?.match(/\/Recordings\/(RE[a-f0-9]{32})(?:\.mp3)?/i)?.[1] ?? null;
}

function recordingPlaybackUrl(row: RecordingRow) {
  if (row.recording_url?.startsWith('simulated://')) {
    return row.recording_url;
  }

  const recordingSid = row.recording_sid ?? recordingSidFromUrl(row.recording_url);
  if (!recordingSid) {
    return row.recording_url ?? undefined;
  }

  return `${window.location.origin}/api/twilio/recordings/${recordingSid}.mp3`;
}

function normalizeEvidenceMode(metadata: Record<string, unknown> | null): MediaEvidence['mode'] {
  const mode = typeof metadata?.mode === 'string' ? metadata.mode : '';
  if (mode === 'simulated') return 'simulated';
  if (mode === 'seeded' || mode === 'seeded-after-videodb-probe') return 'seeded';
  if (
    mode === 'videodb-ready-seeded-findings'
    || mode === 'videodb-indexed-fallback-moment'
    || mode === 'videodb-audio-fallback-moment'
  ) return 'probe';
  if (mode === 'videodb') return 'real';
  return undefined;
}

export async function fetchLatestSupabaseSnapshot(): Promise<TracerState | null> {
  if (!supabase) return null;

  const { data: calls, error: callError } = await supabase
    .from('calls')
    .select('id, caller, status, twilio_call_sid, started_at, ended_at, summary, created_at')
    .order('created_at', { ascending: false })
    .limit(import.meta.env.DEV ? 1 : 10)
    .returns<CallRow[]>();

  if (callError) throw callError;
  const call = import.meta.env.DEV
    ? calls?.[0]
    : calls?.find((item) => !isSeededDemoCall(item) && !isStaleLiveCall(item));
  if (!call) return null;

  const mediaEvidenceQuery = supabase
    .from('media_evidence')
    .select('id, call_id, source, metadata, timestamp_label, start_ms, end_ms, label, summary, confidence, playback_url')
    .eq('call_id', call.id)
    .order('start_ms', { ascending: true })
    .returns<MediaEvidenceRow[]>();

  const [
    transcriptResult,
    partialResult,
    riskResult,
    recordingResult,
    mediaEvidenceResult,
  ] = await Promise.all([
    supabase
      .from('transcript_segments')
      .select('id, call_id, speaker, transcript, sequence_id, occurred_at')
      .eq('call_id', call.id)
      .order('sequence_id', { ascending: true })
      .returns<TranscriptRow[]>(),
    supabase
      .from('transcript_partials')
      .select('transcript, sequence_id, updated_at')
      .eq('call_id', call.id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .returns<PartialRow[]>(),
    supabase
      .from('risk_signals')
      .select('id, call_id, transcript_segment_id, label, severity, reason')
      .eq('call_id', call.id)
      .returns<RiskRow[]>(),
    supabase
      .from('recordings')
      .select('id, call_id, recording_sid, status, recording_url, duration_seconds')
      .eq('call_id', call.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .returns<RecordingRow[]>(),
    mediaEvidenceQuery,
  ]);

  const firstError = transcriptResult.error
    || partialResult.error
    || riskResult.error
    || recordingResult.error
    || (isMissingOptionalTable(mediaEvidenceResult.error) ? null : mediaEvidenceResult.error);
  if (firstError) throw firstError;

  const callStartedAt = call.started_at ?? call.created_at;
  const transcript: TranscriptSegment[] = (transcriptResult.data ?? []).map((segment) => ({
    id: segment.id,
    callId: segment.call_id,
    speaker: segment.speaker,
    text: segment.transcript,
    timestamp: transcriptTimestamp(segment.sequence_id, segment.occurred_at, callStartedAt),
    isFinal: true,
    sequenceId: segment.sequence_id ?? 0,
  }));

  const transcriptTimestampById = new Map(
    transcript.map((segment) => [segment.id, segment.timestamp]),
  );
  const latestFinalSequence = Math.max(0, ...transcript.map((segment) => segment.sequenceId));
  const partial = partialResult.data?.[0];
  const partialSequence = partial?.sequence_id ?? 0;
  const partialText = partial && (transcript.length === 0 || partialSequence > latestFinalSequence)
    ? partial.transcript
    : '';

  const signals: RiskSignal[] = (riskResult.data ?? []).map((signal) => ({
    id: signal.id,
    callId: signal.call_id,
    transcriptSegmentId: signal.transcript_segment_id,
    label: signal.label,
    severity: normalizeSeverity(signal.severity),
    reason: signal.reason,
    timestamp: transcriptTimestampById.get(signal.transcript_segment_id) ?? 'live',
  }));

  const recordingRow = recordingResult.data?.[0];
  const recording: Recording = recordingRow
    ? {
        id: recordingRow.id,
        callId: recordingRow.call_id,
        status: normalizeRecordingStatus(recordingRow.status),
        recordingSid: recordingRow.recording_sid ?? recordingSidFromUrl(recordingRow.recording_url) ?? undefined,
        duration: formatDuration(recordingRow.duration_seconds),
        url: recordingRow.status === 'completed' ? recordingPlaybackUrl(recordingRow) : undefined,
      }
    : {
        id: `recording-${call.id}`,
        callId: call.id,
        status: call.status === 'completed' ? 'missing' : 'pending',
      };

  const mediaEvidenceRows = isMissingOptionalTable(mediaEvidenceResult.error)
    ? []
    : (mediaEvidenceResult.data ?? []);

  const mediaEvidence: MediaEvidence[] = mediaEvidenceRows.map((evidence) => ({
    id: evidence.id,
    callId: evidence.call_id,
    source: 'videodb',
    mode: normalizeEvidenceMode(evidence.metadata),
    timestamp: evidence.timestamp_label,
    startMs: evidence.start_ms ?? 0,
    endMs: evidence.end_ms ?? evidence.start_ms ?? 0,
    label: evidence.label,
    summary: evidence.summary,
    confidence: evidence.confidence ?? 0,
    playbackUrl: evidence.playback_url ?? undefined,
  }));

  return {
    call: {
      id: call.id,
      caller: call.caller ?? 'Unknown caller',
      startedAt: formatCallStarted(call),
      status: normalizeStatus(call.status),
      summary: call.summary ?? 'Supabase Twilio call trace',
      twilioCallSid: call.twilio_call_sid ?? undefined,
    },
    partialText,
    partialSequenceId: partialText ? partialSequence : undefined,
    transcript,
    signals,
    recording,
    mediaEvidence,
  };
}
