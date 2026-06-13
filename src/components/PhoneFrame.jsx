import { useLocation, useNavigate } from 'react-router-dom'
import { ChevronLeft } from './icons'

// Device frame (390×844) with the JAGA status bar.
// Status bar carries a Back control (left) and a persistent Home control
// (right) so you can always get out of any screen. Roots hide their own:
// Onboarding "/" and CallsHome "/home". `dark` flips the frame to ink.

function HomeIcon({ size = 18, className }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M3.5 11.5L12 4l8.5 7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5.5 10v9.5h13V10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function StatusBar({ showBack, showHome, dark }) {
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
      <div className="flex items-center gap-3.5">
        {showHome && (
          <button type="button" aria-label="Home" onClick={() => navigate('/home')} className={fg}>
            <HomeIcon size={18} />
          </button>
        )}
        <div className="flex items-center gap-[5px]">
          <div className={`h-[10px] w-[18px] rounded-[2px] ${dark ? 'bg-white' : 'bg-ink'}`} />
          <div className={`h-[10px] w-[14px] rounded-[2px] ${dark ? 'bg-white' : 'bg-ink'}`} />
          <div className={`h-3 w-6 rounded-[4px] border-2 ${dark ? 'border-white' : 'border-ink'}`} />
        </div>
      </div>
    </div>
  )
}

export default function PhoneFrame({ children, className = '', back = true, dark = false }) {
  const { pathname } = useLocation()
  const isHome = pathname === '/home'
  const isOnboarding = pathname === '/'
  return (
    <div
      className={
        `flex w-[390px] flex-col overflow-hidden rounded-frame border ${
          dark ? 'border-white/15 bg-ink' : 'border-line bg-white'
        } ` + className
      }
      style={{ height: 844 }}
    >
      <StatusBar showBack={back && !isHome && !isOnboarding} showHome={!isHome && !isOnboarding} dark={dark} />
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">{children}</div>
    </div>
  )
}
