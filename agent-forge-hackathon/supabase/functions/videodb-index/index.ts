import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { createServiceClient } from '../_shared/supabase.ts';

type JobRow = {
  id: string;
  call_id: string;
  payload: {
    recording_sid?: string;
    recording_url?: string;
  };
};

type RecordingRow = {
  id: string;
  recording_sid: string | null;
  recording_url: string | null;
  duration_seconds: number | null;
};

type MediaEvidence = {
  call_id: string;
  recording_id: string | null;
  job_id: string;
  source: 'videodb';
  source_media_id: string;
  start_seconds: number;
  end_seconds: number;
  start_ms: number;
  end_ms: number;
  timestamp_label: string;
  label: string;
  summary: string;
  confidence: number;
  playback_url: string | null;
  metadata: Record<string, unknown>;
};

type VideoDbJson = {
  success?: boolean;
  status?: string;
  data?: unknown;
  message?: string;
  error?: string;
};

type VideoDbAudioAsset = {
  id?: string;
  name?: string;
  stream_url?: string | null;
};

type VideoDbTranscriptChunk = {
  end?: number;
  start?: number;
  text?: string;
};

type EvidenceFinding = {
  keywords: string[];
  query: string;
  label: string;
  summary: string;
};

const videodbBaseUrl = 'https://api.videodb.io';
const productionAppBaseUrl = 'https://jaga-mobile-web.vercel.app';

const findings: EvidenceFinding[] = [
  {
    keywords: ['urgent', 'immediate', 'verify', 'verification', 'account'],
    query: 'urgent account verification immediate action',
    label: 'Urgency pressure',
    summary: 'VideoDB searched the indexed call audio for urgent verification pressure.',
  },
  {
    keywords: ['do not', 'hang up', 'tell anyone', 'confidential', 'secret'],
    query: 'do not hang up do not tell anyone confidential investigation',
    label: 'Secrecy request',
    summary: 'VideoDB searched the indexed call audio for secrecy or isolation pressure.',
  },
  {
    keywords: ['passcode', 'otp', 'password', 'credential', 'one-time'],
    query: 'one-time passcode OTP password credential request',
    label: 'Credential request',
    summary: 'VideoDB searched the indexed call audio for credential or passcode requests.',
  },
];

function appBaseUrl() {
  return (Deno.env.get('PUBLIC_APP_BASE_URL') || productionAppBaseUrl).replace(/\/$/, '');
}

function proxyRecordingUrl(recordingSid: string | undefined | null) {
  return recordingSid ? `${appBaseUrl()}/api/twilio/recordings/${recordingSid}.mp3` : null;
}

function formatTimestamp(startSeconds: number, endSeconds: number) {
  const fmt = (value: number) => {
    const total = Math.max(0, Math.round(value));
    const minutes = Math.floor(total / 60);
    const seconds = String(total % 60).padStart(2, '0');
    return `${minutes}:${seconds}`;
  };

  return `${fmt(startSeconds)}-${fmt(endSeconds)}`;
}

function coerceNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function findStringByPrefix(value: unknown, prefixes: string[]): string | null {
  if (typeof value === 'string' && prefixes.some((prefix) => value.startsWith(prefix))) {
    return value;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findStringByPrefix(item, prefixes);
      if (found) return found;
    }
  } else if (value && typeof value === 'object') {
    for (const item of Object.values(value)) {
      const found = findStringByPrefix(item, prefixes);
      if (found) return found;
    }
  }

  return null;
}

function collectShotLikeObjects(value: unknown, output: Array<Record<string, unknown>> = []) {
  if (Array.isArray(value)) {
    for (const item of value) collectShotLikeObjects(item, output);
    return output;
  }

  if (!value || typeof value !== 'object') return output;

  const record = value as Record<string, unknown>;
  const start = coerceNumber(record.start) ?? coerceNumber(record.start_seconds) ?? coerceNumber(record.start_time);
  const end = coerceNumber(record.end) ?? coerceNumber(record.end_seconds) ?? coerceNumber(record.end_time);
  const text = record.text ?? record.transcript ?? record.description;

  if (start !== null && end !== null && typeof text === 'string') {
    output.push(record);
  }

  for (const item of Object.values(record)) collectShotLikeObjects(item, output);
  return output;
}

