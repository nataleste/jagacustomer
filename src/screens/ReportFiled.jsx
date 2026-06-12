import PhoneFrame from '../components/PhoneFrame'
import { Eyebrow, PrimaryButton, SecondaryButton } from '../components/ui'
import { CheckIcon, ShieldCheck, LockIcon } from '../components/icons'

const ROWS = [
  ['Report ID', 'SR-2026-0612-7788'],
  ['Filed to', 'ScamShield (demo)'],
  ['Signed by', 'JAGA · Terminal 3'],
  ['Filed at', 'Today, 4:39 PM'],
]

export default function ReportFiled() {
  return (
    <PhoneFrame>
      <div className="flex min-h-full flex-col gap-5 px-5 pb-5 pt-4">
        {/* Confirmation header */}
        <div className="flex flex-col gap-4">
          <div className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-ink">
            <CheckIcon size={38} className="text-white" />
          </div>
          <div className="flex flex-col gap-[7px]">
            <h1 className="text-[34px] font-black leading-[38px] text-ink">Report filed</h1>
            <p className="text-[17px] font-medium leading-[24px] text-subtle">
              Your scam report was sent and signed by Terminal 3. You don’t need to do anything else.
            </p>
          </div>
        </div>

        {/* Signed receipt */}
        <div className="flex flex-col gap-4 rounded-[18px] bg-ink p-5">
          <div className="flex items-center gap-2.5">
            <ShieldCheck size={26} className="text-unsure" />
            <span className="flex-1 text-[18px] font-black leading-[23px] text-white">
              Signed &amp; verified
            </span>
            <span className="rounded-full bg-unsure px-2.5 py-[5px] text-[12px] font-black leading-4 text-ink">
              RECEIPT
            </span>
          </div>
          <div className="h-px w-full bg-white/[0.16]" />
          <div className="flex flex-col gap-3.5">
            {ROWS.map(([k, val]) => (
              <div key={k} className="flex items-center justify-between gap-3">
                <span className="text-[15px] font-medium leading-5 text-faint">{k}</span>
                <span className="text-[15px] font-extrabold leading-5 text-white">{val}</span>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-1.5 rounded-[10px] bg-white/[0.08] px-[14px] py-3">
            <span className="text-[12px] font-black uppercase leading-4 tracking-[0.06em] text-faint">
              Digital signature
            </span>
            <span className="break-all font-mono text-[14px] font-semibold leading-[19px] text-unsure">
              0x9F2A·7C41·E0B8·…·D71C
            </span>
          </div>
        </div>

        {/* Privacy note */}
        <div className="flex items-center gap-2.5 rounded-chip bg-fill px-[14px] py-[13px]">
          <LockIcon className="shrink-0 text-subtle" />
          <span className="flex-1 text-[14px] font-medium leading-[19px] text-subtle">
            No personal details were shared in this report.
          </span>
        </div>

        <div className="flex-1" />
        <div className="flex flex-col gap-2.5">
          <PrimaryButton to="/guardian" className="!py-[19px] !text-[20px]">Tell Sarah it’s done</PrimaryButton>
          <SecondaryButton to="/home" className="!py-[19px] !text-[20px]">Back to home</SecondaryButton>
        </div>
      </div>
    </PhoneFrame>
  )
}
