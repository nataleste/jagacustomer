import PhoneFrame from '../components/PhoneFrame'
import { PrimaryButton } from '../components/ui'
import { CheckCircle, ShieldCheck } from '../components/icons'
import logo from '../assets/jaga-lockup-horizontal.svg'

function Toggle() {
  return (
    <div className="flex h-8 w-[52px] shrink-0 items-center justify-end rounded-full bg-ink p-[3px]">
      <div className="h-[26px] w-[26px] rounded-full bg-white" />
    </div>
  )
}

function StepNum({ n }) {
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink text-[15px] font-black leading-5 text-white">
      {n}
    </div>
  )
}

export default function Onboarding() {
  return (
    <PhoneFrame>
      <div className="flex flex-col gap-6 px-5 pb-6 pt-2">
        <div className="flex flex-col gap-1.5">
          <img src={logo} alt="JAGA" className="mb-2 h-11 w-auto" />
          <h1 className="text-[34px] font-black leading-[38px] text-ink">Let’s set you up</h1>
          <p className="text-[16px] font-medium leading-[22px] text-subtle">
            Three quick things. You can change them later.
          </p>
        </div>

        {/* Step 1 — trusted contact */}
        <div className="flex flex-col gap-3.5 rounded-[16px] border border-line p-[18px]">
          <div className="flex items-center gap-3">
            <StepNum n={1} />
            <span className="flex-1 text-[19px] font-black leading-6 text-ink">Add a trusted contact</span>
          </div>
          <p className="text-[15px] font-medium leading-[21px] text-subtle">
            We will alert this person if JAGA finds you are in a scam.
          </p>
          <div className="flex items-center gap-3 rounded-chip bg-fill px-[14px] py-3">
            <div className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full bg-unsure text-[14px] font-black leading-[18px] text-ink">ST</div>
            <div className="flex flex-1 flex-col">
              <span className="text-[16px] font-extrabold leading-[21px] text-ink">Sarah Tan</span>
              <span className="text-[14px] font-medium leading-[18px] text-muted">Daughter · 9123 4567</span>
            </div>
            <CheckCircle size={22} className="shrink-0 text-ink" />
          </div>
        </div>

        {/* Step 2 — recording consent */}
        <div className="flex flex-col gap-3.5 rounded-[16px] border border-line p-[18px]">
          <div className="flex items-center gap-3">
            <StepNum n={2} />
            <span className="flex-1 text-[19px] font-black leading-6 text-ink">Let JAGA record calls</span>
            <Toggle />
          </div>
          <p className="text-[15px] font-medium leading-[21px] text-subtle">
            Needed to build your report. Recordings are kept 30 days, then deleted automatically.
          </p>
        </div>

        {/* Step 3 — add JAGA to contacts (the Twilio number) */}
        <div className="flex flex-col gap-3.5 rounded-[16px] border border-line p-[18px]">
          <div className="flex items-center gap-3">
            <StepNum n={3} />
            <span className="flex-1 text-[19px] font-black leading-6 text-ink">Add JAGA to phone contacts</span>
          </div>
          <p className="text-[15px] font-medium leading-[21px] text-subtle">
            Save JAGA’s number so it can quietly join your calls and transcribe them.
          </p>
          <div className="flex items-center gap-3 rounded-chip bg-fill px-[14px] py-3">
            <div className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full bg-ink">
              <ShieldCheck size={20} className="text-unsure" />
            </div>
            <div className="flex flex-1 flex-col">
              <span className="text-[16px] font-extrabold leading-[21px] text-ink">JAGA</span>
              <span className="text-[14px] font-medium leading-[18px] text-muted">+65 3138 5000</span>
            </div>
            <CheckCircle size={22} className="shrink-0 text-ink" />
          </div>
        </div>

        {/* Finish */}
        <div className="flex flex-col gap-3 pt-1">
          <PrimaryButton to="/home" className="!text-[21px]">I’m ready</PrimaryButton>
          <p className="text-center text-[13px] font-medium leading-[18px] text-muted">
            You are inviting JAGA onto your own calls as your guardian. You can remove it anytime.
          </p>
        </div>
      </div>
    </PhoneFrame>
  )
}