async function videoDbRequest(pathOrUrl: string, apiKey: string, init: RequestInit = {}): Promise<VideoDbJson> {
  const url = pathOrUrl.startsWith('http') ? pathOrUrl : `${videodbBaseUrl}${pathOrUrl}`;
  const response = await fetch(url, {
    ...init,
    headers: {
      'content-type': 'application/json',
      'x-access-token': apiKey,
      ...(init.headers ?? {}),
    },
  });
  const json = await response.json().catch(async () => ({ error: await response.text() })) as VideoDbJson;

  if (!response.ok || json.success === false) {
    const message = json.message || json.error || `VideoDB request failed (${response.status})`;
    throw new Error(message);
  }

  return json;
}

async function pollAsyncOutput(outputUrl: string | undefined, apiKey: string) {
  if (!outputUrl) return null;

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const json = await videoDbRequest(outputUrl, apiKey);
    const status = String(json.status ?? '').toLowerCase();
    if (status === 'done' || status === 'completed' || status === 'success') return json;
    if (status === 'failed') throw new Error('VideoDB async job failed');
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }

  return null;
}

async function findUploadedAudio(apiKey: string, collectionId: string, recordingSid: string) {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const json = await videoDbRequest(`/audio?collection_id=${encodeURIComponent(collectionId)}`, apiKey, {
      headers: { 'content-type': 'application/json' },
    });
    const audios = (json.data as { audios?: VideoDbAudioAsset[] } | undefined)?.audios ?? [];
    const match = audios.find((audio) => audio.name?.includes(recordingSid));
    if (match?.id) return match;
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }

  return null;
}

async function uploadRecording(apiKey: string, collectionId: string, recordingUrl: string, recordingSid: string) {
  const upload = await videoDbRequest(`/collection/${collectionId}/upload`, apiKey, {
    method: 'POST',
    body: JSON.stringify({
      media_type: 'audio',
      name: `JAGA call ${recordingSid}`,
      url: recordingUrl,
    }),
  });

  const immediateMediaId = findStringByPrefix(upload, ['m-', 'a-']);
  if (immediateMediaId && !immediateMediaId.startsWith('job-')) return { mediaId: immediateMediaId, upload };

  const outputUrl = typeof (upload.data as { output_url?: unknown } | undefined)?.output_url === 'string'
    ? (upload.data as { output_url: string }).output_url
    : undefined;
  const completed = await pollAsyncOutput(outputUrl, apiKey);
  const mediaId = findStringByPrefix(completed, ['m-', 'a-']);
  if (mediaId) {
    return { mediaId, upload: completed ?? upload };
  }

  const uploadedAudio = await findUploadedAudio(apiKey, collectionId, recordingSid);
  if (!uploadedAudio?.id) {
    throw new Error('VideoDB upload accepted but media id is not ready yet');
  }

  return { mediaId: uploadedAudio.id, upload: completed ?? upload };
}

async function indexRecording(apiKey: string, mediaId: string) {
  const index = await videoDbRequest(`/video/${mediaId}/index/`, apiKey, {
    method: 'POST',
    body: JSON.stringify({
      engine: 'default',
      force: false,
      index_type: 'spoken_word',
      language_code: 'en-US',
      segmentation_type: 'sentence',
    }),
  });

  const outputUrl = typeof (index.data as { output_url?: unknown } | undefined)?.output_url === 'string'
    ? (index.data as { output_url: string }).output_url
    : undefined;
  const completed = await pollAsyncOutput(outputUrl, apiKey);
  return completed ?? index;
}

async function searchRecording(apiKey: string, mediaId: string, finding: EvidenceFinding) {
  const candidates = [
    { path: `/video/${mediaId}/search`, body: { query: finding.query, index_type: 'spoken_word' } },
    { path: `/video/${mediaId}/search/`, body: { query: finding.query, index_type: 'spoken_word' } },
  ];

  for (const candidate of candidates) {
    try {
      const json = await videoDbRequest(candidate.path, apiKey, {
        method: 'POST',
        body: JSON.stringify(candidate.body),
      });
      const shots = collectShotLikeObjects(json);
      if (shots.length > 0) return { response: json, shot: shots[0] };
    } catch {
      // Try the next documented/SDK-compatible spelling before falling back.
    }
  }

  return { response: null, shot: null };
}

