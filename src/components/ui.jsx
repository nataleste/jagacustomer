import { Link } from 'react-router-dom'

// Shared primitives. Buttons default to the G1-correct styles:
//   PrimaryButton  → bg-ink (black). Never a verdict color.
//   SecondaryButton→ white + neutral border.
// Pass `to` to render a real router Link (navigates); omit for a plain button.

export function Eyebrow({ children, className = 'text-muted' }) {
  return (
    <div
      className={`text-[13px] font-black uppercase leading-[18px] tracking-[0.06em] ${className}`}
    >
      {children}
    </div>
  )
}

function buttonClasses(base, className) {
  return `flex w-full items-center justify-center gap-[10px] rounded-btn py-5 text-[21px] font-black leading-[26px] ${base} ${className}`
}

export function PrimaryButton({ children, icon, to, state, onClick, className = '' }) {
  const cls = buttonClasses('bg-ink text-white', className)
  if (to) return <Link to={to} state={state} className={cls}>{icon}{children}</Link>
  return <button onClick={onClick} className={cls}>{icon}{children}</button>
}

export function SecondaryButton({ children, icon, to, onClick, className = '' }) {
  const cls = buttonClasses('border border-line bg-white text-ink', className)
  if (to) return <Link to={to} className={cls}>{icon}{children}</Link>
  return <button onClick={onClick} className={cls}>{icon}{children}</button>
}

// EN / 中文 / Melayu — active uses ink (neutral), never a verdict color.
export function LanguageToggle({ className = '' }) {
  const langs = ['EN', '中文', 'Melayu']
  return (
    <div className={`flex items-center justify-center gap-2 ${className}`}>
      {langs.map((l, i) => (
        <button
          key={l}
          className={`rounded-full px-4 py-2 text-[14px] font-black leading-[18px] ${
            i === 0 ? 'bg-ink text-white' : 'bg-fill text-subtle'
          }`}
        >
          {l}
        </button>
      ))}
    </div>
  )
}
