// Icon set traced from the Paper design.
// Stroke icons use stroke="currentColor" so Tailwind `text-*` drives color.

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

const Svg = ({ size = 22, className, sw, children }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    className={className}
    {...stroke}
    strokeWidth={sw ?? stroke.strokeWidth}
  >
    {children}
  </svg>
)

/* ---- agent / content icons ---- */
export const DocIcon = (p) => (
  <Svg {...p}>
    <path d="M7 3.5H14L18 7.5V20.5H7V3.5Z" />
    <path d="M9.5 11H15M9.5 14.5H13" />
  </Svg>
)
export const PersonIcon = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="8.5" r="3.5" />
    <path d="M5.5 19.5C5.5 16 8.4 14 12 14C15.6 14 18.5 16 18.5 19.5" />
  </Svg>
)
export const LinkIcon = (p) => (
  <Svg {...p}>
    <path d="M9.5 14.5L14.5 9.5" />
    <path d="M11 8L12.8 6.2C14.2 4.8 16.4 4.8 17.8 6.2C19.2 7.6 19.2 9.8 17.8 11.2L16 13" />
    <path d="M13 16L11.2 17.8C9.8 19.2 7.6 19.2 6.2 17.8C4.8 16.4 4.8 14.2 6.2 12.8L8 11" />
  </Svg>
)
export const LockIcon = ({ size = 20, ...p }) => (
  <Svg size={size} {...p}>
    <path d="M6 11V8.5C6 5.5 8.4 3.5 12 3.5C15.6 3.5 18 5.5 18 8.5V11" />
    <rect x="5" y="11" width="14" height="9.5" rx="2.5" />
  </Svg>
)
export const TrendUpIcon = ({ size = 18, ...p }) => (
  <Svg size={size} sw={2.4} {...p}>
    <path d="M4 18L10 11L14 15L20 7" />
    <path d="M20 7H15M20 7V12" />
  </Svg>
)

/* ---- shields ---- */
// Brand mark: shield filled with currentColor (use text-unsure → yellow) + dark check.
export const ShieldCheck = ({ size = 24, className, checkColor = '#0B0F14' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <path
      d="M12 2.5L4 5.5V11C4 16 7.4 19.7 12 21.5C16.6 19.7 20 16 20 11V5.5L12 2.5Z"
      fill="currentColor"
    />
    <path
      d="M9 11.5L11.2 13.7L15.5 9"
      stroke={checkColor}
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)
// Verdict mark: outline shield + exclamation, all currentColor.
export const ShieldAlert = ({ size = 24, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <path
      d="M12 2.5L4 5.5V11C4 16 7.4 19.7 12 21.5C16.6 19.7 20 16 20 11V5.5L12 2.5Z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinejoin="round"
    />
    <path d="M12 8V12.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    <circle cx="12" cy="16" r="1.3" fill="currentColor" />
  </svg>
)
export const LockSolidIcon = ({ size = 13, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <path d="M7 11V8.5C7 5.7 9.2 3.5 12 3.5C14.8 3.5 17 5.7 17 8.5V11" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    <rect x="5.5" y="11" width="13" height="9" rx="2" fill="currentColor" />
  </svg>
)

/* ---- phone / actions ---- */
export const PhonePlusIcon = ({ size = 24, ...p }) => (
  <Svg size={size} {...p}>
    <path d="M6.5 4H9L10.5 8L8.5 9.5C9.3 11.3 10.7 12.7 12.5 13.5L14 11.5L18 13V15.5C18 16.6 17.1 17.5 16 17.5C9.9 17.1 6.9 14.1 6.5 8C6.5 6.9 6.5 4 6.5 4Z" />
    <path d="M17.5 4.5V10.5M14.5 7.5H20.5" />
  </Svg>
)
export const PhoneIcon = ({ size = 24, ...p }) => (
  <Svg size={size} {...p}>
    <path d="M4 5.5C4 4.7 4.7 4 5.5 4H9L10.5 7.8L8.3 9.3C9.2 11.2 10.8 12.8 12.7 13.7L14.2 11.5L18 13V16.5C18 17.3 17.3 18 16.5 18C9.6 17.6 4.4 12.4 4 5.5Z" />
  </Svg>
)
export const PhoneDownIcon = ({ size = 26, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <path
      d="M3.5 14.5C8 10 16 10 20.5 14.5L18 17L14.8 15.7C14.3 15.5 14 15 14 14.5V13.2C12.7 12.9 11.3 12.9 10 13.2V14.5C10 15 9.7 15.5 9.2 15.7L6 17L3.5 14.5Z"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
  </svg>
)
export const FlagIcon = (p) => (
  <Svg {...p}>
    <path d="M5 21V4H19L16 8.5L19 13H7" />
  </Svg>
)
export const BookmarkIcon = (p) => (
  <Svg {...p}>
    <path d="M6 4.5H18V20L12 16L6 20V4.5Z" />
  </Svg>
)
export const ForwardIcon = (p) => (
  <Svg {...p}>
    <path d="M13 4L20 11L13 18M20 11H7C5 11 4 12 4 14V17" />
  </Svg>
)
export const SendIcon = ({ size = 24, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <path d="M4 12L20 4L13 20L11 13L4 12Z" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
  </svg>
)
export const PaperclipIcon = (p) => (
  <Svg {...p}>
    <path d="M20 11.5L12 19.5C9.5 22 6 22 4 19.5C2 17 2 13.5 4.5 11L13 2.5C14.7 0.8 17 0.8 18.7 2.5C20.4 4.2 20.4 6.5 18.7 8.2L10.5 16.5C9.7 17.3 8.5 17.3 7.7 16.5C6.9 15.7 6.9 14.5 7.7 13.7L15 6.5" />
  </Svg>
)

/* ---- chrome / utility ---- */
export const ChevronLeft = ({ size = 20, className }) => (
  <svg width={size * 0.6} height={size} viewBox="0 0 11 20" fill="none" className={className}>
    <path d="M9.5 1.5L2 10L9.5 18.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)
export const ChevronRight = ({ size = 16, className }) => (
  <svg width={size * 0.55} height={size} viewBox="0 0 11 20" fill="none" className={className}>
    <path d="M1.5 1.5L9 10L1.5 18.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)
export const PlusIcon = ({ size = 22, ...p }) => (
  <Svg size={size} sw={2.4} {...p}>
    <path d="M12 5V19M5 12H19" />
  </Svg>
)
export const CheckIcon = ({ size = 17, className, sw = 2.6 }) => (
  <Svg size={size} sw={sw} className={className}>
    <path d="M5 12.5L10 17.5L19 7" />
  </Svg>
)
// Filled dark circle with a white check (added/confirmed indicator).
export const CheckCircle = ({ size = 22, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <circle cx="12" cy="12" r="9.5" fill="currentColor" />
    <path d="M8 12.5L11 15.5L16.5 9" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)
export const PlayTriangle = ({ size = 12, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <path d="M7 5L19 12L7 19Z" fill="currentColor" />
  </svg>
)
