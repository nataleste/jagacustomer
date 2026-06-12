import PhoneFrame from '../components/PhoneFrame'
import { Eyebrow, PrimaryButton, LanguageToggle } from '../components/ui'
import { ShieldCheck, PhonePlusIcon } from '../components/icons'

const STEPS = [
  'JAGA joins quietly',
  'You keep talking as normal',
  "We tell you if it's a scam",
]

export default function AddJAGA() {
  return (
    <PhoneFrame>
      <div className="flex flex-1 flex-col px-5 pb-5 pt-2">
        {/* Caller header */}
        <div className="flex flex-col gap-1.5">
          <Eyebrow className="text-scam-ink">Call in progress</Eyebrow>
          <h1 className="text-[34px] font-black leading-[38px] text-ink">Unknown caller</h1>
          <p className="text-[16px] font-medium leading-[22px] text-subtle">
            +65 8123 4567 · 02:14
          </p>
        </div>

        {/* Reassurance block */}
        <div className="flex flex-1 flex-col items-center justify-center gap-6 py-6">
          <div className="flex h-[84px] w-[84px] shrink-0 items-center justify-center rounded-full bg-ink">
            <ShieldCheck size={44} className="text-unsure" />
          </div>
          <div className="flex flex-col items-center gap-2">
            <h2 className="text-center text-[22px] font-black leading-[28px] text-ink">
              JAGA can join this call
            </h2>
            <p className="max-w-[280px] text-center text-[16px] leading-[23px] text-subtle">
              The caller will not hear or see JAGA.
            </p>
          </div>

          <div className="flex w-full flex-col gap-3.5 px-2">
            {STEPS.map((step, i) => (
              <div key={i} className="flex items-center gap-3.5">
                <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-fill text-[16px] font-black leading-5 text-ink">
                  {i + 1}
                </div>
                <span className="text-[17px] font-semibold leading-[23px] text-ink">{step}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Action */}
        <div className="flex shrink-0 flex-col gap-4">
          <PrimaryButton to="/investigation" icon={<PhonePlusIcon size={30} className="text-white" />} className="!text-[24px]">
            Add JAGA to this call
          </PrimaryButton>
          <LanguageToggle />
        </div>
      </div>
    </PhoneFrame>
  )
}
