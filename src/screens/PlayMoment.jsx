import { useNavigate } from 'react-router-dom'
import PhoneFrame from '../components/PhoneFrame'
import { Eyebrow, SecondaryButton } from '../components/ui'
import { ChevronLeft, LockIcon } from '../components/icons'

const BARS = [14, 26, 38, 20, 46, 30, 18, 34, 50, 24, 40, 16, 30, 44, 22, 36, 28, 48, 18, 32, 42, 20, 34, 26, 38, 16]
const PLAYED = 10 // bars before the playhead

function Waveform() {
  return (
    <div className="flex h-[54px] items-center gap-[3px]">
      {BARS.map((h, i) => (
        <div
          key={i}
          className={`w-1 rounded-[2px] ${i < PLAYED ? 'bg-ink' : 'bg-line'}`}
          style={{ height: h }}
        />
      ))}
    </div>
  )
}

function SkipIcon({ back }) {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" className="text-ink">
      {back ? (
        <>
          <path d="M11 7L6 12L11 17" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M17 7L12 12L17 17" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </>
      ) : (
        <>
          <path d="M13 7L18 12L13 17" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M7 7L12 12L7 17" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
    </svg>
  )
}

export default function PlayMoment() {
  const navigate = useNavigate()
  return (
    <PhoneFrame back={false}>
      <div className="flex flex-1 flex-col gap-[18px] px-5 pb-5 pt-2">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button type="button" aria-label="Back" onClick={() => navigate(-1)} className="shrink-0 text-ink">
            <ChevronLeft size={20} />
          </button>
          <div className="flex flex-1 flex-col gap-0.5">
            <Eyebrow className="text-muted">From your call recording</Eyebrow>
            <span className="text-[22px] font-black leading-[27px] text-ink">Key moment · 3:55</span>
          </div>
        </div>

        {/* The moment */}
        <div className="flex flex-col gap-3 rounded-card border border-scam-border bg-scam-bg p-[18px]">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-scam px-2.5 py-[5px] text-[12px] font-black uppercase leading-[15px] tracking-[0.04em] text-white">
              Money demand
            </span>
            <span className="text-[14px] font-bold leading-[18px] text-scam-deep">Caller</span>
          </div>
          <p className="text-[23px] font-extrabold leading-[31px] text-ink">
            “Move your money to this safe account right now.”
          </p>
        </div>

        {/* Player */}
        <div className="flex flex-col gap-3.5 rounded-[18px] border border-line px-[18px] py-5">
          <Waveform />
          <div className="flex items-center justify-between">
            <span className="font-mono text-[14px] font-bold leading-[18px] text-ink">0:04</span>
            <span className="font-mono text-[14px] font-semibold leading-[18px] text-muted">0:11</span>
          </div>
          <div className="flex items-center justify-center gap-7 pt-0.5">
            <SkipIcon back />
            <div className="flex h-[68px] w-[68px] shrink-0 items-center justify-center rounded-full bg-ink">
              <div className="flex gap-[3px]">
                <span className="h-[18px] w-[3.4px] rounded-[1.4px] bg-white" />
                <span className="h-[18px] w-[3.4px] rounded-[1.4px] bg-white" />
              </div>
            </div>
            <SkipIcon />
          </div>
        </div>

        {/* Retention note */}
        <div className="flex items-center gap-2.5 rounded-chip bg-fill px-[14px] py-[13px]">
          <LockIcon className="shrink-0 text-subtle" />
          <span className="flex-1 text-[14px] font-medium leading-[19px] text-subtle">
            From the call recording. Kept 30 days, then deleted.
          </span>
        </div>

        <div className="flex-1" />
        <SecondaryButton to="/report" className="!py-[19px] !text-[20px]">Back to report</SecondaryButton>
      </div>
    </PhoneFrame>
  )
}