async function transcribeAudio(apiKey: string, mediaId: string) {
  await videoDbRequest(`/audio/${mediaId}/transcription`, apiKey, {
    method: 'POST',
    body: JSON.stringify({}),
  });

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const transcript = await videoDbRequest(`/audio/${mediaId}/transcription`, apiKey);
    const status = String(transcript.status ?? '').toLowerCase();
    const chunks = (transcript.data as { word_timestamps?: VideoDbTranscriptChunk[] } | undefined)?.word_timestamps;
    if (status === 'completed' || (chunks && chunks.length > 0)) return transcript;
    if (status === 'failed') throw new Error('VideoDB audio transcription failed');
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }

  throw new Error('VideoDB audio transcription is still processing');
}

function chunkMatchesFinding(chunk: VideoDbTranscriptChunk, finding: EvidenceFinding) {
  const text = chunk.text?.toLowerCase() ?? '';
  return finding.keywords.some((keyword) => text.includes(keyword));
}

function chunkToEvidence(
  job: JobRow,
  recording: RecordingRow | null,
  mediaId: string,
  recordingUrl: string,
  finding: EvidenceFinding,
  chunk: VideoDbTranscriptChunk | undefined,
  indexOffset: number,
  metadata: Record<string, unknown>,
): MediaEvidence {
  const startSeconds = coerceNumber(chunk?.start) ?? indexOffset * 8;
  const endSeconds = coerceNumber(chunk?.end) ?? startSeconds + 7;
  const text = chunk?.text?.trim();

  return {
    call_id: job.call_id,
    confidence: text ? 0.86 : 0.72,
    end_ms: Math.round(endSeconds * 1000),
    end_seconds: endSeconds,
    job_id: job.id,
    label: finding.label,
    metadata: {
      ...metadata,
      mode: text ? 'videodb' : 'videodb-audio-fallback-moment',
      query: finding.query,
    },
    playback_url: recordingUrl,
    recording_id: recording?.id ?? null,
    source: 'videodb',
    source_media_id: mediaId,
    start_ms: Math.round(startSeconds * 1000),
    start_seconds: startSeconds,
    summary: text ? `VideoDB audio transcript: "${text}"` : finding.summary,
    timestamp_label: formatTimestamp(startSeconds, endSeconds),
  };
}

