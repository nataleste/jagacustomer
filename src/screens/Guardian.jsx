import PhoneFrame from '../components/PhoneFrame'
import { Eyebrow, PrimaryButton, SecondaryButton } from '../components/ui'
import { ShieldCheck, PhoneIcon } from '../components/icons'

export default function Guardian() {
  return (
    <PhoneFrame>
      <div className="flex flex-1 flex-col gap-4 px-5 pb-5 pt-2">
        {/* Alert header */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-scam" />
            <Eyebrow className="text-scam-ink">JAGA alert · just now</Eyebrow>
          </div>
          <div className="flex items-center gap-[13px]">
            <div className="flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-full bg-unsure text-[18px] font-black leading-[22px] text-ink">
              MT
            </div>
            <div className="flex flex-1 flex-col gap-0.5">
              <span className="text-[20px] font-black leading-[25px] text-ink">About Mum · Mdm Tan</span>
              <span className="text-[15px] font-medium leading-5 text-muted">
                You are her trusted guardian
              </span>
            </div>
          </div>
        </div>

        {/* Alert panel */}
        <div className="flex flex-1 flex-col gap-4 rounded-[24px] bg-scam px-6 py-[26px]">
          <h1 className="text-[38px] font-black leading-[42px] tracking-[-0.01em] text-white">
            Mum may be in a scam call right now
          </h1>
          <div className="flex items-baseline gap-2">
            <span className="text-[28px] font-black leading-[30px] text-white">96%</span>
            <span className="text-[17px] font-bold leading-[22px] text-[#FFD0CC]">sure it is a scam</span>
          </div>
          <div className="h-px w-full bg-white/30" />
          <p className="text-[21px] font-semibold leading-[28px] text-white">
            A caller pretending to be her bank is rushing her to send money.
          </p>

          <div className="flex-1" />

          <div className="flex items-center gap-[9px] rounded-chip bg-white/[0.16] px-[14px] py-3">
            <ShieldCheck size={20} className="shrink-0 text-white" checkColor="#D92D20" />
            <span className="text-[15px] font-semibold leading-5 text-white">
              JAGA has already warned Mum on the call.
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex shrink-0 flex-col gap-2.5">
          <PrimaryButton icon={<PhoneIcon className="text-white" />}>Call Mum now</PrimaryButton>
          <SecondaryButton to="/report">See what happened</SecondaryButton>
        </div>
      </div>
    </PhoneFrame>
  )
}
