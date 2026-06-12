import { Link } from 'react-router-dom'
import PhoneFrame from '../components/PhoneFrame'
import { Eyebrow } from '../components/ui'
import { PlusIcon, LockSolidIcon } from '../components/icons'

// On-state toggle. Track uses ink (neutral), never a verdict color.
function Toggle() {
  return (
    <div className="flex h-8 w-[52px] shrink-0 items-center justify-end rounded-full bg-ink p-[3px]">
      <div className="h-[26px] w-[26px] rounded-full bg-white" />
    </div>
  )
}

const ALERTS = [
  { title: 'Scam alerts on calls', sub: 'Warn me during a suspicious call', control: 'toggle' },
  { title: 'Alert my guardian', sub: 'Send Sarah the verdict when a scam is found', control: 'toggle' },
  { title: 'Record calls for evidence', sub: 'Kept 30 days, then deleted', control: 'toggle' },
  { title: 'Remove personal details', sub: 'Always done before checking', control: 'lock' },
]

function TabBar() {
  return (
    <div className="flex justify-around border-t border-divider pt-3.5">
      <Link to="/home" className="text-[13px] font-extrabold leading-[18px] text-muted">Calls</Link>
      <Link to="/report" className="text-[13px] font-extrabold leading-[18px] text-muted">Reports</Link>
      <span className="text-[13px] font-black leading-[18px] text-ink">Settings</span>
    </div>
  )
}

export default function Settings() {
  return (
    <PhoneFrame>
      <div className="flex flex-col gap-6 px-5 pb-5 pt-2">
        <div className="flex flex-col gap-1.5">
          <Eyebrow>You &amp; privacy</Eyebrow>
          <h1 className="text-[34px] font-black leading-[38px] text-ink">Settings</h1>
        </div>

        {/* Trusted contacts */}
        <div className="flex flex-col gap-2.5">
          <Eyebrow>Trusted contacts</Eyebrow>
          <div className="flex flex-col overflow-hidden rounded-card border border-line">
            <div className="flex items-center gap-[13px] px-4 py-[15px]">
              <div className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-full bg-unsure text-[17px] font-black leading-5 text-ink">ST</div>
              <div className="flex flex-1 flex-col gap-0.5">
                <span className="text-[18px] font-extrabold leading-[23px] text-ink">Sarah Tan</span>
                <span className="text-[15px] font-medium leading-5 text-muted">Daughter · 9123 4567</span>
              </div>
              <span className="shrink-0 rounded-full bg-ink px-[11px] py-1.5 text-[12px] font-black leading-4 text-white">Guardian</span>
            </div>
            <div className="flex items-center gap-[13px] border-t border-divider px-4 py-[15px]">
              <div className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-full bg-fill">
                <PlusIcon size={22} className="text-ink" />
              </div>
              <span className="flex-1 text-[18px] font-extrabold leading-[23px] text-ink">Add a trusted contact</span>
            </div>
          </div>
        </div>

        {/* Language */}
        <div className="flex flex-col gap-2.5">
          <Eyebrow>Language</Eyebrow>
          <div className="flex gap-1.5 rounded-card bg-fill p-1.5">
            <div className="flex flex-1 items-center justify-center rounded-[10px] bg-ink py-[13px] text-[17px] font-black leading-[22px] text-white">English</div>
            <div className="flex flex-1 items-center justify-center py-[13px] text-[17px] font-black leading-[22px] text-subtle">中文</div>
            <div className="flex flex-1 items-center justify-center py-[13px] text-[17px] font-black leading-[22px] text-subtle">Melayu</div>
          </div>
        </div>

        {/* Alerts & privacy */}
        <div className="flex flex-col gap-2.5">
          <Eyebrow>Alerts &amp; privacy</Eyebrow>
          <div className="flex flex-col overflow-hidden rounded-card border border-line">
            {ALERTS.map((a, i) => (
              <div key={a.title} className={`flex items-center gap-3.5 px-4 py-4 ${i > 0 ? 'border-t border-divider' : ''}`}>
                <div className="flex flex-1 flex-col gap-0.5">
                  <span className="text-[17px] font-bold leading-[22px] text-ink">{a.title}</span>
                  <span className="text-[14px] leading-[19px] text-muted">{a.sub}</span>
                </div>
                {a.control === 'toggle' ? (
                  <Toggle />
                ) : (
                  <div className="flex shrink-0 items-center gap-1.5">
                    <LockSolidIcon size={18} className="text-muted" />
                    <span className="text-[14px] font-black leading-[18px] tracking-[0.02em] text-muted">Always on</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <TabBar />
      </div>
    </PhoneFrame>
  )
}
