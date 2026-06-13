import { useLocation, useNavigate } from 'react-router-dom'
import { ChevronLeft } from './icons'

// Device frame (390×844) with the JAGA status bar.
// The status bar carries a Back control on every screen except the roots
// (Onboarding "/" and CallsHome "/home"). Screens that already show their own
// header back arrow (Chat, Play moment) pass `back={false}`.
// `dark` flips the frame to ink (used by the Terminal 3 seal screen).

function StatusBar({ showBack, dark }) {
  const navigate = useNavigate()
  const fg = dark ? 'text-white' : 'text-ink'
  return (
    <div className="flex shrink-0 items-center justify-between px-6 pt-[21px] pb-[18px]">
      <div className="flex items-center gap-2">
        {showBack && (
          <button
            type="button"
            aria-label="Back"
            onClick={() => navigate(-1)}
            className={`-ml-1 flex items-center ${fg}`}
          >
            <ChevronLeft size={18} />
          </button>
        )}
        <span className={`text-[17px] font-bold leading-[22px] ${fg}`}>9:41</span>
      </div>
      <div className="flex items-center gap-[5px]">
        <div className={`h-[10px] w-[18px] rounded-[2px] ${dark ? 'bg-white' : 'bg-ink'}`} />
        <div className={`h-[10px] w-[14px] rounded-[2px] ${dark ? 'bg-white' : 'bg-ink'}`} />
        <div className={`h-3 w-6 rounded-[4px] border-2 ${dark ? 'border-white' : 'border-ink'}`} />
      </div>
    </div>
  )
}

export default function PhoneFrame({ children, className = '', back = true, dark = false }) {
  const { pathname } = useLocation()
  const isRoot = pathname === '/' || pathname === '/home'
  return (
    <div
      className={
        `flex w-[390px] flex-col overflow-hidden rounded-frame border ${
          dark ? 'border-white/15 bg-ink' : 'border-line bg-white'
        } ` + className
      }
      style={{ height: 844 }}
    >
      <StatusBar showBack={back && !isRoot} dark={dark} />
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">{children}</div>
    </div>
  )
}
