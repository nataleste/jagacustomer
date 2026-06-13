import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PhoneFrame from '../components/PhoneFrame'
import { ChevronLeft, PaperclipIcon, SendIcon } from '../components/icons'
import { extractUrl, investigateLink } from '../lib/jaga'
import mascot from '../assets/jaga-mascot.png'

const INTRO = "Forward me any suspicious message, link, or call recording. I'll check it for you."

// Quick-fill examples so you can demo without typing.
const SUGGESTIONS = [
  { label: 'Paste a suspicious link', value: 'https://dbs-secure-verify.com/login' },
  { label: 'Paste a bank SMS', value: 'DBS: Your account is locked. Verify now at dbs-secure-verify.com or it will be closed today.' },
]

function Bubble({ from, children }) {
  if (from === 'user') {
    return (
      <div className="flex max-w-[84%] self-end">
        <div className="rounded-[18px_18px_4px_18px] bg-ink px-[15px] py-[13px]">
          <p className="break-words text-[16px] font-medium leading-[23px] text-white">{children}</p>
        </div>
      </div>
    )
  }
  return (
    <div className="flex max-w-[84%] self-start">
      <div className="rounded-[18px_18px_18px_4px] border border-divider bg-white px-[15px] py-[13px]">
        <p className="text-[16px] font-medium leading-[23px] text-ink-soft">{children}</p>
      </div>
    </div>
  )
}

export default function Chat() {
  const navigate = useNavigate()
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [messages, setMessages] = useState([{ id: 0, from: 'jaga', text: INTRO }])

  async function send(e) {
    e.preventDefault()
    const text = input.trim()
    if (!text || sending) return
    const url = extractUrl(text)
    const checking = url
      ? 'Opening this link in a sealed sandbox…'
      : 'Checking this now…'
    setMessages((m) => [
      ...m,
      { id: m.length, from: 'user', text },
      { id: m.length + 1, from: 'jaga', text: checking },
    ])
    setInput('')
    setSending(true)

    // If there's a link, run it through Hosan's agent and carry the real
    // finding into the Investigation. If the service is down (or no link),
    // fall back to the static demo so the flow never breaks.
    if (url) {
      try {
        const finding = await investigateLink(url)
        navigate('/investigation', { state: { finding } })
        return
      } catch {
        /* service unreachable — fall through to static demo */
      }
    }
    setTimeout(() => navigate('/investigation'), 600)
  }

  const showSuggestions = messages.length === 1 && !sending

  return (
    <PhoneFrame back={false}>
      {/* Chat header */}
      <div className="flex shrink-0 items-center gap-3 border-b border-divider px-[18px] pb-3.5 pt-1.5">
        <button type="button" aria-label="Back" onClick={() => navigate(-1)} className="shrink-0 text-ink">
          <ChevronLeft size={20} />
        </button>
        <img src={mascot} alt="JAGA" className="h-11 w-11 shrink-0 object-contain" />
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

        {messages.map((m) => (
          <Bubble key={m.id} from={m.from}>
            {m.text}
          </Bubble>
        ))}
      </div>

      {/* Suggestions + input */}
      <div className="flex shrink-0 flex-col gap-2.5 border-t border-divider bg-white px-4 pb-5 pt-3">
        {showSuggestions && (
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s.label}
                type="button"
                onClick={() => setInput(s.value)}
                className="rounded-full border border-line bg-fill px-3.5 py-2 text-[13px] font-bold leading-4 text-subtle"
              >
                {s.label}
              </button>
            ))}
          </div>
        )}

        <form onSubmit={send} className="flex items-center gap-2.5">
          <div className="flex flex-1 items-center gap-2.5 rounded-full bg-fill px-[18px] py-[13px]">
            <PaperclipIcon size={20} className="shrink-0 text-muted" />
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Forward or paste a message…"
              className="w-full bg-transparent text-[16px] font-medium leading-[21px] text-ink outline-none placeholder:text-muted"
            />
          </div>
          {/* send = primary action → bg-ink (G1), not amber */}
          <button
            type="submit"
            aria-label="Send"
            className="flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-full bg-ink disabled:opacity-40"
            disabled={!input.trim() || sending}
          >
            <SendIcon size={24} className="text-white" />
          </button>
        </form>
      </div>
    </PhoneFrame>
  )
}
