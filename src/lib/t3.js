// Terminal 3 (t3n) evidence seal — ported from Hosan's demo.
// SHA-256 is computed for real in the browser (Web Crypto), with a pure-JS
// fallback so it never breaks offline / on file://.

export const DID = 'did:t3n:7b0a40526b2e574b94647d37094c081e92817b30'

// The artifacts we hash — the real scam call from the Report screen.
const TRANSCRIPT =
  '[3:55] Move your money to this safe account right now. ' +
  '[4:16] Do not tell anyone about this transfer. ' +
  '[5:02] Go to dbs-secure-verify.com and confirm your details.'
const FINDINGS =
  'risk=96; fake DBS bank officer; money demand; secrecy pressure; ' +
  "lookalike link dbs-secure-verify.com registered 1 day ago; not DBS's real number"
const RECORDING_REF = 'blob://jaga/call_8f3a21.opus#' + TRANSCRIPT.length + 'bytes'

export const ARTIFACTS = { TRANSCRIPT, FINDINGS, RECORDING_REF }

export async function sha256(str) {
  try {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str))
      return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
    }
  } catch {
    /* fall through to pure-JS */
  }
  return sha256js(str)
}

export const short = (h) => h.slice(0, 10) + '…' + h.slice(-6)
export const dotSig = (h) =>
  '0x' +
  h.slice(0, 4).toUpperCase() +
  '·' +
  h.slice(4, 8).toUpperCase() +
  '·' +
  h.slice(8, 12).toUpperCase() +
  '·…·' +
  h.slice(-4).toUpperCase()
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/* compact pure-JS SHA-256 — used only if crypto.subtle is unavailable */
function sha256js(ascii) {
  const rr = (v, a) => (v >>> a) | (v << (32 - a))
  const K = []
  const H = []
  let p = 2
  let n = 0
  const isP = (x) => {
    for (let i = 2; i * i <= x; i++) if (x % i === 0) return false
    return true
  }
  while (n < 64) {
    if (isP(p)) {
      if (n < 8) H[n] = Math.floor((Math.pow(p, 0.5) % 1) * Math.pow(2, 32))
      K[n] = Math.floor((Math.pow(p, 1 / 3) % 1) * Math.pow(2, 32))
      n++
    }
    p++
  }
  const h = H.slice()
  const bytes = []
  for (let i = 0; i < ascii.length; i++) {
    const c = ascii.charCodeAt(i)
    if (c < 128) bytes.push(c)
    else if (c < 2048) bytes.push(192 | (c >> 6), 128 | (c & 63))
    else bytes.push(224 | (c >> 12), 128 | ((c >> 6) & 63), 128 | (c & 63))
  }
  const l = bytes.length * 8
  bytes.push(0x80)
  while (bytes.length % 64 !== 56) bytes.push(0)
  for (let i = 7; i >= 0; i--) bytes.push((l / Math.pow(2, i * 8)) & 0xff)
  const w = []
  for (let j = 0; j < bytes.length; j += 64) {
    for (let i = 0; i < 16; i++)
      w[i] = (bytes[j + i * 4] << 24) | (bytes[j + i * 4 + 1] << 16) | (bytes[j + i * 4 + 2] << 8) | bytes[j + i * 4 + 3]
    for (let i = 16; i < 64; i++) {
      const s0 = rr(w[i - 15], 7) ^ rr(w[i - 15], 18) ^ (w[i - 15] >>> 3)
      const s1 = rr(w[i - 2], 17) ^ rr(w[i - 2], 19) ^ (w[i - 2] >>> 10)
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0
    }
    let [a, b, c, d, e, f, g, hh] = h
    for (let i = 0; i < 64; i++) {
      const S1 = rr(e, 6) ^ rr(e, 11) ^ rr(e, 25)
      const ch = (e & f) ^ (~e & g)
      const t1 = (hh + S1 + ch + K[i] + w[i]) | 0
      const S0 = rr(a, 2) ^ rr(a, 13) ^ rr(a, 22)
      const mj = (a & b) ^ (a & c) ^ (b & c)
      const t2 = (S0 + mj) | 0
      hh = g
      g = f
      f = e
      e = (d + t1) | 0
      d = c
      c = b
      b = a
      a = (t1 + t2) | 0
    }
    h[0] = (h[0] + a) | 0
    h[1] = (h[1] + b) | 0
    h[2] = (h[2] + c) | 0
    h[3] = (h[3] + d) | 0
    h[4] = (h[4] + e) | 0
    h[5] = (h[5] + f) | 0
    h[6] = (h[6] + g) | 0
    h[7] = (h[7] + hh) | 0
  }
  return h.map((x) => (x >>> 0).toString(16).padStart(8, '0')).join('')
}
