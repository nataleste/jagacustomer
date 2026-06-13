import { Device } from '@twilio/voice-sdk';
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { loadCallHistory, saveCallSnapshot } from './callHistory';
import { initialTracerState } from './tracerData';
import { hasSupabaseConfig, supabase } from './supabaseClient';
import { fetchLatestSupabaseSnapshot } from './supabasePolling';
import { normalizeTranscriptSegment } from './transcriptTimestamps';
import { getSegmentRisk, runLocalTwilioSimulation } from './twilioSimulator';
import type { MediaEvidence, Recording, RiskSignal, TranscriptSegment, TracerState } from './types';

const maxLogs = 12;
const twilioBridgeUrl = (import.meta.env.VITE_TWILIO_BRIDGE_URL as string | undefined)
  || (import.meta.env.DEV ? 'http://127.0.0.1:8787' : undefined);
const hasTwilioBridge = Boolean(twilioBridgeUrl);
const liveBrowserTestAvailable = hasTwilioBridge;
const hasEventBridge = Boolean(twilioBridgeUrl && !twilioBridgeUrl.endsWith('/api'));
const seededReplayAvailable = import.meta.env.DEV;
const transcriptUrlPattern = /\b((?:https?:\/\/|www\.)[^\s<>"']+)/gi;
const demoDbsLink = 'dbs-secure.vercel.app';
const supabasePollIntervalMs = 800;

function isPlayableUrl(url: string | undefined) {
  return Boolean(url && /^(https?:|blob:|data:)/.test(url));
}

function recordingSidFromUrl(url: string | undefined) {
  return url?.match(/\/Recordings\/(RE[a-f0-9]{32})(?:\.mp3)?/i)?.[1];
}

function proxyRecordingUrl(recordingSid: string | undefined) {
  return recordingSid ? `${window.location.origin}/api/twilio/recordings/${recordingSid}.mp3` : '';
}

function normalizePlaybackUrl(url: string | undefined) {
  const recordingSid = recordingSidFromUrl(url);
  if (recordingSid) return proxyRecordingUrl(recordingSid);
  return isPlayableUrl(url) ? url : '';
}

function playbackUrlForState(state: TracerState) {
  const evidenceUrl = state.mediaEvidence
    .map((evidence) => normalizePlaybackUrl(evidence.playbackUrl))
    .find(Boolean);
  if (evidenceUrl) return evidenceUrl;
  return proxyRecordingUrl(state.recording.recordingSid) || normalizePlaybackUrl(state.recording.url);
}

function timestampStartMs(timestamp: string) {
  const [start] = timestamp.split('-');
  const [minutes, seconds] = start.split(':').map((part) => Number.parseInt(part, 10));
  if (Number.isNaN(minutes) || Number.isNaN(seconds)) return 0;
  return ((minutes * 60) + seconds) * 1000;
}

function transcriptMomentEndMs(timestamp: string, startMs: number) {
  if (!timestamp.includes('-')) return startMs + 7000;
  const [, end] = timestamp.split('-');
  const [minutes, seconds] = end.split(':').map((part) => Number.parseInt(part, 10));
  if (Number.isNaN(minutes) || Number.isNaN(seconds)) return startMs + 7000;
  return Math.max(startMs + 1000, ((minutes * 60) + seconds) * 1000);
}

function findVideoDbEvidenceForSegment(segment: TranscriptSegment, evidenceList: MediaEvidence[]) {
  const segmentStartMs = timestampStartMs(segment.timestamp);
  const segmentWords = segment.text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((word) => word.length > 3);

  const textMatch = evidenceList.find((evidence) => {
    const summary = evidence.summary.toLowerCase();
    return segmentWords.length > 0 && segmentWords.some((word) => summary.includes(word));
  });
  if (textMatch) return textMatch;

  return evidenceList
    .filter((evidence) => evidence.mode === 'real' || evidence.mode === 'probe')
    .map((evidence) => ({
      delta: Math.abs((evidence.startMs ?? timestampStartMs(evidence.timestamp)) - segmentStartMs),
      evidence,
    }))
    .filter((candidate) => candidate.delta <= 8000)
    .sort((a, b) => a.delta - b.delta)[0]?.evidence;
}

function formatSavedAt(savedAt: string) {
  const date = new Date(savedAt);
  if (Number.isNaN(date.getTime())) return 'Saved';

  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function historyRowKey(id: string, savedAt: string) {
  return `${id}:${savedAt}`;
}

function shortCallId(id: string | undefined) {
  if (!id) return '';
  return id.length > 8 ? id.slice(-8) : id;
}

function historyCallerLabel(caller: string, callId: string | undefined) {
  const trimmedCaller = caller.trim();
  const suffix = shortCallId(callId || trimmedCaller);

  if (trimmedCaller.startsWith('client:jaga-browser')) {
    return {
      title: 'Browser mic call',
      detail: suffix ? `ID ${suffix}` : 'Browser mic',
    };
  }

  if (!trimmedCaller || trimmedCaller === 'Unknown caller') {
    return {
      title: 'Unknown caller',
      detail: suffix ? `ID ${suffix}` : 'No caller ID',
    };
  }

  return {
    title: trimmedCaller,
    detail: suffix ? `ID ${suffix}` : '',
  };
}

function recordingDisplay(state: TracerState, playbackUrl: string | undefined) {
  if (playbackUrl) {
    return {
      status: 'Ready',
      detail: 'Playback ready on Home page.',
    };
  }

  if (state.call.status === 'idle') {
    return {
      status: 'Waiting',
      detail: 'Recording starts when a live call connects.',
    };
  }

  if (state.recording.status === 'missing') {
    return {
      status: 'Missing',
      detail: 'No completed Twilio recording was found for this call.',
    };
  }

  if (state.recording.status === 'in-progress' || state.call.status === 'live') {
    return {
      status: 'Recording',
      detail: 'Audio is being captured by Twilio.',
    };
  }

  return {
    status: 'Processing',
    detail: 'Waiting for Twilio recording callback.',
  };
}

function evidenceModeLabel(evidence: MediaEvidence) {
  if (evidence.mode === 'real') return 'VideoDB indexed';
  if (evidence.mode === 'probe') return 'VideoDB probe';
  if (evidence.mode === 'simulated') return 'simulated';
  if (evidence.mode === 'seeded') return 'seeded fallback';
  return 'stored evidence';
}

type DebugStatus = 'waiting' | 'ok' | 'warn';

type DebugItem = {
  label: string;
  value: string;
  status: DebugStatus;
};

type LinkInvestigationState = {
  domain: string;
  error?: string;
  report?: LinkInvestigationReport;
  status: 'queued' | 'running' | 'ready' | 'error';
  url: string;
};

type LinkInvestigationReport = {
  domain?: string;
  evidence?: {
    brightData?: {
      checked_count?: number;
      configured?: boolean;
      hit_count?: number;
      records?: Array<{
        error?: string | null;
        hit?: boolean;
        snippet?: string | null;
        source?: string;
        term?: string;
      }>;
    };
    finalUrl?: string;
    provider?: string;
    screenshot?: string;
    statusCode?: number;
  };
  findings?: string[];
  risk?: number;
  screenshot?: string;
  status?: string;
  summary?: string;
  url?: string;
  verdict?: string;
};

type TranscriptTextPart = {
  kind: 'text';
  value: string;
} | {
  domain: string;
  kind: 'url';
  trailing: string;
  value: string;
};

function urlDomainLabel(url: string) {
  try {
    const normalizedUrl = url.startsWith('www.') ? `https://${url}` : url;
    return new URL(normalizedUrl).hostname.replace(/^www\./, '');
  } catch {
    return 'Suspicious link';
  }
}

function normalizeInvestigationUrl(url: string) {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

function screenshotForReport(report: LinkInvestigationReport | undefined) {
  return report?.screenshot || report?.evidence?.screenshot || '';
}

function reportProvider(report: LinkInvestigationReport | undefined) {
  return report?.evidence?.provider || 'link-detonation';
}

function normalizeSpokenUrlText(text: string) {
  return text
    .toLowerCase()
    .replace(/\b(?:d\s*b\s*s|d\.b\.s\.|dvs)\b/g, 'dbs')
    .replace(/\b(?:vasel|vassal|versel|versell|vessel|vercell|vel)\b/g, 'vercel')
    .replace(/\b(?:for sale|file|virtual)\b/g, 'vercel')
    .replace(/\b(?:dot|period|point)\b/g, ' . ')
    .replace(/\b(?:dash|hyphen)\b/g, ' - ')
    .replace(/\b(?:slash|forward slash)\b/g, ' / ')
    .replace(/[^a-z0-9./-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function compactSpokenUrlText(text: string) {
  return normalizeSpokenUrlText(text).replace(/\s+/g, '');
}

function findDemoDbsLinkText(text: string) {
  const compact = compactSpokenUrlText(text);
  const spoken = normalizeSpokenUrlText(text);
  const mentionsDbsSecure = /\bdbs\b/.test(spoken) && /\bsecure\b/.test(spoken);
  const mentionsAppDestination = /\b(?:app|vercel)\b/.test(spoken);

  if (
    mentionsDbsSecure
    && mentionsAppDestination
  ) {
    return true;
  }

  return (
    compact.includes('dbs-secure.vercel.app')
    || compact.includes('dbssecurevercelapp')
    || compact.includes('dbs-securevercel.app')
    || compact.includes('dbs.secure-vercel.app')
    || compact.includes('dbs.-secure.vercel.app')
    || compact.includes('dbs.-securevercel.app')
  );
}

function shouldAttachDemoDbsLink(text: string, contextText: string) {
  return (
    findDemoDbsLinkText(text)
    || (
      findDemoDbsLinkText(contextText)
      && /\b(?:app|dash|file|for sale|hyphen|secure|vasel|vassal|vel|vercel|vercell|versell|versel|vessel|virtual)\b/i.test(text)
    )
  );
}

function splitTranscriptUrls(text: string, contextText = text): TranscriptTextPart[] {
  const parts: TranscriptTextPart[] = [];
  const matches = text.matchAll(transcriptUrlPattern);
  let lastIndex = 0;

  for (const match of matches) {
    const matchText = match[0];
    const matchIndex = match.index ?? 0;
    let url = matchText;
    let trailing = '';

    while (/[.,!?;:)\]}]$/.test(url)) {
      trailing = `${url.slice(-1)}${trailing}`;
      url = url.slice(0, -1);
    }

    if (matchIndex > lastIndex) {
      parts.push({ kind: 'text', value: text.slice(lastIndex, matchIndex) });
    }

    parts.push({
      domain: urlDomainLabel(url),
      kind: 'url',
      trailing,
      value: url,
    });
    lastIndex = matchIndex + matchText.length;
  }

  if (lastIndex < text.length) {
    parts.push({ kind: 'text', value: text.slice(lastIndex) });
  }

  if (parts.length > 0) return parts;

  return [{ kind: 'text', value: text }];
}

function App() {
  const [state, setState] = useState<TracerState>(initialTracerState);
  const [activePhoneView, setActivePhoneView] = useState<'live' | 'home'>('live');
  const [callHistory, setCallHistory] = useState(loadCallHistory);
  const [logs, setLogs] = useState<string[]>(['Waiting for an inbound Twilio call.']);
  const activeCallSidRef = useRef('');
  const liveTestCallRef = useRef<ReturnType<Device['connect']> extends Promise<infer T> ? T : never | null>(null);
  const liveTestDeviceRef = useRef<Device | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const archiveAudioRef = useRef<HTMLAudioElement>(null);
  const latestPartialSequenceRef = useRef(0);
  const latestSupabaseSignatureRef = useRef('');
  const skipNextHistorySaveRef = useRef(false);
  const [selectedEvidenceId, setSelectedEvidenceId] = useState('');
  const [selectedTranscriptId, setSelectedTranscriptId] = useState('');
  const [activePlaybackSrc, setActivePlaybackSrc] = useState('');
  const [selectedHistoryKey, setSelectedHistoryKey] = useState('');
  const [isStartingLiveTest, setIsStartingLiveTest] = useState(false);
  const [isLiveTestActive, setIsLiveTestActive] = useState(false);
  const [isReplayingDemo, setIsReplayingDemo] = useState(false);
  const [testPathStatus, setTestPathStatus] = useState('');
  const [linkInvestigation, setLinkInvestigation] = useState<LinkInvestigationState | null>(null);
  const [activeLinkReport, setActiveLinkReport] = useState<LinkInvestigationReport | null>(null);
  const [debug, setDebug] = useState({
    bridge: hasSupabaseConfig ? 'Supabase polling' : 'No bridge configured',
    voice: 'Waiting for call',
    transcript: 'No transcript yet',
    recording: 'No callback yet',
    activeCallSid: '',
    lastEventAt: '',
  });

  const liveState = state.call.status === 'completed' ? initialTracerState : state;

  const liveHighRiskCount = useMemo(
    () => liveState.signals.filter((signal) => signal.severity === 'high').length,
    [liveState.signals],
  );

  const playbackUrl = useMemo(() => {
    return playbackUrlForState(liveState);
  }, [liveState]);

  const audioSrc = activePlaybackSrc || playbackUrl;
  const recordingUi = useMemo(() => recordingDisplay(liveState, playbackUrl), [liveState, playbackUrl]);
  const archiveSnapshot = useMemo(
    () => callHistory.find((snapshot) => historyRowKey(snapshot.id, snapshot.savedAt) === selectedHistoryKey),
    [callHistory, selectedHistoryKey],
  );
  const archivePlaybackUrl = archiveSnapshot ? playbackUrlForState(archiveSnapshot.state) : '';

  const appendLog = useCallback((message: string) => {
    const time = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    setLogs((current) => [`${time}  ${message}`, ...current].slice(0, maxLogs));
  }, []);

  const touchDebug = useCallback((patch: Partial<typeof debug>) => {
    const time = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    setDebug((current) => ({ ...current, ...patch, lastEventAt: time }));
  }, []);

  useEffect(() => {
    if (skipNextHistorySaveRef.current) {
      skipNextHistorySaveRef.current = false;
      return;
    }

    setCallHistory(saveCallSnapshot(state));
  }, [state]);

  const openStoredCall = useCallback((snapshot: (typeof callHistory)[number]) => {
    activeCallSidRef.current = snapshot.state.call.twilioCallSid || snapshot.state.call.id;
    latestPartialSequenceRef.current = 0;
    skipNextHistorySaveRef.current = true;
    setActivePlaybackSrc('');
    setSelectedEvidenceId('');
    setSelectedTranscriptId('');
    setSelectedHistoryKey(historyRowKey(snapshot.id, snapshot.savedAt));
    setState(snapshot.state);
    touchDebug({
      activeCallSid: snapshot.state.call.twilioCallSid || snapshot.state.call.id,
      voice: `Opened browser history ${snapshot.state.call.status}`,
      transcript: `${snapshot.state.transcript.length} saved lines`,
      recording: snapshot.state.recording.status,
    });
    appendLog(`Opened browser history for ${snapshot.state.call.caller}.`);
  }, [appendLog, callHistory, touchDebug]);

  const seekPlaybackMoment = useCallback((options: {
    audio: HTMLAudioElement | null;
    endMs: number;
    label: string;
    sourceUrl: string | undefined;
    startMs: number;
    unavailableMessage: string;
  }) => {
    const { audio, endMs, label, sourceUrl, startMs, unavailableMessage } = options;
    if (!sourceUrl || !audio) {
      appendLog(unavailableMessage);
      return;
    }

    const seekSeconds = startMs / 1000;
    const endSeconds = endMs / 1000;
    const seek = () => {
      audio.currentTime = seekSeconds;
    };

    if (audioRef.current === audio) {
      setActivePlaybackSrc(`${sourceUrl}#t=${seekSeconds},${endSeconds}`);
    }
    if (audio.readyState === 0) {
      audio.addEventListener('loadedmetadata', seek, { once: true });
      audio.load();
    } else {
      seek();
    }

    window.setTimeout(seek, 120);
    void audio.play().catch(() => {
      appendLog('Browser blocked autoplay. Tap the audio control, then choose the moment again.');
    });
    appendLog(`Playing ${label} at ${Math.round(startMs / 1000)}s`);
  }, [appendLog]);

  const playEvidenceMoment = useCallback((evidence: MediaEvidence) => {
    setSelectedEvidenceId(evidence.id);
    setSelectedTranscriptId('');

    seekPlaybackMoment({
      audio: audioRef.current,
      endMs: evidence.endMs ?? (evidence.startMs ?? timestampStartMs(evidence.timestamp)) + 7000,
      label: `VideoDB moment ${evidence.timestamp}`,
      sourceUrl: playbackUrl,
      startMs: evidence.startMs ?? timestampStartMs(evidence.timestamp),
      unavailableMessage: `Selected VideoDB moment ${evidence.timestamp}; playback source is not browser-playable.`,
    });
  }, [playbackUrl, seekPlaybackMoment]);

  const playTranscriptMoment = useCallback((
    segment: TranscriptSegment,
    evidenceList: MediaEvidence[],
    sourceUrl: string | undefined,
    audio: HTMLAudioElement | null,
  ) => {
    const evidence = findVideoDbEvidenceForSegment(segment, evidenceList);
    const startMs = evidence?.startMs ?? timestampStartMs(segment.timestamp);
    const endMs = evidence?.endMs ?? transcriptMomentEndMs(segment.timestamp, startMs);

    setSelectedTranscriptId(segment.id);
    setSelectedEvidenceId(evidence?.id ?? '');
    seekPlaybackMoment({
      audio,
      endMs,
      label: evidence ? `VideoDB transcript line ${evidence.timestamp}` : `transcript line ${segment.timestamp}`,
      sourceUrl,
      startMs,
      unavailableMessage: `Selected transcript line ${segment.timestamp}; playback source is not browser-playable.`,
    });
  }, [seekPlaybackMoment]);

  const handleTranscriptKeyDown = useCallback((
    event: KeyboardEvent<HTMLElement>,
    play: () => void,
  ) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    play();
  }, []);

  const queueLinkInvestigation = useCallback((url: string, domain: string) => {
    setLinkInvestigation({ domain, status: 'queued', url });
    setActiveLinkReport(null);
    appendLog(`Link investigation queued -> ${domain}`);
    touchDebug({ transcript: `Link worker pending: ${domain}` });
    setTestPathStatus(`Link investigation queued for ${domain}.`);
  }, [appendLog, touchDebug]);

  const loadLinkReport = useCallback(async (investigation: LinkInvestigationState) => {
    if (investigation.status === 'running') return;
    if (investigation.report) {
      setActiveLinkReport(investigation.report);
      return;
    }

    setLinkInvestigation((current) => current?.url === investigation.url
      ? { ...current, error: undefined, status: 'running' }
      : current);
    setTestPathStatus(`Detonating ${investigation.domain}...`);
    appendLog(`Link detonation -> ${investigation.domain}`);

    try {
      const response = await fetch('/api/investigate-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'jaga-mobile-web',
          url: normalizeInvestigationUrl(investigation.url),
        }),
      });
      const report = await response.json() as LinkInvestigationReport & { error?: string };

      if (!response.ok) {
        throw new Error(report.error || `Investigation returned ${response.status}`);
      }

      setLinkInvestigation((current) => current?.url === investigation.url
        ? { ...current, report, status: 'ready' }
        : current);
      setActiveLinkReport(report);
      setTestPathStatus(`Report ready for ${investigation.domain}.`);
      touchDebug({ transcript: `Report ready: ${report.verdict ?? 'unknown'} risk ${report.risk ?? '-'}` });
      appendLog(`Link report ready -> ${report.verdict ?? 'unknown'} risk ${report.risk ?? '-'}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setLinkInvestigation((current) => current?.url === investigation.url
        ? { ...current, error: message, status: 'error' }
        : current);
      setTestPathStatus(`Link investigation failed: ${message}.`);
      touchDebug({ transcript: `Link report failed: ${investigation.domain}` });
      appendLog(`Link detonation failed -> ${message}`);
    }
  }, [appendLog, touchDebug]);

  const renderTranscriptText = useCallback((segment: TranscriptSegment, contextText = segment.text) => (
    <>
      <strong>{segment.speaker}:</strong>{' '}
      {splitTranscriptUrls(segment.text, contextText).map((part, index) => {
        if (part.kind === 'text') {
          return part.value;
        }

        return (
          <span className="transcript-link-wrap" key={`${segment.id}-${part.value}-${index}`}>
            <button
              aria-label={`Queue link investigation for ${part.domain}`}
              className="transcript-link-chip"
              onClick={(event) => {
                event.stopPropagation();
                queueLinkInvestigation(part.value, part.domain);
              }}
              title={part.value}
              type="button"
            >
              <span>{part.domain}</span>
              <em>Investigate</em>
            </button>
            {part.trailing}
          </span>
        );
      })}
      {shouldAttachDemoDbsLink(segment.text, contextText)
        ? (
          <span className="transcript-link-wrap">
            <button
              aria-label={`Queue link investigation for ${demoDbsLink}`}
              className="transcript-link-chip"
              onClick={(event) => {
                event.stopPropagation();
                queueLinkInvestigation(demoDbsLink, demoDbsLink);
              }}
              title={demoDbsLink}
              type="button"
            >
              <span>{demoDbsLink}</span>
              <em>Investigate</em>
            </button>
          </span>
        )
        : null}
    </>
  ), [queueLinkInvestigation]);

  const debugItems = useMemo<DebugItem[]>(
    () => [
      {
        label: 'Bridge',
        value: debug.bridge,
        status: debug.bridge === 'Connected' ? 'ok' : debug.bridge === 'Connecting' ? 'waiting' : 'warn',
      },
      {
        label: 'Call webhook',
        value: debug.voice,
        status: debug.voice === 'Waiting for call' ? 'waiting' : 'ok',
      },
      {
        label: 'Transcript',
        value: debug.transcript,
        status: debug.transcript === 'No transcript yet' ? 'waiting' : 'ok',
      },
      {
        label: 'Recording',
        value: debug.recording,
        status: debug.recording === 'No callback yet' ? 'waiting' : 'ok',
      },
    ],
    [debug],
  );

  useEffect(() => {
    if (!hasEventBridge) return undefined;

    const events = new EventSource(`${twilioBridgeUrl}/events`);

    events.onopen = () => {
      touchDebug({ bridge: 'Connected' });
    };

    events.addEventListener('bridge-ready', () => {
      touchDebug({ bridge: 'Connected' });
      appendLog('Local Twilio bridge connected.');
    });

    events.addEventListener('call-started', (event) => {
      const payload = JSON.parse(event.data) as {
        callSid: string;
        caller: string;
        startedAt: string;
        summary: string;
      };

      appendLog(`POST /twilio/voice -> ${payload.callSid}`);
      activeCallSidRef.current = payload.callSid;
      latestPartialSequenceRef.current = 0;
      setActivePlaybackSrc('');
      setSelectedEvidenceId('');
      setSelectedHistoryKey('');
      touchDebug({
        activeCallSid: payload.callSid,
        voice: `Picked up ${payload.callSid.slice(0, 10)}...`,
        transcript: 'Waiting for Twilio',
        recording: 'Waiting for callback',
      });
      setState((current) => ({
        ...current,
        call: {
          id: payload.callSid,
          caller: payload.caller,
          startedAt: payload.startedAt,
          status: 'live',
          summary: payload.summary,
          twilioCallSid: payload.callSid,
        },
        partialText: '',
        transcript: [],
        signals: [],
        mediaEvidence: [],
        recording: {
          id: `recording-${payload.callSid}`,
          callId: payload.callSid,
          status: 'pending',
        },
      }));
    });

    events.addEventListener('transcript-partial', (event) => {
      const payload = JSON.parse(event.data) as { callSid: string; text: string; sequenceId: number };
      if (payload.callSid !== activeCallSidRef.current || payload.sequenceId < latestPartialSequenceRef.current) {
        return;
      }

      latestPartialSequenceRef.current = payload.sequenceId;
      appendLog(`Twilio partial SequenceId=${payload.sequenceId}`);
      touchDebug({ transcript: `Streaming partial #${payload.sequenceId}` });
      setState((current) => ({ ...current, partialText: payload.text }));
    });

    events.addEventListener('transcript-final', (event) => {
      const segment = normalizeTranscriptSegment(JSON.parse(event.data) as TranscriptSegment);
      if (segment.callId !== activeCallSidRef.current) {
        return;
      }

      latestPartialSequenceRef.current = Math.max(latestPartialSequenceRef.current, segment.sequenceId);
      appendLog(`Twilio final SequenceId=${segment.sequenceId}`);
      touchDebug({ transcript: `Final line #${segment.sequenceId}` });
      setState((current) => ({
        ...current,
        partialText: '',
        transcript: current.transcript.some((item) => item.id === segment.id)
          ? current.transcript
          : [...current.transcript, segment],
      }));
    });

    events.addEventListener('risk-signal', (event) => {
      const signal = JSON.parse(event.data) as RiskSignal;
      appendLog(`Live risk -> ${signal.label}`);
      touchDebug({ transcript: `Risk tagged: ${signal.label}` });
      setState((current) => ({
        ...current,
        signals: current.signals.some((item) => item.id === signal.id)
          ? current.signals
          : [...current.signals, signal],
      }));
    });

    events.addEventListener('recording-status', (event) => {
      const recording = JSON.parse(event.data) as Recording;
      appendLog(`POST /twilio/recording -> ${recording.status}`);
      touchDebug({ recording: recording.status });
      setState((current) => ({
        ...current,
        call: recording.status === 'completed'
          ? { ...current.call, status: 'completed', startedAt: 'Completed' }
          : current.call,
        recording: {
          ...current.recording,
          ...recording,
        },
      }));
    });

    events.addEventListener('videodb-evidence', (event) => {
      const payload = JSON.parse(event.data) as { callSid: string; evidence: MediaEvidence[] };
      if (payload.callSid !== activeCallSidRef.current) {
        return;
      }

      appendLog(`VideoDB indexed ${payload.evidence.length} media moments`);
      touchDebug({ recording: `VideoDB ${payload.evidence.length} moments` });
      setState((current) => ({
        ...current,
        mediaEvidence: payload.evidence,
      }));
    });

    events.addEventListener('trace', (event) => {
      const payload = JSON.parse(event.data) as { message: string };
      touchDebug({});
      appendLog(payload.message);
    });

    events.onerror = () => {
      setDebug((current) => ({ ...current, bridge: 'Disconnected' }));
      appendLog('Local Twilio bridge disconnected.');
    };

    return () => events.close();
  }, [appendLog, touchDebug]);

  useEffect(() => {
    if (!hasSupabaseConfig) return undefined;

    let isActive = true;

    const poll = async () => {
      try {
        const snapshot = await fetchLatestSupabaseSnapshot();
        if (!isActive || !snapshot) return;

        const signature = [
          snapshot.call.id,
          snapshot.call.status,
          snapshot.transcript.length,
          snapshot.partialText,
          snapshot.partialSequenceId ?? '',
          snapshot.signals.length,
          snapshot.recording.status,
          snapshot.mediaEvidence.length,
        ].join(':');

        if (signature === latestSupabaseSignatureRef.current) return;
        latestSupabaseSignatureRef.current = signature;
        activeCallSidRef.current = snapshot.call.twilioCallSid || snapshot.call.id;
        latestPartialSequenceRef.current = Math.max(
          0,
          snapshot.partialSequenceId ?? 0,
          ...snapshot.transcript.map((segment) => segment.sequenceId),
        );
        setSelectedHistoryKey('');
        setActivePlaybackSrc('');
        setSelectedEvidenceId('');
        setState(snapshot);
        touchDebug({
          bridge: 'Supabase polling',
          activeCallSid: snapshot.call.twilioCallSid || snapshot.call.id,
          voice: `Loaded ${snapshot.call.status}`,
          transcript: snapshot.partialText
            ? 'Streaming partial'
            : `${snapshot.transcript.length} final lines`,
          recording: snapshot.recording.status,
        });
        appendLog(`Supabase sync -> ${snapshot.call.status}, ${snapshot.transcript.length} lines.`);
      } catch (error) {
        if (!isActive) return;
        const message = error instanceof Error
          ? error.message
          : typeof error === 'object' && error && 'message' in error && typeof error.message === 'string'
            ? error.message
            : 'Unknown Supabase error';
        touchDebug({ bridge: 'Supabase error' });
        appendLog(`Supabase sync failed: ${message}`);
      }
    };

    void poll();
    const realtimeChannel = supabase
      ?.channel('jaga-mobile-live-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'calls' }, () => void poll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transcript_partials' }, () => void poll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transcript_segments' }, () => void poll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'risk_signals' }, () => void poll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'recordings' }, () => void poll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'media_evidence' }, () => void poll())
      .subscribe((status) => {
        if (!isActive) return;
        if (status === 'SUBSCRIBED') {
          touchDebug({ bridge: 'Supabase realtime' });
          appendLog('Supabase realtime subscribed.');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          touchDebug({ bridge: 'Supabase polling fallback' });
          appendLog(`Supabase realtime ${status.toLowerCase()}; polling continues.`);
        }
      });
    const intervalId = window.setInterval(() => {
      void poll();
    }, supabasePollIntervalMs);

    return () => {
      isActive = false;
      window.clearInterval(intervalId);
      if (realtimeChannel) {
        void supabase?.removeChannel(realtimeChannel);
      }
    };
  }, [appendLog, touchDebug]);

  const replaySeededDemo = useCallback(async () => {
    if (isReplayingDemo) return;

    setIsReplayingDemo(true);
    setTestPathStatus('Replaying seeded demo...');
    setSelectedHistoryKey('');
    appendLog('Seeded replay -> starting bridge happy path.');
    touchDebug({
      voice: 'Replaying seeded demo',
      transcript: 'Seeded fallback',
      recording: 'Demo playback',
    });

    try {
      if (!hasTwilioBridge) {
        throw new Error('Local Twilio bridge is not configured');
      }

      const response = await fetch(`${twilioBridgeUrl}/demo/happy-path`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ Source: 'Debug test button' }),
      });

      if (!response.ok) {
        throw new Error(`Bridge returned ${response.status}`);
      }

      const payload = await response.json() as { callSid?: string };
      appendLog(`Seeded replay -> bridge demo ${payload.callSid ?? 'started'}`);
      setTestPathStatus('Seeded demo replayed.');
    } catch {
      appendLog('Seeded replay -> bridge unavailable, using in-browser simulator.');
      activeCallSidRef.current = 'call_demo_001';
      latestPartialSequenceRef.current = 0;
      setActivePlaybackSrc('');
      setSelectedEvidenceId('');
      await runLocalTwilioSimulation({
        onLog: appendLog,
        onState: (updater) => setState(updater),
      });
      touchDebug({
        activeCallSid: 'call_demo_001',
        voice: 'Local test complete',
        transcript: 'Seeded demo transcript',
        recording: 'VideoDB seeded moments',
      });
      setTestPathStatus('Local demo call replayed.');
    } finally {
      setIsReplayingDemo(false);
    }
  }, [appendLog, isReplayingDemo, touchDebug]);

  const startLiveTestCall = useCallback(async () => {
    if (isStartingLiveTest || isLiveTestActive) return;

    setIsStartingLiveTest(true);
    setTestPathStatus('Starting live Twilio test. Allow microphone access when prompted.');
    setSelectedHistoryKey('');
    appendLog('Live test -> requesting Twilio Voice SDK token.');
    touchDebug({
      voice: 'Starting live test',
      transcript: 'Waiting for browser mic',
      recording: 'Waiting for callback',
    });

    try {
      if (!liveBrowserTestAvailable) {
        throw new Error('Live browser test is local-only until an HTTPS Twilio token bridge is configured');
      }

      const response = await fetch(`${twilioBridgeUrl}/debug/live-test-token`);
      const payload = await response.json() as {
        connectParams?: Record<string, string>;
        error?: string;
        identity?: string;
        missing?: string[];
        mode?: string;
        token?: string;
      };

      if (!response.ok || !payload.token) {
        throw new Error(payload.missing?.length
          ? `Missing ${payload.missing.join(', ')}`
          : payload.error || `Bridge returned ${response.status}`);
      }

      appendLog(`Live test -> token issued for ${payload.identity ?? 'browser'}.`);
      touchDebug({
        voice: 'Opening browser mic',
        transcript: 'Starting live transcription',
      });

      liveTestCallRef.current?.disconnect();
      liveTestDeviceRef.current?.destroy();

      const device = new Device(payload.token, {
        logLevel: 1,
      });
      liveTestDeviceRef.current = device;

      device.on('registered', () => {
        appendLog('Live test -> Voice SDK registered.');
        touchDebug({ voice: 'Voice SDK ready' });
      });
      device.on('error', (error) => {
        const message = error instanceof Error ? error.message : String(error);
        appendLog(`Live test error -> ${message}`);
        setTestPathStatus(`Live test failed: ${message}.`);
        touchDebug({ voice: 'Live test error', transcript: 'No live transcript yet' });
        setIsLiveTestActive(false);
      });

      await device.register();
      const call = await device.connect({ params: payload.connectParams ?? { Source: 'debug-live-test-button' } });
      liveTestCallRef.current = call;

      call.on('accept', () => {
        appendLog('Live test -> connected. Speak now.');
        setTestPathStatus('Live test connected. Speak into this browser and watch Transcript.');
        setIsLiveTestActive(true);
        touchDebug({
          voice: 'Browser mic live',
          transcript: 'Listening for Twilio transcript',
          recording: 'Waiting for callback',
        });
      });
      call.on('disconnect', () => {
        appendLog('Live test -> disconnected.');
        setTestPathStatus('Live test ended.');
        setIsLiveTestActive(false);
        touchDebug({ voice: 'Live test ended' });
      });
      call.on('cancel', () => {
        appendLog('Live test -> cancelled.');
        setTestPathStatus('Live test cancelled.');
        setIsLiveTestActive(false);
        touchDebug({ voice: 'Live test cancelled' });
      });
      call.on('error', (error) => {
        const message = error instanceof Error ? error.message : String(error);
        appendLog(`Live test call error -> ${message}`);
        setTestPathStatus(`Live test failed: ${message}.`);
        setIsLiveTestActive(false);
        touchDebug({ voice: 'Live test error' });
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      appendLog(`Live test blocked -> ${message}`);
      setTestPathStatus(`Live test blocked: ${message}.`);
      touchDebug({
        voice: 'Live test blocked',
        transcript: 'No live transcript yet',
      });
    } finally {
      setIsStartingLiveTest(false);
    }
  }, [appendLog, isLiveTestActive, isStartingLiveTest, touchDebug]);

  const stopLiveTestCall = useCallback(() => {
    liveTestCallRef.current?.disconnect();
    liveTestDeviceRef.current?.destroy();
    liveTestCallRef.current = null;
    liveTestDeviceRef.current = null;
    setIsLiveTestActive(false);
    setTestPathStatus('Live test stopped.');
    touchDebug({ voice: 'Live test stopped' });
    appendLog('Live test -> stopped from browser.');
  }, [appendLog, touchDebug]);

  useEffect(() => () => {
    liveTestCallRef.current?.disconnect();
    liveTestDeviceRef.current?.destroy();
  }, []);

  const liveTestButtonLabel = isStartingLiveTest
    ? 'Starting live test...'
    : isLiveTestActive
      ? 'Live test running'
      : liveBrowserTestAvailable
        ? 'Start live test'
        : 'Live test local-only';

  return (
    <main className="app-shell">
      <section className="phone-frame">
        <header className="top-bar">
          <div>
            <p className="eyebrow">JAGA tracer</p>
            <h1>Calls</h1>
          </div>
          <span className={`live-pill ${liveState.call.status}`}>{liveState.call.status}</span>
        </header>

        <nav className="phone-switcher" aria-label="Phone view">
          <button
            aria-pressed={activePhoneView === 'live'}
            className={activePhoneView === 'live' ? 'active' : ''}
            onClick={() => setActivePhoneView('live')}
            type="button"
          >
            Live call
          </button>
          <button
            aria-pressed={activePhoneView === 'home'}
            className={activePhoneView === 'home' ? 'active' : ''}
            onClick={() => setActivePhoneView('home')}
            type="button"
          >
            Home page
          </button>
        </nav>

        <div className="phone-view" hidden={activePhoneView !== 'home'}>
          <section className="home-panel" aria-label="Home page">
            {archiveSnapshot ? (
              <>
                <div className="home-detail-nav">
                  <button
                    className="secondary"
                    onClick={() => setSelectedHistoryKey('')}
                    type="button"
                  >
                    Back
                  </button>
                  <span>{formatSavedAt(archiveSnapshot.savedAt)}</span>
                </div>

                <section className="archive-detail active" aria-label="Call detail">
                  <div className="archive-summary">
                    <div>
                      <p className="label">Call detail</p>
                      <h2>{archiveSnapshot.state.call.caller}</h2>
                      <p>{archiveSnapshot.state.call.summary}</p>
                    </div>
                    <span>{archiveSnapshot.state.call.status}</span>
                  </div>

                  <div className="archive-metrics">
                    <span>{archiveSnapshot.state.transcript.length} lines</span>
                    <span>{archiveSnapshot.state.signals.length} signals</span>
                    <span>{archiveSnapshot.state.recording.status}</span>
                  </div>

                  <div className="archive-transcript">
                    {archiveSnapshot.state.transcript.length > 0 ? (
                      archiveSnapshot.state.transcript.map((segment, index, transcript) => {
                        const contextText = [
                          transcript[index - 1]?.text,
                          segment.text,
                          transcript[index + 1]?.text,
                        ].filter(Boolean).join(' ');
                        const playLine = () => playTranscriptMoment(
                          segment,
                          archiveSnapshot.state.mediaEvidence,
                          archivePlaybackUrl,
                          archiveAudioRef.current,
                        );

                        return (
                          <article
                            aria-label={`Play transcript line at ${segment.timestamp}`}
                            className={`archive-transcript-row ${selectedTranscriptId === segment.id ? 'selected' : ''}`}
                            key={segment.id}
                            onClick={playLine}
                            onKeyDown={(event) => handleTranscriptKeyDown(event, playLine)}
                            role="button"
                            tabIndex={0}
                            title="Play this transcript line"
                          >
                            <time>{segment.timestamp}</time>
                            <p>
                              {renderTranscriptText(segment, contextText)}
                            </p>
                          </article>
                        );
                      })
                    ) : (
                      <p className="media-evidence-empty">No transcript captured for this call yet.</p>
                    )}
                  </div>

                  {!archivePlaybackUrl ? (
                    <div className="archive-recording">
                      <strong>Recording</strong>
                      <span>{archiveSnapshot.state.recording.status}</span>
                    </div>
                  ) : null}

                  {archivePlaybackUrl ? (
                    <div className="recording-playback">
                      <audio controls preload="metadata" ref={archiveAudioRef} src={archivePlaybackUrl}>
                        <track kind="captions" />
                      </audio>
                      <p>Past call recording from Twilio. Transcript lines seek using VideoDB timestamps.</p>
                    </div>
                  ) : (
                    <p className="media-evidence-empty">No playable recording URL is available for this call yet.</p>
                  )}

                  {archiveSnapshot.state.mediaEvidence.length > 0 ? (
                    <section className="media-evidence-list" aria-label="VideoDB evidence moments">
                      {archiveSnapshot.state.mediaEvidence.map((evidence) => (
                        <article className="media-evidence-row" key={evidence.id}>
                          <time>{evidence.timestamp}</time>
                          <div>
                            <strong>{evidence.label}</strong>
                            <p>{evidence.summary}</p>
                          </div>
                          <div className="media-evidence-actions">
                            <span>{evidenceModeLabel(evidence)}</span>
                          </div>
                        </article>
                      ))}
                    </section>
                  ) : null}
                </section>

                {archiveSnapshot.state.call.status === 'live' ? (
                  <button className="secondary" onClick={() => setActivePhoneView('live')} type="button">
                    Open live call
                  </button>
                ) : null}
              </>
            ) : (
              <>
                <div className="section-heading">
                  <p className="label">JAGA home</p>
                  <h2>Call history</h2>
                  <p>Tap a call to review transcript and recording details.</p>
                </div>

                {callHistory.length > 0 ? (
                  <div className="history-list home-history-list">
                    {callHistory.map((snapshot) => {
                      const rowKey = historyRowKey(snapshot.id, snapshot.savedAt);
                      const callId = snapshot.state.call.twilioCallSid || snapshot.state.call.id;
                      const callerLabel = historyCallerLabel(snapshot.state.call.caller, callId);
                      const rowPlaybackUrl = playbackUrlForState(snapshot.state);
                      const rowRecordingStatus = rowPlaybackUrl ? 'ready' : snapshot.state.recording.status;
                      return (
                        <button
                          className="history-row"
                          key={rowKey}
                          onClick={() => setSelectedHistoryKey(rowKey)}
                          type="button"
                        >
                          <span>
                            <strong>{callerLabel.title}</strong>
                            <small>
                              {callerLabel.detail} · {formatSavedAt(snapshot.savedAt)} · {snapshot.state.call.status}
                            </small>
                          </span>
                          <em>
                            {snapshot.state.transcript.length} lines · {snapshot.state.signals.length} signals · rec {rowRecordingStatus}
                          </em>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="empty-state home-empty">
                    No real browser calls yet. Start from Live call and speak into the mic.
                  </div>
                )}

                <button className="secondary home-live-link" onClick={() => setActivePhoneView('live')} type="button">
                  Open live call
                </button>
              </>
            )}
          </section>
        </div>

        <div className="phone-view" hidden={activePhoneView !== 'live'}>
          <section className="call-card live-call-card" aria-label="Live call">
            <div>
              <p className="label">Twilio call</p>
              <h2>{liveState.call.caller}</h2>
              <p>{liveState.call.summary}</p>
            </div>
          </section>

          <section className="live-strip" aria-label="Live call status">
            <span>{liveState.transcript.length} lines</span>
            <span>{liveState.signals.length} signals</span>
            <span>{liveHighRiskCount} high risk</span>
            <span>rec {recordingUi.status.toLowerCase()}</span>
          </section>

          <section className="transcript-panel" aria-label="Transcript">
            <div className="section-heading">
              <h2>Transcript</h2>
              <p>Live call transcript and suspicious links appear here.</p>
            </div>

            {liveState.transcript.length === 0 && !liveState.partialText ? (
              <div className="empty-state">
                Call the JAGA Twilio number from a verified phone.
              </div>
            ) : null}

            <div className="transcript-list">
              {liveState.transcript.map((segment, index, transcript) => {
                const risk = getSegmentRisk(segment, liveState.signals);
                const contextText = [
                  transcript[index - 1]?.text,
                  segment.text,
                        transcript[index + 1]?.text,
                      ].filter(Boolean).join(' ');
                      const playLine = () => playTranscriptMoment(
                        segment,
                        liveState.mediaEvidence,
                        playbackUrl,
                        audioRef.current,
                      );

                      return (
                  <article
                    aria-label={`Play transcript line at ${segment.timestamp}`}
                    className={`transcript-row ${risk ? 'has-risk' : ''} ${selectedTranscriptId === segment.id ? 'selected' : ''}`}
                    key={segment.id}
                    onClick={playLine}
                    onKeyDown={(event) => handleTranscriptKeyDown(event, playLine)}
                    role="button"
                    tabIndex={0}
                    title="Play this transcript line"
                  >
                    <time>{segment.timestamp}</time>
                    <p>
                      {renderTranscriptText(segment, contextText)}
                    </p>
                    {risk ? <span className={`risk-tag ${risk.severity}`}>{risk.label}</span> : null}
                  </article>
                );
              })}

              {liveState.partialText ? (
                <article className="transcript-row partial">
                  <time>live</time>
                  <p>
                    {renderTranscriptText({
                      id: 'live-partial',
                      callId: liveState.call.twilioCallSid || liveState.call.id,
                      speaker: 'Caller',
                      text: liveState.partialText,
                      timestamp: 'live',
                      isFinal: false,
                      sequenceId: latestPartialSequenceRef.current,
                    }, liveState.partialText)}
                  </p>
                </article>
              ) : null}
            </div>

            {linkInvestigation ? (
              <aside className="sandbox-drawer" aria-label="Sandbox investigation status">
                <div>
                  <p className="label">Sandbox</p>
                  <strong>
                    {linkInvestigation.status === 'ready'
                      ? 'Report ready'
                      : linkInvestigation.status === 'running'
                        ? 'Detonating link'
                        : linkInvestigation.status === 'error'
                          ? 'Detonation failed'
                          : 'Queued for detonation'}
                  </strong>
                  <span>{linkInvestigation.domain}</span>
                  {linkInvestigation.error ? <small>{linkInvestigation.error}</small> : null}
                </div>
                <button
                  disabled={linkInvestigation.status === 'running'}
                  onClick={() => void loadLinkReport(linkInvestigation)}
                  type="button"
                >
                  {linkInvestigation.status === 'running' ? 'Detonating...' : 'View report'}
                </button>
              </aside>
            ) : null}

            {liveState.mediaEvidence.length > 0 ? (
              <section className="media-evidence-list" aria-label="VideoDB evidence moments">
                {liveState.mediaEvidence.map((evidence) => (
                  <article
                    className={`media-evidence-row ${selectedEvidenceId === evidence.id ? 'selected' : ''}`}
                    key={evidence.id}
                  >
                    <time>{evidence.timestamp}</time>
                    <div>
                      <strong>{evidence.label}</strong>
                      <p>{evidence.summary}</p>
                    </div>
                    <div className="media-evidence-actions">
                      <span>{evidenceModeLabel(evidence)}</span>
                      <button onClick={() => playEvidenceMoment(evidence)} type="button">
                        Play
                      </button>
                    </div>
                  </article>
                ))}
              </section>
            ) : null}

            {playbackUrl ? (
              <div className="recording-compact">
                <div>
                  <p className="label">Recording</p>
                  <strong>{recordingUi.status}</strong>
                </div>
                <audio controls preload="metadata" ref={audioRef} src={audioSrc}>
                  <track kind="captions" />
                </audio>
              </div>
            ) : null}

            {activeLinkReport ? (
              <section className="link-report-panel" aria-label="Sandbox report">
                <div className="link-report-header">
                  <div>
                    <p className="label">Sandbox report</p>
                    <h2>{activeLinkReport.domain || linkInvestigation?.domain || 'Suspicious link'}</h2>
                  </div>
                  <button className="secondary" onClick={() => setActiveLinkReport(null)} type="button">
                    Close
                  </button>
                </div>

                <div className="link-report-metrics">
                  <span>{activeLinkReport.verdict || 'unknown'}</span>
                  <span>Risk {activeLinkReport.risk ?? '-'}</span>
                </div>

                {activeLinkReport.summary ? <p>{activeLinkReport.summary}</p> : null}

                {activeLinkReport.findings?.length ? (
                  <ul>
                    {activeLinkReport.findings.map((finding) => (
                      <li key={finding}>{finding}</li>
                    ))}
                  </ul>
                ) : null}

                <div className="link-report-evidence">
                  <span>Provider: {reportProvider(activeLinkReport)}</span>
                  {activeLinkReport.evidence?.finalUrl ? (
                    <span>Final URL: {activeLinkReport.evidence.finalUrl}</span>
                  ) : null}
                  {activeLinkReport.evidence?.statusCode ? (
                    <span>HTTP {activeLinkReport.evidence.statusCode}</span>
                  ) : null}
                  {activeLinkReport.evidence?.brightData?.configured ? (
                    <span>
                      Bright Data checked {activeLinkReport.evidence.brightData.checked_count ?? 0} source(s),
                      {' '}
                      {activeLinkReport.evidence.brightData.hit_count ?? 0} hit(s)
                    </span>
                  ) : null}
                </div>

                {screenshotForReport(activeLinkReport) ? (
                  <img alt="Sandbox evidence screenshot" src={screenshotForReport(activeLinkReport)} />
                ) : null}
              </section>
            ) : null}
          </section>
        </div>
      </section>

      <aside className="operator-panel" aria-label="Desktop operator console">
        <section className="debug-panel" aria-label="Twilio debug status">
          <div className="section-heading">
            <h2>Operator console</h2>
            <p>
              Call {state.call.twilioCallSid || debug.activeCallSid || 'not started'} via{' '}
              {hasSupabaseConfig ? 'Supabase' : twilioBridgeUrl || 'local simulator'}
            </p>
          </div>

          <div className="debug-grid">
            {debugItems.map((item) => (
              <div className={`debug-item ${item.status}`} key={item.label}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>

          <p className="debug-last-event">
            {debug.lastEventAt ? `Last event ${debug.lastEventAt}` : 'Waiting for first bridge event'}
          </p>

          <div className="demo-paths" aria-label="Demo and test call paths">
            <div>
              <span>Actual demo path</span>
              <p>Keep this waiting for the native phone Add People flow.</p>
            </div>
            <div>
              <span>Live browser test</span>
              <p>
                {liveBrowserTestAvailable
                  ? 'Uses this browser microphone and Twilio live transcription.'
                  : 'Local-only unless a public HTTPS Twilio token bridge is configured.'}
              </p>
            </div>
            <div className="dev-call-actions">
              <button
                className="dev-call-button"
                disabled={!liveBrowserTestAvailable || isStartingLiveTest || isLiveTestActive}
                onClick={startLiveTestCall}
                type="button"
              >
                {liveTestButtonLabel}
              </button>
              {isLiveTestActive ? (
                <button
                  className="secondary dev-call-button"
                  onClick={stopLiveTestCall}
                  type="button"
                >
                  End live test
                </button>
              ) : null}
              {seededReplayAvailable ? (
                <button
                  className="secondary dev-call-button"
                  disabled={isReplayingDemo}
                  onClick={replaySeededDemo}
                  type="button"
                >
                  {isReplayingDemo ? 'Replaying local demo...' : 'Replay local seeded demo'}
                </button>
              ) : null}
            </div>
            {testPathStatus ? <p className="test-path-status">{testPathStatus}</p> : null}
          </div>
        </section>

        <section className="logs-panel">
          <h2>Trace</h2>
          {logs.map((log, index) => (
            <p key={`${index}-${log}`}>{log}</p>
          ))}
        </section>
      </aside>
    </main>
  );
}

export default App;
