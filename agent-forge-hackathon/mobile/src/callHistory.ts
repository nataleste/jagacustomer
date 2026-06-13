import { normalizeRiskSignal, normalizeTranscriptSegment } from './transcriptTimestamps';
import type { TracerState } from './types';

export type StoredCallSnapshot = {
  id: string;
  savedAt: string;
  state: TracerState;
};

const historyKey = 'jaga.demo.callHistory.v1';
const maxStoredCalls = 12;
const showSeededDemoHistory = import.meta.env.DEV;

function isSeededDemoState(state: TracerState) {
  const callId = state.call.twilioCallSid || state.call.id;
  const summary = state.call.summary.toLowerCase();

  return (
    callId.startsWith('CA_SIM_')
    || summary.includes('simulated twilio callback trace')
    || summary.includes('demo scam call')
  );
}

function hasMeaningfulSnapshot(state: TracerState) {
  if (
    state.call.status === 'idle'
    && state.transcript.length === 0
    && state.signals.length === 0
    && state.mediaEvidence.length === 0
    && !state.recording.url
  ) {
    return false;
  }

  return (
    state.call.status !== 'idle'
    || state.transcript.length > 0
    || state.signals.length > 0
    || state.mediaEvidence.length > 0
    || state.recording.status !== 'missing'
    || Boolean(state.recording.url)
  );
}

function normalizeSnapshot(snapshot: StoredCallSnapshot): StoredCallSnapshot | null {
  if (!snapshot || typeof snapshot !== 'object') return null;
  if (!snapshot.state || !snapshot.state.call) return null;
  if (!hasMeaningfulSnapshot(snapshot.state)) return null;
  if (!showSeededDemoHistory && isSeededDemoState(snapshot.state)) return null;

  return {
    id: snapshot.id || snapshot.state.call.twilioCallSid || snapshot.state.call.id,
    savedAt: snapshot.savedAt || new Date().toISOString(),
    state: {
      ...snapshot.state,
      partialText: snapshot.state.partialText || '',
      transcript: Array.isArray(snapshot.state.transcript)
        ? snapshot.state.transcript.map(normalizeTranscriptSegment)
        : [],
      signals: Array.isArray(snapshot.state.signals)
        ? snapshot.state.signals.map(normalizeRiskSignal)
        : [],
      mediaEvidence: Array.isArray(snapshot.state.mediaEvidence) ? snapshot.state.mediaEvidence : [],
    },
  };
}

export function loadCallHistory(): StoredCallSnapshot[] {
  try {
    const raw = window.localStorage.getItem(historyKey);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    const normalized = parsed
      .map((snapshot) => normalizeSnapshot(snapshot as StoredCallSnapshot))
      .filter((snapshot): snapshot is StoredCallSnapshot => Boolean(snapshot))
      .slice(0, maxStoredCalls);

    if (normalized.length !== parsed.length) {
      window.localStorage.setItem(historyKey, JSON.stringify(normalized));
    }

    return normalized;
  } catch {
    return [];
  }
}

export function saveCallSnapshot(state: TracerState): StoredCallSnapshot[] {
  const currentHistory = loadCallHistory();

  if (!hasMeaningfulSnapshot(state)) {
    return currentHistory;
  }

  if (!showSeededDemoHistory && isSeededDemoState(state)) {
    return currentHistory;
  }

  const id = state.call.twilioCallSid || state.call.id;
  const snapshot: StoredCallSnapshot = {
    id,
    savedAt: new Date().toISOString(),
    state,
  };

  const nextHistory = [
    snapshot,
    ...currentHistory.filter((item) => item.id !== id),
  ].slice(0, maxStoredCalls);

  try {
    window.localStorage.setItem(historyKey, JSON.stringify(nextHistory));
  } catch {
    return currentHistory;
  }

  return nextHistory;
}
