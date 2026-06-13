import { mediaEvidenceFixture, riskFixture, transcriptFixture } from './tracerData';
import type { Recording, RiskSignal, TranscriptSegment, TracerState } from './types';

const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

type SimulatorHandlers = {
  onState: (updater: (state: TracerState) => TracerState) => void;
  onLog: (message: string) => void;
};

export async function runLocalTwilioSimulation({ onState, onLog }: SimulatorHandlers) {
  onLog('POST /twilio/voice -> TwiML starts <Transcription partialResults="true">');
  onState((state) => ({
    ...state,
    call: { ...state.call, status: 'live', startedAt: 'Live now' },
    partialText: '',
    transcript: [],
    signals: [],
    recording: { ...state.recording, status: 'pending' },
    mediaEvidence: [],
  }));

  await sleep(450);
  onLog('Twilio transcription-started callback accepted');

  for (const segment of transcriptFixture) {
    await sleep(700);
    const partial = segment.text.slice(0, Math.max(24, Math.floor(segment.text.length * 0.55)));
    onLog(`Twilio partial SequenceId=${segment.sequenceId}`);
    onState((state) => ({ ...state, partialText: partial }));

    await sleep(650);
    onLog(`Twilio final SequenceId=${segment.sequenceId} -> transcript_segments insert`);
    onState((state) => ({
      ...state,
      partialText: '',
      transcript: [...state.transcript, segment],
    }));

    const risk = riskFixture.find((item) => item.transcriptSegmentId === segment.id);
    if (risk) {
      await sleep(500);
      onLog(`Kimi live-risk-detection -> ${risk.label}`);
      onState((state) => ({
        ...state,
        signals: [...state.signals, risk],
      }));
    }
  }

  await sleep(600);
  const recording: Recording = {
    id: 'rec_demo_001',
    callId: 'call_demo_001',
    status: 'completed',
    duration: '0:42',
    url: 'simulated://twilio-recording/RE_SIMULATED',
  };
  onLog('POST /twilio/recording -> recordings row completed');
  onState((state) => ({
    ...state,
    call: { ...state.call, status: 'completed', startedAt: 'Completed' },
    recording,
  }));

  await sleep(500);
  onLog('VideoDB videodb-index -> 3 timestamped evidence moments');
  onState((state) => ({
    ...state,
    mediaEvidence: mediaEvidenceFixture.map((evidence) => ({
      ...evidence,
      callId: state.call.id,
      playbackUrl: recording.url,
    })),
  }));
}

export function getSegmentRisk(
  segment: TranscriptSegment,
  signals: RiskSignal[],
) {
  return signals.find((signal) => signal.transcriptSegmentId === segment.id);
}
