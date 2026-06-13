import type { CallRecord, MediaEvidence, Recording, RiskSignal, TranscriptSegment, TracerState } from './types';

export const demoCall: CallRecord = {
  id: 'call_pending_inbound_twilio',
  caller: 'Waiting for call',
  startedAt: 'Not started',
  status: 'idle',
  summary: 'Call the JAGA Twilio number to start live transcription and recording.',
};

export const demoRecording: Recording = {
  id: 'rec_demo_001',
  callId: demoCall.id,
  status: 'pending',
};

export const transcriptFixture: TranscriptSegment[] = [
  {
    id: 'seg_001',
    callId: demoCall.id,
    speaker: 'Caller',
    text: 'Hello, this is calling from your bank security department.',
    timestamp: '0:04',
    isFinal: true,
    sequenceId: 1,
  },
  {
    id: 'seg_002',
    callId: demoCall.id,
    speaker: 'Caller',
    text: 'There has been an urgent transaction on your account and we need to verify you now.',
    timestamp: '0:11',
    isFinal: true,
    sequenceId: 2,
    riskSignalId: 'risk_001',
  },
  {
    id: 'seg_003',
    callId: demoCall.id,
    speaker: 'Caller',
    text: 'Do not hang up or tell anyone else, this is a confidential investigation.',
    timestamp: '0:18',
    isFinal: true,
    sequenceId: 3,
    riskSignalId: 'risk_002',
  },
  {
    id: 'seg_004',
    callId: demoCall.id,
    speaker: 'Caller',
    text: 'Please read me the one-time passcode you just received so I can block the transfer.',
    timestamp: '0:28',
    isFinal: true,
    sequenceId: 4,
    riskSignalId: 'risk_003',
  },
];

export const riskFixture: RiskSignal[] = [
  {
    id: 'risk_001',
    callId: demoCall.id,
    label: 'Urgency pressure',
    severity: 'suspicious',
    reason: 'Caller claims an urgent account issue and pushes immediate verification.',
    transcriptSegmentId: 'seg_002',
    timestamp: '0:11',
  },
  {
    id: 'risk_002',
    callId: demoCall.id,
    label: 'Secrecy request',
    severity: 'high',
    reason: 'Caller asks the user not to tell anyone else.',
    transcriptSegmentId: 'seg_003',
    timestamp: '0:18',
  },
  {
    id: 'risk_003',
    callId: demoCall.id,
    label: 'Credential request',
    severity: 'high',
    reason: 'Caller requests a one-time passcode.',
    transcriptSegmentId: 'seg_004',
    timestamp: '0:28',
  },
];

export const mediaEvidenceFixture: MediaEvidence[] = [
  {
    id: 'media_001',
    callId: demoCall.id,
    source: 'videodb',
    timestamp: '0:08-0:15',
    startMs: 8000,
    endMs: 15000,
    label: 'Urgency pressure',
    summary: 'VideoDB indexes the recording moment where the caller pushes immediate verification.',
    confidence: 0.82,
    playbackUrl: 'simulated://twilio-recording/RE_SIMULATED',
  },
  {
    id: 'media_002',
    callId: demoCall.id,
    source: 'videodb',
    timestamp: '0:18-0:25',
    startMs: 18000,
    endMs: 25000,
    label: 'Secrecy request',
    summary: 'Timestamped evidence captures the instruction not to hang up or tell family.',
    confidence: 0.91,
    playbackUrl: 'simulated://twilio-recording/RE_SIMULATED',
  },
  {
    id: 'media_003',
    callId: demoCall.id,
    source: 'videodb',
    timestamp: '0:30-0:38',
    startMs: 30000,
    endMs: 38000,
    label: 'Credential request',
    summary: 'The recording segment links the one-time passcode request to report evidence.',
    confidence: 0.94,
    playbackUrl: 'simulated://twilio-recording/RE_SIMULATED',
  },
];

export const initialTracerState: TracerState = {
  call: demoCall,
  partialText: '',
  transcript: [],
  signals: [],
  recording: demoRecording,
  mediaEvidence: [],
};
