import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import PhoneFrame from '../components/PhoneFrame'
import { ChevronLeft, ShieldCheck, ShieldAlert, ForwardIcon, PaperclipIcon, SendIcon } from '../components/icons'

export default function Chat() {
  const navigate = useNavigate()
  const [message, setMessage] = useState('')

  // Sending (or pressing Enter) runs the check → Investigation.
  function send(e) {
    e.preventDefault()
    navigate('/investigation')
  }
  return (
    <PhoneFrame back={false}>
      {/* Chat header */}
      <div className="flex shrink-0 items-center gap-3 border-b border-divider px-[18px] pb-3.5 pt-1.5">
        <button type="button" aria-label="Back" onClick={() => navigate(-1)} className="shrink-0 text-ink">
          <ChevronLeft size={20} />
        </button>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ink">
          <ShieldCheck size={24} className="text-unsure" />
        </div>
        <div className="flex flex-1 flex-col gap-0.5">
          <span className="text-[19px] font-black leading-6 text-ink">JAGA</span>
          {/* status = neutral gray (G1), never green */}
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-muted" />
            <span className="text-[14px] font-semibold leading-[18px] text-muted">Always here to check</span>
          </div>
        </div>
      </div>

      {/* Thread */}
      <div className="flex flex-1 flex-col gap-3 bg-[#F7F8FA] px-4 py-[18px]">
        <div className="flex justify-center pb-0.5">
          <span className="rounded-full bg-divider px-3 py-[5px] text-[12px] font-extrabold leading-4 text-muted">
            Today
          </span>
        </div>

        {/* JAGA intro (incoming) */}
        <div className="flex max-w-[84%] self-start">
          <div className="rounded-[18px_18px_18px_4px] border border-divider bg-white px-[15px] py-[13px]">
            <p className="text-[16px] font-medium leading-[23px] text-ink-soft">
              Forward me any suspicious message, link, or call recording. I’ll check it for you.
            </p>
          </div>
        </div>

        {/* Forwarded SMS (outgoing, light/outlined — not brand-black) */}
        <div className="flex max-w-[84%] self-end">
          <div className="flex flex-col gap-2 rounded-[18px_18px_4px_18px] border border-line bg-white px-[15px] py-[13px]">
            <div className="flex items-center gap-1.5">
              <ForwardIcon size={14} className="text-muted" />
              <span className="text-[12px] font-extrabold uppercase leading-4 tracking-[0.04em] text-muted">
                Forwarded SMS
              </span>
            </div>
            <p className="text-[16px] font-medium leading-[23px] text-ink-soft">
              DBS: Your account is locked. Verify now at dbs-secure-verify.com or it will be closed today.
            </p>
          </div>
        </div>

        {/* JAGA verdict bubble */}
        <div className="flex max-w-[88%] self-start">
          <div className="flex flex-col gap-3 rounded-[18px_18px_18px_4px] bg-scam p-4">
            <div className="flex items-center gap-2.5">
              <ShieldAlert size={24} className="shrink-0 text-white" />
              <span className="text-[22px] font-black leading-[26px] text-white">Scam · 95% sure</span>
            </div>
            <p className="text-[16px] font-medium leading-[23px] text-white">
              The link is a fake DBS site made 1 day ago. Do not tap it or share any details.
            </p>
            <Link to="/investigation" className="flex items-center justify-center rounded-[12px] bg-white p-3 text-[16px] font-black leading-5 text-scam-ink">
              See the full check
            </Link>
          </div>
        </div>
      </div>

      {/* Input bar */}
      <form onSubmit={send} className="flex shrink-0 items-center gap-2.5 border-t border-divider bg-white px-4 pb-5 pt-3">
        <div className="flex flex-1 items-center gap-2.5 rounded-full bg-fill px-[18px] py-[13px]">
          <PaperclipIcon size={20} className="shrink-0 text-muted" />
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Forward or paste a message…"
            className="w-full bg-transparent text-[16px] font-medium leading-[21px] text-ink outline-none placeholder:text-muted"
          />
        </div>
        {/* send = primary action → bg-ink (G1), not amber */}
        <button
          type="submit"
          aria-label="Send"
          className="flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-full bg-ink"
        >
          <SendIcon size={24} className="text-white" />
        </button>
      </form>
    </PhoneFrame>
  )
}
