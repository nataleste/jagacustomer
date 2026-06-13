import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PhoneFrame from '../components/PhoneFrame'
import { PrimaryButton } from '../components/ui'
import { LockIcon, CheckIcon, ShieldCheck } from '../components/icons'
import { DID, ARTIFACTS, sha256, short, dotSig, sleep } from '../lib/t3'

const STEP_LABELS = [
  'Building evidence manifest',
  'Hashing transcript',
  'Hashing recording',
  'Hashing agent findings',
  'Sealing to Terminal 3',
  'Verifying integrity · TEE attestation',
]

function ManifestPreview({ mf }) {
  const f = (v) => (v ? `"${short(v)}"` : '⏳ pending')
  const line = (k, v, val = false) => (
    <div>
      <span className="text-[#7CA0FF]">"{k}"</span>
      <span className="text-faint">: </span>
      <span className={val ? 'text-unsure' : 'text-[#7BD389]'}>{v}</span>
    </div>
  )
  return (
    <div className="rounded-chip border border-white/10 bg-white/[0.04] p-3 font-mono text-[11px] leading-[18px]">
      <div className="text-faint">{'{'}</div>
      <div className="pl-3">
        {line('call_id', '"call_8f3a21"')}
        {line('transcript_sha256', f(mf.transcript), true)}
        {line('recording_sha256', f(mf.recording), true)}
        {line('app_log_sha256', f(mf.app_log), true)}
      </div>
      <div className="text-faint">{'}'}</div>
    </div>
  )
}

export default function Sealing() {
  const navigate = useNavigate()
  const started = useRef(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [completed, setCompleted] = useState(0)
  const [details, setDetails] = useState([])
  const [manifest, setManifest] = useState({})
  const [sealHash, setSealHash] = useState(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    ;(async () => {
      const mf = {}
      const det = []
      const finish = (i, detail) => {
        det[i] = detail
        setDetails([...det])
        setCompleted(i + 1)
      }

      setActiveIndex(0)
      await sleep(550)
      finish(0, 'call_8f3a21 · 4 artifacts')

      setActiveIndex(1)
      mf.transcript = await sha256(ARTIFACTS.TRANSCRIPT)
      setManifest({ ...mf })
      finish(1, 'sha256 ' + short(mf.transcript))

      setActiveIndex(2)
      mf.recording = await sha256(ARTIFACTS.RECORDING_REF)
      setManifest({ ...mf })
      finish(2, 'sha256 ' + short(mf.recording))

      setActiveIndex(3)
      mf.app_log = await sha256(ARTIFACTS.FINDINGS)
      setManifest({ ...mf })
      finish(3, 'sha256 ' + short(mf.app_log))

      setActiveIndex(4)
      await sleep(950)
      const seal = await sha256(JSON.stringify(mf) + '|call_8f3a21|1749818640')
      setSealHash(seal)
      finish(4, 'tx ' + short(seal))

      setActiveIndex(5)
      await sleep(800)
      finish(5, 'verifyTdxQuote ✓ · re-hash matches')

      setDone(true)
    })()
  }, [])

  const workingText =
    activeIndex === 4 ? 'Writing seal to t3n ledger…' : STEP_LABELS[activeIndex] + '…'

  return (
    <PhoneFrame dark back={false}>
      <div className="flex flex-1 flex-col gap-5 px-5 pb-5 pt-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <ShieldCheck size={22} className="text-unsure" />
            <span className="text-[16px] font-black leading-5 text-white">Terminal 3 · evidence seal</span>
          </div>
          <span className="text-[12px] font-bold leading-4 text-faint">testnet · sg</span>
        </div>

        {/* did */}
        <div className="flex items-center gap-2 rounded-chip border border-white/10 bg-white/[0.04] px-3 py-2.5">
          <LockIcon size={16} className="shrink-0 text-unsure" />
          <span className="truncate font-mono text-[12px] leading-4 text-faint">{DID}</span>
        </div>

        {/* manifest */}
        <ManifestPreview mf={manifest} />

        {/* step log */}
        <div className="flex flex-col gap-3">
          {STEP_LABELS.map((label, i) => {
            const isDone = i < completed
            const isActive = !isDone && i === activeIndex
            return (
              <div key={i} className="flex items-start gap-3">
                <div className="mt-0.5 flex h-[22px] w-[22px] shrink-0 items-center justify-center">
                  {isDone ? (
                    <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-unsure/20">
                      <CheckIcon size={13} className="text-unsure" />
                    </span>
                  ) : isActive ? (
                    <span className="h-[18px] w-[18px] animate-spin rounded-full border-2 border-white/20 border-t-unsure" />
                  ) : (
                    <span className="h-[18px] w-[18px] rounded-full border-2 border-white/15" />
                  )}
                </div>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className={`text-[15px] font-bold leading-5 ${isDone || isActive ? 'text-white' : 'text-faint'}`}>
                    {label}
                  </span>
                  {details[i] && (
                    <span className="truncate font-mono text-[12px] leading-[18px] text-unsure">{details[i]}</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* progress */}
        <div className="flex h-1.5 overflow-hidden rounded-full bg-white/10">
          <div
            className="rounded-full bg-unsure transition-all duration-300"
            style={{ width: `${(completed / STEP_LABELS.length) * 100}%` }}
          />
        </div>

        <div className="flex-1" />

        {/* footer */}
        {done ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <ShieldCheck size={18} className="text-unsure" />
              <span className="text-[15px] font-bold leading-5 text-white">
                Sealed &amp; signed · re-hash matches ✓
              </span>
            </div>
            <PrimaryButton
              onClick={() => navigate('/report/filed', { state: { seal: { hash: sealHash } } })}
              className="!bg-white !text-ink"
            >
              View signed receipt →
            </PrimaryButton>
          </div>
        ) : (
          <div className="flex items-center gap-2.5">
            <span className="h-[14px] w-[14px] animate-spin rounded-full border-2 border-white/20 border-t-unsure" />
            <span className="text-[15px] font-semibold leading-5 text-faint">{workingText}</span>
          </div>
        )}
      </div>
    </PhoneFrame>
  )
}
