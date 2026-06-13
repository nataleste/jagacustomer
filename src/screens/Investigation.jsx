import { Link, useLocation } from 'react-router-dom'
import PhoneFrame from '../components/PhoneFrame'
import { PrimaryButton } from '../components/ui'
import { verdictVariant } from '../lib/jaga'
import {
  DocIcon,
  PersonIcon,
  LinkIcon,
  LockIcon,
  LockSolidIcon,
  TrendUpIcon,
  ChevronRight,
} from '../components/icons'

/* Static demo data (used when arriving from a live call / no real finding). */
const AGENTS = [
  {
    id: 'script',
    Icon: DocIcon,
    title: "What they're saying",
    status: 'warning',
    finding: 'They pushed you to act now and to keep this a secret.',
  },
  {
    id: 'identity',
    Icon: PersonIcon,
    title: "Who's calling",
    status: 'checking',
    finding: 'Checking the official bank register…',
  },
  {
    id: 'link',
    Icon: LinkIcon,
    title: 'The link they sent',
    status: 'warning',
    finding: 'Opened safely in a sealed test space — a fake DBS site, made 1 day ago.',
    sandbox: { url: 'dbs-secure-verify.com', mock: true },
  },
]

const RISK = { warningsFound: 2, stillChecking: 1, percent: 66 }

// risk → tier used for colour + wording everywhere on this screen.
function riskTier(risk) {
  if (risk >= 60) return 'warning'
  if (risk >= 30) return 'caution'
  return 'clear'
}

const STATUS = {
  warning: { card: 'border-scam-border bg-scam-bg', icon: 'bg-scam', dot: 'bg-scam', label: 'Warning', labelColor: 'text-scam-ink', body: 'text-scam-deep' },
  caution: { card: 'border-line bg-white', icon: 'bg-ink', dot: 'bg-unsure-strong', label: 'Be careful', labelColor: 'text-unsure-ink', body: 'text-subtle' },
  clear: { card: 'border-line bg-white', icon: 'bg-safe', dot: 'bg-safe', label: 'Looks clear', labelColor: 'text-safe', body: 'text-subtle' },
  checking: { card: 'border-line bg-white', icon: 'bg-ink', dot: 'bg-unsure-strong', label: 'Checking…', labelColor: 'text-unsure-ink', body: 'text-subtle' },
}

const METER = {
  warning: { label: 'High risk', text: 'text-scam-ink', bar: 'bg-scam', icon: 'text-scam', border: 'border-scam-border' },
  caution: { label: 'Be careful', text: 'text-unsure-ink', bar: 'bg-unsure-strong', icon: 'text-unsure-strong', border: 'border-line' },
  clear: { label: 'Looks safe so far', text: 'text-safe', bar: 'bg-safe', icon: 'text-safe', border: 'border-line' },
}