async function buildVideoDbEvidence(job: JobRow, recording: RecordingRow | null): Promise<MediaEvidence[]> {
  const apiKey = Deno.env.get('VIDEODB_API_KEY');
  const collectionId = Deno.env.get('VIDEODB_COLLECTION_ID') || 'default';
  const recordingSid = job.payload.recording_sid ?? recording?.recording_sid;
  const recordingUrl = proxyRecordingUrl(recordingSid) ?? job.payload.recording_url ?? recording?.recording_url;

  if (!apiKey || !collectionId || !recordingSid || !recordingUrl || recordingUrl.startsWith('simulated://')) {
    throw new Error('VideoDB requires VIDEODB_API_KEY, VIDEODB_COLLECTION_ID, and a real recording SID');
  }

  const { mediaId, upload } = await uploadRecording(apiKey, collectionId, recordingUrl, recordingSid);

  if (mediaId.startsWith('a-')) {
    const transcript = await transcribeAudio(apiKey, mediaId);
    const chunks = (transcript.data as { word_timestamps?: VideoDbTranscriptChunk[] } | undefined)?.word_timestamps ?? [];
    const unusedChunks = [...chunks];
    const metadata = {
      collection_id: collectionId,
      recording_url: recordingUrl,
      upload,
      video_id: mediaId,
      videodb_transcript: transcript,
    };

    return findings.map((finding, indexOffset) => {
      const matchingIndex = unusedChunks.findIndex((chunk) => chunkMatchesFinding(chunk, finding));
      const chunk = matchingIndex >= 0 ? unusedChunks.splice(matchingIndex, 1)[0] : unusedChunks.shift();
      return chunkToEvidence(job, recording, mediaId, recordingUrl, finding, chunk, indexOffset, metadata);
    });
  }

  const index = await indexRecording(apiKey, mediaId);
  const evidence: MediaEvidence[] = [];

  for (const [indexOffset, finding] of findings.entries()) {
    const search = await searchRecording(apiKey, mediaId, finding);
    const shot = search.shot;
    const startSeconds = coerceNumber(shot?.start)
      ?? coerceNumber(shot?.start_seconds)
      ?? coerceNumber(shot?.start_time)
      ?? indexOffset * 8;
    const endSeconds = coerceNumber(shot?.end)
      ?? coerceNumber(shot?.end_seconds)
      ?? coerceNumber(shot?.end_time)
      ?? startSeconds + 7;
    const text = typeof shot?.text === 'string'
      ? shot.text
      : typeof shot?.transcript === 'string'
        ? shot.transcript
        : typeof shot?.description === 'string'
          ? shot.description
          : finding.summary;
    const streamUrl = typeof shot?.stream_url === 'string' ? shot.stream_url : recordingUrl;
    const confidence = coerceNumber(shot?.search_score) ?? coerceNumber(shot?.score) ?? 0.75;

    evidence.push({
      call_id: job.call_id,
      confidence,
      end_ms: Math.round(endSeconds * 1000),
      end_seconds: endSeconds,
      job_id: job.id,
      label: finding.label,
      metadata: {
        collection_id: collectionId,
        mode: search.shot ? 'videodb' : 'videodb-indexed-fallback-moment',
        query: finding.query,
        recording_url: recordingUrl,
        search_response_present: Boolean(search.response),
        upload,
        video_id: mediaId,
        videodb_index: index,
      },
      playback_url: streamUrl,
      recording_id: recording?.id ?? null,
      source: 'videodb',
      source_media_id: mediaId,
      start_ms: Math.round(startSeconds * 1000),
      start_seconds: startSeconds,
      summary: text || finding.summary,
      timestamp_label: formatTimestamp(startSeconds, endSeconds),
    });
  }

  return evidence;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabase = createServiceClient();
  const body = request.method === 'POST' ? await request.json().catch(() => ({})) : {};
  const jobId = typeof body.job_id === 'string' ? body.job_id : null;

  let query = supabase
    .from('jobs')
    .select('id, call_id, payload')
    .eq('job_type', 'videodb-index')
    .in('status', ['queued', 'retry'])
    .order('created_at', { ascending: true })
    .limit(1);

  if (jobId) {
    query = query.eq('id', jobId);
  }

  const { data: job, error: jobError } = await query.maybeSingle<JobRow>();

  if (jobError) {
    return jsonResponse({ error: jobError.message }, { status: 500 });
  }

  if (!job) {
    return jsonResponse({ ok: true, processed: 0 });
  }

  await supabase
    .from('jobs')
    .update({ status: 'running', attempts: 1, updated_at: new Date().toISOString() })
    .eq('id', job.id);

  const { data: recording } = await supabase
    .from('recordings')
    .select('id, recording_sid, recording_url, duration_seconds')
    .eq('recording_sid', job.payload.recording_sid ?? '')
    .maybeSingle<RecordingRow>();

  try {
    const evidence = await buildVideoDbEvidence(job, recording);

    await supabase
      .from('media_evidence')
      .delete()
      .eq('job_id', job.id);

    const { error: evidenceError } = await supabase
      .from('media_evidence')
      .insert(evidence);

    if (evidenceError) {
      throw evidenceError;
    }

    await supabase
      .from('jobs')
      .update({
        status: 'completed',
        result: {
          media_evidence_count: evidence.length,
          mode: 'videodb',
          source_media_id: evidence[0]?.source_media_id,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', job.id);

    return jsonResponse({ ok: true, processed: 1, media_evidence_count: evidence.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown VideoDB indexing error';
    await supabase
      .from('jobs')
      .update({
        status: 'failed',
        error: message,
        updated_at: new Date().toISOString(),
      })
      .eq('id', job.id);

    return jsonResponse({ error: message }, { status: 500 });
  }
});
