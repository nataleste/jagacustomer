import { Link } from 'react-router-dom'
import PhoneFrame from '../components/PhoneFrame'
import { Eyebrow, PrimaryButton, SecondaryButton } from '../components/ui'
import { ShieldAlert, PlayTriangle, CheckCircle } from '../components/icons'

const MOMENTS = [
  { time: '3:55', label: 'Money demand', quote: '“Move your money to this safe account right now.”' },
  { time: '4:16', label: 'Secrecy', quote: '“Do not tell anyone about this transfer.”' },
  { time: '5:02', label: 'Fake link', quote: 'dbs-secure-verify.com — the website was made only 1 day ago.' },
]

const STEPS = [
  'Do not send any money or call back.',
  'Block this number on your phone.',
  'If you already paid, call your bank now.',
]

function SectionLabel({ children }) {
  return <Eyebrow>{children}</Eyebrow>
}

export default function Report() {
  return (
    <PhoneFrame>
      <div className="flex flex-col gap-5 px-5 pb-6 pt-2">
        {/* Header */}
        <div className="flex flex-col gap-1.5">
          <SectionLabel>Report ready</SectionLabel>
          <h1 className="text-[34px] font-black leading-[38px] text-ink">Scam report</h1>
          <p className="text-[16px] font-medium leading-[22px] text-subtle">
            Unknown caller · Today 4:12 PM · 12 min
          </p>
        </div>

        {/* Verdict banner */}
        <div className="flex items-center gap-3.5 rounded-card bg-scam px-[18px] py-4">
          <div className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-full bg-white/20">
            <ShieldAlert size={26} className="text-white" />
          </div>
          <div className="flex flex-1 flex-col gap-0.5">
            <span className="text-[22px] font-black leading-[26px] text-white">Scam · 96% sure</span>
            <span className="text-[15px] font-medium leading-5 text-[#FFD0CC]">
              Fake bank officer, money demand
            </span>
          </div>
        </div>

        {/* What happened */}
        <div className="flex flex-col gap-2">
          <SectionLabel>What happened</SectionLabel>
          <p className="text-[17px] leading-[25px] text-ink-soft">
            A caller claiming to be a DBS bank officer said your account was at risk and told you to
            move money to a “safe account.” JAGA checked and found this is a known scam pattern. The
            bank did not make this call.
          </p>
        </div>

        {/* Key moments */}
        <div className="flex flex-col gap-2.5">
          <SectionLabel>Key moments</SectionLabel>
          <p className="-mt-0.5 text-[14px] font-medium leading-[19px] text-muted">
            Tap a time to hear that part of the call.
          </p>
          {MOMENTS.map((m) => (
            <Link
              key={m.time}
              to="/report/moment"
              className="flex items-start gap-3 rounded-card border border-scam-border bg-scam-bg p-3.5"
            >
              <div className="flex w-14 shrink-0 items-center gap-[5px]">
                <PlayTriangle size={12} className="text-scam-ink" />
                <span className="text-[15px] font-black leading-5 text-scam-ink">{m.time}</span>
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
                <span className="text-[13px] font-black uppercase leading-4 tracking-[0.04em] text-scam-deep">
                  {m.label}
                </span>
                <span className="text-[16px] font-medium leading-[22px] text-ink">{m.quote}</span>
              </div>
            </Link>
          ))}
        </div>

        {/* What to do next */}
        <div className="flex flex-col gap-2.5">
          <SectionLabel>What to do next</SectionLabel>
          <div className="flex flex-col overflow-hidden rounded-card border border-line">
            {STEPS.map((s, i) => (
              <div
                key={i}
                className={`flex items-center gap-[13px] px-4 py-4 ${i > 0 ? 'border-t border-divider' : ''}`}
              >
                <CheckCircle size={30} className="shrink-0 text-ink" />
                <span className="flex-1 text-[17px] font-semibold leading-[23px] text-ink">{s}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2.5">
          <PrimaryButton to="/report/sealing" className="!py-[19px] !text-[20px]">File this report</PrimaryButton>
          <SecondaryButton to="/guardian" className="!py-[19px] !text-[20px]">Share with Sarah</SecondaryButton>
          <div className="flex items-center gap-3 pt-1">
            <div className="flex flex-1 flex-col gap-0.5">
              <span className="text-[16px] font-bold leading-[21px] text-ink">
                Run a deeper background check
              </span>
              <span className="text-[14px] leading-[19px] text-muted">Optional · costs S$2</span>
            </div>
            <button className="shrink-0 rounded-full bg-fill px-4 py-[9px] text-[14px] font-black leading-[18px] text-ink">
              Run
            </button>
          </div>
        </div>
      </div>
    </PhoneFrame>
  )
}
