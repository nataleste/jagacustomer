export type CallStatus = 'idle' | 'live' | 'completed';

export type TranscriptSegment = {
  id: string;
  callId: string;
  speaker: string;
  text: string;
  timestamp: string;
  isFinal: boolean;
  sequenceId: number;
  riskSignalId?: string;
};

export type RiskSignal = {
  id: string;
  callId: string;
  label: string;
  severity: 'low' | 'suspicious' | 'high';
  reason: string;
  transcriptSegmentId: string;
  timestamp: string;
};

export type Recording = {
  id: string;
  callId: string;
  status: 'pending' | 'in-progress' | 'completed' | 'missing';
  recordingSid?: string;
  duration?: string;
  url?: string;
  storagePath?: string;
};

export type MediaEvidence = {
  id: string;
  callId: string;
  source: 'videodb';
  mode?: 'real' | 'seeded' | 'simulated' | 'probe';
  timestamp: string;
  startMs: number;
  endMs: number;
  label: string;
  summary: string;
  confidence: number;
  playbackUrl?: string;
  storagePath?: string;
};

export type CallRecord = {
  id: string;
  caller: string;
  startedAt: string;
  status: CallStatus;
  summary: string;
  twilioCallSid?: string;
};

export type TracerState = {
  call: CallRecord;
  partialText: string;
  partialSequenceId?: number;
  transcript: TranscriptSegment[];
  signals: RiskSignal[];
  recording: Recording;
  mediaEvidence: MediaEvidence[];
};

export type TwilioTranscriptEvent = {
  TranscriptionEvent: 'transcription-started' | 'transcription-content' | 'transcription-stopped';
  CallSid: string;
  TranscriptionSid: string;
  SequenceId: string;
  Track: string;
  Final: 'true' | 'false';
  TranscriptionData: string;
};
