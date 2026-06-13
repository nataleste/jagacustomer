import { useParams, useLocation } from 'react-router-dom'
import PhoneFrame from '../components/PhoneFrame'
import { PrimaryButton, SecondaryButton } from '../components/ui'
import { ShieldAlert, ShieldCheck, PhoneDownIcon, FlagIcon, PhoneIcon, BookmarkIcon } from '../components/icons'

/* The "Hang up" element is real-world guidance, not an in-app action, so it
   reads as a red instruction banner — never a tappable CTA button. */
function HangUpBanner({ label }) {
  return (
    <div className="flex items-center gap-[13px] rounded-btn border border-scam-border bg-scam-bg px-[18px] py-[15px]">
      <PhoneDownIcon size={26} className="shrink-0 text-scam" />
      <div className="flex min-w-0 flex-1 flex-col gap-px">
        <span className="text-[19px] font-black leading-[24px] text-scam-ink">{label}</span>
        <span className="text-[14px] font-medium leading-[19px] text-scam-deep">
          End the call on your phone.
        </span>
      </div>
    </div>
  )
}

const VARIANTS = {
  scam: {
    panel: 'bg-scam',
    headlineColor: 'text-white',
    eyebrowColor: 'text-[#FFD0CC]',
    subColor: 'text-[#FFD0CC]',
    iconBg: 'bg-white/20',
    icon: <ShieldAlert size={28} className="text-white" />,
    headline: 'This is a scam',
    big: '96%',
    small: 'sure it is a scam',
    reasonEn: 'They pretended to be your bank and rushed you to send money.',
    reasonZh: '他们假装是你的银行，催你赶快转账。',
    reasonEnColor: 'text-white',
    reasonZhColor: 'text-[#FFD0CC]',
    divider: 'bg-white/30',
    hangup: 'Hang up now',
    actions: [
      { label: 'Report this scam', icon: <FlagIcon className="text-ink" />, to: '/report' },
      { label: 'Tell Sarah', icon: <PhoneIcon className="text-ink" />, to: '/guardian' },
    ],
  },
  careful: {
    panel: 'bg-unsure',
    headlineColor: 'text-ink',
    eyebrowColor: 'text-[#7A4D00]',
    subColor: 'text-[#7A4D00]',
    iconBg: 'bg-ink/[0.12]',
    icon: <ShieldAlert size={28} className="text-ink" />,
    headline: 'Be careful',
    big: 'Unsure',
    small: 'we could not confirm this caller',
    reasonEn: 'Do not send money or share any codes until you have checked it yourself.',
    reasonZh: '在你亲自核实之前，不要转账或提供验证码。',
    reasonEnColor: 'text-ink',
    reasonZhColor: 'text-[#6B4500]',
    divider: 'bg-ink/[0.18]',
    hangup: 'Hang up to be safe',
    actions: [
      // terminal — "check with my bank" just dismisses (no nav)
      { label: 'Check with my bank', icon: <FlagIcon className="text-ink" /> },
      { label: 'Tell Sarah', icon: <PhoneIcon className="text-ink" />, to: '/guardian' },
    ],
  },
  safe: {
    panel: 'bg-safe',
    headlineColor: 'text-white',
    eyebrowColor: 'text-[#B7E4CE]',
    subColor: 'text-[#BFE8D4]',
    iconBg: 'bg-white/20',
    icon: <ShieldCheck size={28} className="text-white" checkColor="#167A55" />,
    headline: 'Looks safe',
    big: '92%',
    small: 'sure it is safe',
    reasonEn: 'This is DBS’s real number. The caller did not ask for money or codes.',
    reasonZh: '这是星展银行的真实号码，对方没有索取钱财或验证码。',
    reasonEnColor: 'text-white',
    reasonZhColor: 'text-[#CDEEDD]',
    divider: 'bg-white/30',
    hangup: null,
    primary: { label: 'Done', to: '/home' },
    actions: [{ label: 'Save as safe contact', icon: <BookmarkIcon className="text-ink" />, to: '/home' }],
  },
}

export default function Verdict({ variant: variantProp }) {
  const params = useParams()
  const variant = params.variant || variantProp || 'scam'
  const v = VARIANTS[variant] || VARIANTS.scam

  // A real finding (from Hosan's link agent) overrides the demo copy.
  const finding = useLocation().state?.finding
  const big = finding ? `${finding.risk}%` : v.big
  const reasonEn = finding
    ? finding.summary || (finding.findings || []).join('. ')
    : v.reasonEn
  const reasonZh = finding ? null : v.reasonZh

  return (
    <PhoneFrame>
      <div className="flex flex-1 flex-col gap-4 px-5 pb-5 pt-2">
        {/* Verdict panel */}
        <div className={`flex flex-1 flex-col gap-4 rounded-[24px] px-6 py-7 ${v.panel}`}>
          <div className="flex items-center justify-between gap-3">
            <span className={`text-[13px] font-black uppercase leading-[18px] tracking-[0.06em] ${v.eyebrowColor}`}>
              JAGA's verdict
            </span>
            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${v.iconBg}`}>
              {v.icon}
            </div>
          </div>

          <div className="flex flex-col gap-3.5">
            <h1 className={`text-[46px] font-black leading-[48px] tracking-[-0.01em] ${v.headlineColor}`}>
              {v.headline}
            </h1>
            <div className="flex items-baseline gap-2">
              <span className={`shrink-0 whitespace-nowrap text-[30px] font-black leading-[32px] ${v.headlineColor}`}>
                {big}
              </span>
              <span className={`text-[18px] font-bold leading-6 ${v.subColor}`}>{v.small}</span>
            </div>
          </div>

          <div className={`h-px w-full ${v.divider}`} />

          <div className="flex flex-col gap-3">
            <p className={`text-[23px] font-bold leading-[30px] ${v.reasonEnColor}`}>{reasonEn}</p>
            {reasonZh && (
              <p className={`text-[21px] font-medium leading-[29px] ${v.reasonZhColor}`}>{reasonZh}</p>
            )}
          </div>

          <div className="flex-1" />
        </div>

        {/* Actions */}
        <div className="flex shrink-0 flex-col gap-2.5">
          {v.hangup && <HangUpBanner label={v.hangup} />}
          {v.primary && (
            <PrimaryButton to={v.primary.to} className="!text-[20px]">
              {v.primary.label}
            </PrimaryButton>
          )}
          {v.actions.map((a) => (
            <SecondaryButton key={a.label} to={a.to} icon={a.icon} className="!text-[20px]">
              {a.label}
            </SecondaryButton>
          ))}
        </div>
      </div>
    </PhoneFrame>
  )
}
