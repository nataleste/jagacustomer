import type { RiskSignal, TranscriptSegment } from './types';

export function formatElapsedTimestamp(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function timestampFromSequence(sequenceId: number | null) {
  return sequenceId === null ? 'live' : formatElapsedTimestamp(sequenceId);
}

export function normalizeTimestampLabel(timestamp: string, sequenceId?: number | null) {
  const sequenceMatch = timestamp.match(/^#(\d+)$/);
  if (sequenceMatch) {
    return formatElapsedTimestamp(Number.parseInt(sequenceMatch[1], 10));
  }

  if (!timestamp && sequenceId !== undefined) {
    return timestampFromSequence(sequenceId);
  }

  return timestamp;
}

export function normalizeTranscriptSegment(segment: TranscriptSegment): TranscriptSegment {
  return {
    ...segment,
    timestamp: normalizeTimestampLabel(segment.timestamp, segment.sequenceId),
  };
}

export function normalizeRiskSignal(signal: RiskSignal): RiskSignal {
  return {
    ...signal,
    timestamp: normalizeTimestampLabel(signal.timestamp),
  };
}