function hostFrom(u) {
  try {
    return new URL(u).hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}

/* Sandbox preview. Shows the REAL Daytona capture when we have one. The
   hardcoded DBS mock is only used for the static demo (mock:true). */
function SandboxThumbnail({ url, screenshot, mock }) {
  if (!screenshot && !mock) return null
  return (
    <div className="mt-0.5 flex flex-col overflow-hidden rounded-chip border border-line">
      <div className="flex items-center gap-[7px] bg-ink px-[10px] py-[7px]">
        <LockSolidIcon className="text-unsure" />
        <span className="flex-1 truncate font-mono text-[11px] font-semibold leading-[14px] text-faint">{url}</span>
        <span className="rounded-[4px] bg-unsure px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[0.04em] leading-3 text-ink">
          Sealed
        </span>
      </div>
      {screenshot ? (
        <img src={screenshot} alt="Sandbox capture of the link" className="block w-full" />
      ) : (
        <div className="flex flex-col gap-2 bg-[#F4F6F9] p-3.5">
          <span className="text-[16px] font-black leading-[18px] tracking-[0.04em] text-[#1B4DA0]">DBS</span>
          <span className="text-[12px] font-bold leading-4 text-ink">Verify your account now</span>
          <div className="h-[9px] w-full rounded-[3px] border border-line bg-white" />
          <div className="h-[9px] w-3/4 rounded-[3px] border border-line bg-white" />
          <div className="flex w-16 items-center justify-center rounded-[4px] bg-[#1B4DA0] py-[5px]">
            <span className="text-[9px] font-black leading-3 text-white">VERIFY</span>
          </div>
        </div>
      )}
    </div>
  )
}

function AgentCard({ Icon, title, status, finding, findings, sandbox }) {
  const s = STATUS[status] || STATUS.checking
  return (
    <div className={`flex items-start gap-3 rounded-card border p-3.5 ${s.card}`}>
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${s.icon}`}>
        <Icon className="text-white" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-[5px]">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[17px] font-black leading-[22px] text-ink">{title}</span>
          <div className="flex shrink-0 items-center gap-[5px]">
            <span className={`h-2 w-2 rounded-full ${s.dot}`} />
            <span className={`text-[13px] font-black leading-4 ${s.labelColor}`}>{s.label}</span>
          </div>
        </div>
        {findings ? (
          <div className="flex flex-col gap-1.5">
            {findings.map((f, i) => (
              <p key={i} className={`text-[15px] font-medium leading-[21px] ${s.body}`}>{f}</p>
            ))}
          </div>
        ) : (
          <p className={`text-[15px] font-medium leading-[21px] ${s.body}`}>{finding}</p>
        )}
        {sandbox && <SandboxThumbnail url={sandbox.url} screenshot={sandbox.screenshot} mock={sandbox.mock} />}
      </div>
    </div>
  )
}

export default function Investigation() {
  // A real finding from the link agent arrives via router state (from Chat).
  const finding = useLocation().state?.finding
  const hasReal = !!finding
  const tier = hasReal ? riskTier(finding.risk) : 'warning'

  const agents = hasReal
    ? [
        {
          id: 'link',
          Icon: LinkIcon,
          title: 'The link they sent',
          status: tier,
          findings: (finding.summary ? [finding.summary] : []).concat(finding.findings || []),
          // Only show a sandbox card when Daytona actually captured a screenshot.
          sandbox: finding.evidence?.screenshot
            ? { url: hostFrom(finding.evidence?.final_url) || 'the link', screenshot: finding.evidence.screenshot }
            : undefined,
        },
      ]
    : AGENTS

  const m = METER[tier]
  const verdictTo = hasReal ? `/verdict/${verdictVariant(finding.risk)}` : '/verdict/scam'

  return (
    <PhoneFrame>
      <div className="flex flex-1 flex-col gap-[18px] px-5 pb-5 pt-2">
        {/* Header */}
        <header className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-scam" />
              <span className="text-[13px] font-black uppercase leading-[18px] tracking-[0.06em] text-scam-ink">
                JAGA is checking
              </span>
            </div>
            <span className="whitespace-nowrap text-[16px] font-black leading-[18px] text-ink">0:08</span>
          </div>
          <h1 className="text-[34px] font-black leading-[38px] text-ink">Checking for you…</h1>
        </header>

        {/* Risk meter — tap to reveal the verdict */}
        <Link
          to={verdictTo}
          state={hasReal ? { finding } : undefined}
          className={`flex flex-col gap-[9px] rounded-card border bg-white px-4 py-3.5 ${
            hasReal ? m.border : 'border-scam-border'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-[7px]">
              <TrendUpIcon className={hasReal ? m.icon : 'text-scam'} />
              <span className="text-[15px] font-black leading-5 text-ink">
                {hasReal ? m.label : `${RISK.warningsFound} warning signs found`}
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <span className={`text-[13px] font-black leading-[18px] ${hasReal ? m.text : 'text-unsure-ink'}`}>
                {hasReal ? `${finding.risk}/100 risk` : `+${RISK.stillChecking} checking`}
              </span>
              <ChevronRight size={14} className="text-muted" />
            </div>
          </div>
          <div className="flex h-3 overflow-hidden rounded-full bg-fill">
            <div className={`rounded-full ${hasReal ? m.bar : 'bg-scam'}`} style={{ width: `${hasReal ? finding.risk : RISK.percent}%` }} />
          </div>
        </Link>

        {/* Agent cards */}
        <div className="flex flex-col gap-3">
          {agents.map((a) => (
            <AgentCard key={a.id} {...a} />
          ))}
        </div>

        <div className="flex-1" />

        {/* Footer */}
        <div className="flex shrink-0 flex-col gap-[14px]">
          <PrimaryButton to={verdictTo} state={hasReal ? { finding } : undefined} className="!py-[18px] !text-[20px]">
            See the verdict
          </PrimaryButton>
          <div className="flex items-center gap-[10px] rounded-chip bg-fill px-[14px] py-[13px]">
            <LockIcon className="shrink-0 text-subtle" />
            <span className="text-[14px] font-semibold leading-[19px] text-subtle">
              Personal details are removed before checking.
            </span>
          </div>
          <div className="flex items-center justify-center gap-2">
            <button className="rounded-full bg-ink px-4 py-2 text-[14px] font-black leading-[18px] text-white">EN</button>
            <button className="rounded-full bg-fill px-4 py-2 text-[14px] font-black leading-[18px] text-subtle">中文</button>
            <button className="rounded-full bg-fill px-4 py-2 text-[14px] font-black leading-[18px] text-subtle">Melayu</button>
          </div>
        </div>
      </div>
    </PhoneFrame>
  )
}
