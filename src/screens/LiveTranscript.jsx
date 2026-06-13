import { Link } from 'react-router-dom'
import PhoneFrame from '../components/PhoneFrame'
import { PrimaryButton, SecondaryButton } from '../components/ui'
import { ShieldAlert, ForwardIcon } from '../components/icons'

const LINES = [
  { time: '3:42', who: 'Caller', text: 'You must act today or the account will be frozen.' },
  { time: '3:48', who: 'You', text: 'Can you send me this request in writing?' },
  { time: '4:16', who: 'Caller', text: 'Do not tell anyone else about this transfer.', flag: true },
  { time: '4:24', who: 'You', text: 'I need to verify this through official channels.' },
]

export default function LiveTranscript() {
  return (
    <PhoneFrame>
      <div className="flex flex-col gap-[18px] px-5 pb-5 pt-2">
        {/* Header */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[16px] font-extrabold leading-5 text-ink">Live transcript</span>
            {/* relabeled from "Recording in Phone" → neutral status */}
            <span className="text-[13px] font-extrabold leading-[18px] text-muted">JAGA on call · streaming</span>
          </div>
          <h1 className="text-[30px] font-black leading-[34px] text-ink">Unknown caller</h1>
          <p className="text-[14px] font-medium leading-5 text-muted">04:28 elapsed · transcript streaming</p>
          <div className="flex gap-2 pt-1">
            <span className="rounded-full bg-scam-bg px-3 py-1.5 text-[13px] font-black leading-4 text-scam-ink">High risk</span>
            <span className="rounded-full bg-fill px-3 py-1.5 text-[13px] font-black leading-4 text-subtle">2 signals</span>
          </div>
        </div>

        {/* Scam alert — pops up when JAGA concludes scam */}
        <div className="flex items-center gap-3 rounded-card bg-scam px-4 py-3.5">
          <div className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full bg-white/20">
            <ShieldAlert size={24} className="text-white" />
          </div>
          <div className="flex flex-1 flex-col gap-0.5">
            <span className="text-[18px] font-black leading-[23px] text-white">Likely a scam</span>
            <span className="text-[14px] font-medium leading-[19px] text-[#FFD0CC]">
              Do not send money or share any codes.
            </span>
          </div>
          <Link to="/verdict/scam" className="shrink-0 rounded-full bg-white px-[13px] py-2 text-[14px] font-black leading-[18px] text-scam-ink">
            See why
          </Link>
        </div>

        <div className="h-px w-full bg-divider" />

        {/* Transcript */}
        <div className="flex flex-col gap-3">
          {LINES.map((l, i) => (
            <div
              key={i}
              className={`flex items-start gap-3 ${l.flag ? '-mx-2 rounded-card bg-scam-bg px-2 py-2' : ''}`}
            >
              <span className={`w-[42px] shrink-0 pt-0.5 text-[14px] font-black leading-6 ${l.flag ? 'text-scam-ink' : 'text-muted'}`}>
                {l.time}
              </span>
              <div className="flex flex-1 flex-col">
                <span className="text-[16px] font-black leading-[23px] text-ink">{l.who}</span>
                <span className="text-[16px] leading-[23px] text-ink-soft">{l.text}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2.5 pt-1">
          <PrimaryButton to="/chat" icon={<ForwardIcon size={22} className="text-white" />} className="!py-[18px] !text-[19px]">
            Check a message or link
          </PrimaryButton>
          <SecondaryButton className="!py-[18px] !text-[19px]">Add note</SecondaryButton>
        </div>
      </div>
    </PhoneFrame>
  )
}
