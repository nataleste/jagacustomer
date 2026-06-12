import { Link, useNavigate } from 'react-router-dom'
import PhoneFrame from '../components/PhoneFrame'
import { Eyebrow } from '../components/ui'
import { ForwardIcon, ChevronRight } from '../components/icons'

const EARLIER = [
  {
    time: '4:12', dur: '12 min', title: 'Unknown caller', tag: 'Report',
    sub: 'Transcript ready · 2 evidence moments', danger: true,
  },
  {
    time: '11:03', dur: '7 min', title: 'Bank verification', tag: 'Review', tagColor: 'text-unsure-ink',
    sub: 'Transcript ready · one-time code mentioned',
  },
  {
    time: '9:18', dur: '3 min', title: 'Delivery fee call', tag: 'Low', tagColor: 'text-safe',
    sub: 'Transcript ready · no demand detected',
  },
]

function TabBar({ active = 'Calls' }) {
  const to = { Calls: '/home', Reports: '/report', Settings: '/settings' }
  return (
    <div className="flex justify-around border-t border-divider pt-3">
      {['Calls', 'Reports', 'Settings'].map((t) => (
        <Link
          key={t}
          to={to[t]}
          className={`text-[12px] leading-[17px] ${
            t === active ? 'font-black text-ink' : 'font-extrabold text-muted'
          }`}
        >
          {t}
        </Link>
      ))}
    </div>
  )
}

export default function Home() {
  const navigate = useNavigate()
  return (
    <PhoneFrame>
      <div className="flex flex-col gap-[18px] px-5 pb-5 pt-2">
        {/* Title */}
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-1.5">
            <Eyebrow>Call log</Eyebrow>
            <h1 className="text-[34px] font-black leading-[38px] text-ink">Calls</h1>
          </div>
          <Link to="/report" className="rounded-full bg-fill px-[13px] py-[9px] text-[13px] font-black leading-[18px] text-ink">
            Reports
          </Link>
        </div>

        {/* Filters */}
        <div className="flex gap-2">
          <span className="rounded-full bg-ink px-[13px] py-2 text-[13px] font-black leading-[18px] text-white">All</span>
          <span className="rounded-full bg-fill px-[13px] py-2 text-[13px] font-black leading-[18px] text-subtle">Live</span>
          <span className="rounded-full bg-fill px-[13px] py-2 text-[13px] font-black leading-[18px] text-subtle">Needs report</span>
        </div>

        {/* Forward entry → Flow 2 (Chat / forward) */}
        <Link to="/chat" className="flex items-center gap-3.5 rounded-card border-2 border-ink bg-white px-4 py-[15px]">
          <div className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-full bg-ink">
            <ForwardIcon size={24} className="text-white" />
          </div>
          <div className="flex flex-1 flex-col gap-0.5">
            <span className="text-[18px] font-black leading-[23px] text-ink">Check a message or link</span>
            <span className="text-[14px] font-medium leading-[19px] text-muted">
              Forward a suspicious SMS, link or recording
            </span>
          </div>
          <ChevronRight size={16} className="shrink-0 text-faint" />
        </Link>

        {/* Live call card — body opens the live investigation */}
        <div
          onClick={() => navigate('/investigation')}
          className="flex cursor-pointer flex-col gap-3.5 rounded-[14px] bg-ink p-4"
        >
          <div className="flex items-center justify-between">
            {/* "LIVE CALL" is a status label → neutral white, not a verdict color */}
            <span className="text-[13px] font-black uppercase leading-[18px] tracking-[0.06em] text-white">
              Live call
            </span>
            <span className="text-[13px] font-extrabold leading-[18px] text-[#CBD5E1]">04:28</span>
          </div>
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-1.5">
              <span className="text-[24px] font-black leading-[30px] text-white">Unknown caller</span>
              <span className="text-[14px] leading-5 text-[#D1D5DB]">Transcript streaming now</span>
            </div>
            <div className="flex h-[54px] w-[54px] shrink-0 items-center justify-center rounded-full bg-scam text-[20px] font-black leading-6 text-white">
              86
            </div>
          </div>
          <p className="text-[15px] leading-[22px] text-white">
            “Do not tell anyone else about this transfer…”
          </p>
          <div className="flex gap-2">
            <span className="rounded-full bg-scam px-2.5 py-[7px] text-[12px] font-black leading-4 text-white">High risk</span>
            <Link
              to="/transcript"
              onClick={(e) => e.stopPropagation()}
              className="rounded-full bg-[#222A35] px-2.5 py-[7px] text-[12px] font-black leading-4 text-white"
            >
              Open transcript
            </Link>
          </div>
        </div>

        {/* Earlier — each row opens its report */}
        <div className="flex flex-col gap-2.5">
          <Eyebrow>Earlier</Eyebrow>
          <div className="flex flex-col gap-2">
            {EARLIER.map((r) => (
              <Link
                to="/report"
                key={r.time}
                className={`flex items-start gap-3 rounded-[8px] border p-3 ${
                  r.danger ? 'border-scam-border bg-scam-bg' : 'border-line bg-white'
                }`}
              >
                <div className="w-[54px] shrink-0">
                  <div className={`text-[14px] font-black leading-5 ${r.danger ? 'text-scam-ink' : 'text-ink'}`}>{r.time}</div>
                  <div className={`text-[12px] leading-4 ${r.danger ? 'text-scam-deep' : 'text-muted'}`}>{r.dur}</div>
                </div>
                <div className="flex flex-1 flex-col gap-1">
                  <div className="flex justify-between gap-2">
                    <span className="text-[16px] font-black leading-[22px] text-ink">{r.title}</span>
                    <span className={`text-[12px] font-black leading-4 ${r.danger ? 'text-scam-ink' : r.tagColor}`}>{r.tag}</span>
                  </div>
                  <span className={`text-[14px] leading-5 ${r.danger ? 'text-scam-deep' : 'text-subtle'}`}>{r.sub}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>

        <TabBar active="Calls" />
      </div>
    </PhoneFrame>
  )
}
