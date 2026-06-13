import dns from 'node:dns/promises';
import net from 'node:net';

const SERVICE_ENV_KEYS = ['LINK_AGENT_URL', 'DETONATION_URL', 'LINK_AGENT_ENDPOINT'];
const TOKEN_ENV_KEYS = ['LINK_AGENT_TOKEN', 'DETONATION_TOKEN'];
const DEFAULT_DETONATION_PATHS = ['/api/investigate-link', '/investigate-link', '/detonate'];
const DEMO_DOMAIN = 'dbs-secure.vercel.app';
const REQUEST_TIMEOUT_MS = 12000;
const EXTERNAL_DETONATION_TIMEOUT_MS = 180000;
const HTML_SAMPLE_LIMIT = 80000;
const MAX_REDIRECTS = 5;
const BRAND_TERMS = ['dbs', 'posb', 'ocbc', 'uob', 'singpass', 'cpf', 'iras', 'paypal', 'dhl'];
const OFFICIAL_DOMAINS = new Set([
  'dbs.com.sg',
  'dbs.com',
  'posb.com.sg',
  'ocbc.com',
  'ocbc.com.sg',
  'uob.com.sg',
  'uobgroup.com',
  'singpass.gov.sg',
  'cpf.gov.sg',
  'iras.gov.sg',
  'paypal.com',
  'dhl.com',
]);
const FREE_HOSTS = new Set([
  'vercel.app',
  'netlify.app',
  'github.io',
  'pages.dev',
  'web.app',
  'firebaseapp.com',
  'glitch.me',
  'wixsite.com',
  'weebly.com',
  'repl.co',
  'replit.app',
  'workers.dev',
  'trycloudflare.com',
  'onrender.com',
]);

function sendJson(response, status, payload) {
  response.statusCode = status;
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Headers', 'content-type');
  response.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  response.setHeader('Content-Type', 'application/json');
  response.end(JSON.stringify(payload));
}

async function readJson(request) {
  if (request.body && typeof request.body === 'object') return request.body;
  if (typeof request.body === 'string') {
    const body = request.body.trim();
    return body ? JSON.parse(body) : {};
  }

  const chunks = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const body = Buffer.concat(chunks).toString('utf8').trim();
  return body ? JSON.parse(body) : {};
}

function normalizeUrl(input) {
  const rawUrl = String(input || '').trim();
  if (!rawUrl) throw new Error('Missing url');

  const withProtocol = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
  const parsed = new URL(withProtocol);
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Only http and https URLs are supported');
  }
  return parsed;
}

function configuredServiceUrl() {
  for (const key of SERVICE_ENV_KEYS) {
    if (process.env[key]) return { key, value: process.env[key] };
  }
  return null;
}

function requestOrigin(request) {
  const host = request.headers['x-forwarded-host'] || request.headers.host;
  const proto = request.headers['x-forwarded-proto'] || 'https';
  return `${proto}://${host}`;
}

function configuredDetonationUrl(request) {
  const external = configuredServiceUrl();
  if (external) return external;
  if (process.env.DAYTONA_API_KEY) {
    return { key: 'DAYTONA_API_KEY', value: `${requestOrigin(request)}/api/daytona-detonate` };
  }
  return null;
}

function configuredToken() {
  for (const key of TOKEN_ENV_KEYS) {
    if (process.env[key]) return process.env[key];
  }
  return null;
}

function detonationUrlCandidates(configuredUrl) {
  const parsed = new URL(configuredUrl);
  if (parsed.pathname && parsed.pathname !== '/') return [parsed.toString()];

  return DEFAULT_DETONATION_PATHS.map((path) => {
    const candidate = new URL(parsed.toString());
    candidate.pathname = path;
    return candidate.toString();
  });
}

function rootDomain(hostname) {
  const parts = String(hostname || '').toLowerCase().split('.').filter(Boolean);
  if (parts.length <= 2) return parts.join('.');

  const twoPartTlds = new Set(['com.sg', 'net.sg', 'org.sg', 'gov.sg', 'edu.sg', 'co.uk']);
  if (twoPartTlds.has(parts.slice(-2).join('.'))) return parts.slice(-3).join('.');
  return parts.slice(-2).join('.');
}

function verdictFromRisk(risk) {
  if (risk >= 70) return 'scam';
  if (risk >= 35) return 'suspicious';
  return 'safe';
}

function clampRisk(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return undefined;
  return Math.max(0, Math.min(100, Math.round(numeric)));
}

function isOfficialDomain(hostname) {
  const root = rootDomain(hostname);
  return OFFICIAL_DOMAINS.has(root);
}

function isBlockedIp(address) {
  const family = net.isIP(address);
  if (family === 4) {
    const [a, b] = address.split('.').map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }

  if (family === 6) {
    const normalized = address.toLowerCase();
    return (
      normalized === '::1' ||
      normalized === '::' ||
      normalized.startsWith('fc') ||
      normalized.startsWith('fd') ||
      normalized.startsWith('fe80:')
    );
  }

  return true;
}

async function assertPublicHostname(hostname) {
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
    throw new Error('Blocked private or localhost destination');
  }

  if (net.isIP(hostname)) {
    if (isBlockedIp(hostname)) throw new Error('Blocked private or reserved IP destination');
    return;
  }

  const records = await dns.lookup(hostname, { all: true, verbatim: true });
  if (records.length === 0) throw new Error('DNS lookup returned no addresses');
  if (records.some((record) => isBlockedIp(record.address))) {
    throw new Error('Blocked private or reserved DNS destination');
  }
}

async function fetchWithTimeout(url, options = {}, timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function readLimitedText(response) {
  if (!response.body) return '';

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytesRead = 0;
  let output = '';

  while (bytesRead < HTML_SAMPLE_LIMIT) {
    const { done, value } = await reader.read();
    if (done) break;
    bytesRead += value.byteLength;
    output += decoder.decode(value, { stream: true });
    if (bytesRead >= HTML_SAMPLE_LIMIT) {
      await reader.cancel();
      break;
    }
  }

  output += decoder.decode();
  return output;
}

function extractTitle(html) {
  const match = String(html || '').match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? match[1].replace(/\s+/g, ' ').trim().slice(0, 180) : undefined;
}

async function detonateUrl(startUrl) {
  const redirects = [];
  let current = new URL(startUrl);
  let response = null;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    await assertPublicHostname(current.hostname);
    response = await fetchWithTimeout(current.toString(), {
      method: 'GET',
      redirect: 'manual',
      headers: {
        'User-Agent': 'JAGA-Link-Detonator/1.0 demo-safe server-side fetch',
        Accept: 'text/html,application/xhtml+xml,text/plain;q=0.8,*/*;q=0.5',
      },
    });

    const location = response.headers.get('location');
    if (![301, 302, 303, 307, 308].includes(response.status) || !location) break;

    const nextUrl = new URL(location, current);
    redirects.push({ from: current.toString(), to: nextUrl.toString(), status: response.status });
    current = nextUrl;
  }

  if (!response) throw new Error('No response from target URL');

  const html = await readLimitedText(response);
  return {
    finalUrl: current.toString(),
    statusCode: response.status,
    redirects,
    title: extractTitle(html),
    html,
    headers: {
      contentType: response.headers.get('content-type'),
      server: response.headers.get('server'),
      cacheControl: response.headers.get('cache-control'),
    },
  };
}

function analyzeDetonation({ requestedUrl, domain, detonation }) {
  const finalDomain = new URL(detonation.finalUrl).hostname.toLowerCase();
  const finalRoot = rootDomain(finalDomain);
  const lowerHtml = String(detonation.html || '').toLowerCase();
  const findings = [];
  let risk = 0;

  if (domain !== rootDomain(domain)) findings.push(`Detonated a subdomain of ${rootDomain(domain)}.`);
  if (FREE_HOSTS.has(rootDomain(domain)) || FREE_HOSTS.has(finalRoot)) {
    risk += 25;
    findings.push('Link lands on a free-hosting domain.');
  }
  if (domain === DEMO_DOMAIN) {
    risk += 30;
    findings.push('Link matches the controlled DBS-secure detonation fixture.');
  }
  if (detonation.redirects.length > 0) {
    risk += Math.min(20, detonation.redirects.length * 7);
    findings.push(`Detonation followed ${detonation.redirects.length} redirect(s).`);
  }
  if (finalDomain !== domain) {
    risk += 12;
    findings.push(`Final URL lands on ${finalDomain}.`);
  }
  if (detonation.finalUrl.startsWith('http://')) {
    risk += 15;
    findings.push('Final URL uses plain HTTP.');
  }
  if (detonation.statusCode >= 400) {
    risk += 8;
    findings.push(`Detonation target returned HTTP ${detonation.statusCode}.`);
  }

  const brandHits = BRAND_TERMS.filter((term) => lowerHtml.includes(term));
  if (brandHits.length > 0 && !isOfficialDomain(finalDomain)) {
    risk += 25;
    findings.push(`Detonated page references trusted brand terms: ${brandHits.slice(0, 3).join(', ')}.`);
  }
  if (/<form[\s>]/i.test(detonation.html)) {
    risk += 15;
    findings.push('Detonated page contains a form.');
  }
  if (/type=["']?password/i.test(detonation.html)) {
    risk += 25;
    findings.push('Detonated page asks for password-style input.');
  }
  if (/otp|one-time password|passcode|verify account|urgent|suspend|locked/i.test(detonation.html)) {
    risk += 15;
    findings.push('Detonated page uses account-verification or urgency language.');
  }

  const normalizedRisk = Math.max(0, Math.min(100, risk));
  const verdict = verdictFromRisk(normalizedRisk);
  const summary = verdict === 'scam'
    ? 'Link detonation found strong phishing indicators.'
    : verdict === 'suspicious'
      ? 'Link detonation found warning signs.'
      : 'Link detonation completed without strong warning signs.';

  return {
    status: 'ok',
    url: requestedUrl,
    domain,
    risk: normalizedRisk,
    verdict,
    summary,
    findings: findings.length > 0 ? findings : ['Link detonation completed and reached the target page.'],
    evidence: {
      finalUrl: detonation.finalUrl,
      screenshot: undefined,
      provider: 'vercel-link-detonation',
      statusCode: detonation.statusCode,
      redirects: detonation.redirects,
      title: detonation.title,
      contentType: detonation.headers.contentType,
    },
    raw: {
      detonation: {
        finalUrl: detonation.finalUrl,
        statusCode: detonation.statusCode,
        redirects: detonation.redirects,
        headers: detonation.headers,
        title: detonation.title,
        htmlSampleBytes: detonation.html.length,
      },
    },
  };
}

function normalizeExternalDetonation(raw, requestedUrl, domain, provider) {
  const evidence = raw?.evidence && typeof raw.evidence === 'object' ? raw.evidence : {};
  const risk = clampRisk(raw?.risk ?? raw?.riskScore ?? raw?.score);
  const normalizedRisk = risk ?? 50;
  const findings = Array.isArray(raw?.findings) ? raw.findings.map(String) : [];

  return {
    status: 'ok',
    url: requestedUrl,
    domain,
    risk: normalizedRisk,
    verdict: String(raw?.verdict || verdictFromRisk(normalizedRisk)).toLowerCase(),
    summary: raw?.summary || 'External link detonation completed.',
    findings,
    evidence: {
      finalUrl: raw?.finalUrl || raw?.final_url || evidence.finalUrl || evidence.final_url,
      screenshot: raw?.screenshot || raw?.screenshotUrl || evidence.screenshot || evidence.screenshotUrl,
      provider: evidence.provider || raw?.agent || provider,
      redirects: raw?.redirects || raw?.redirect_chain || evidence.redirects || evidence.redirect_chain,
      statusCode: raw?.statusCode || raw?.status_code || evidence.statusCode || evidence.status_code,
      brightData: raw?.brightData || raw?.bright_data || evidence.brightData || evidence.bright_data,
    },
    raw: raw ? { external: '[available from detonation service]' } : undefined,
  };
}

async function callExternalDetonation(configured, payload) {
  const token = configuredToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  let lastError = null;
  for (const candidate of detonationUrlCandidates(configured.value)) {
    try {
      const response = await fetchWithTimeout(candidate, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      }, EXTERNAL_DETONATION_TIMEOUT_MS);
      const text = await response.text();
      const body = text ? JSON.parse(text) : {};
      if (!response.ok) {
        lastError = new Error(body?.error || body?.message || `Detonation service responded ${response.status}`);
        continue;
      }
      return { body, provider: configured.key };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error('External detonation service unavailable');
}

function demoFallback(url, domain, reason) {
  return {
    status: 'demo-fallback',
    url,
    domain,
    risk: 92,
    verdict: 'scam',
    summary: 'Detonation fallback: the controlled fake DBS page is treated as phishing.',
    findings: [
      'Controlled DBS-secure demo domain was requested.',
      'Live detonation was unavailable, so demo-safe fallback kept the flow working.',
    ],
    evidence: {
      finalUrl: url,
      screenshot: undefined,
      provider: 'detonation-demo-fallback',
    },
    raw: { blocker: reason },
  };
}

export default async function handler(request, response) {
  if (request.method === 'OPTIONS') {
    sendJson(response, 204, {});
    return;
  }

  if (request.method !== 'POST') {
    sendJson(response, 405, { error: 'Method not allowed' });
    return;
  }

  let payload;
  let parsedUrl;
  try {
    payload = await readJson(request);
    parsedUrl = normalizeUrl(payload.url);
  } catch (error) {
    sendJson(response, 400, { status: 'error', error: error?.message || 'Invalid JSON body' });
    return;
  }

  const requestedUrl = parsedUrl.toString();
  const domain = parsedUrl.hostname.toLowerCase();
  const detonationPayload = {
    url: requestedUrl,
    callId: payload.callId,
    transcriptSegmentId: payload.transcriptSegmentId,
    source: payload.source || 'jaga-mobile-web',
  };

  const configured = configuredDetonationUrl(request);
  if (configured) {
    try {
      const { body, provider } = await callExternalDetonation(configured, detonationPayload);
      sendJson(response, 200, normalizeExternalDetonation(body, requestedUrl, domain, provider));
      return;
    } catch {
      // Fall through to built-in detonation so the demo is not hostage to one service.
    }
  }

  try {
    const detonation = await detonateUrl(requestedUrl);
    sendJson(response, 200, analyzeDetonation({ requestedUrl, domain, detonation }));
  } catch (error) {
    if (domain === DEMO_DOMAIN) {
      sendJson(response, 200, demoFallback(requestedUrl, domain, error?.message || 'Detonation unavailable'));
      return;
    }

    sendJson(response, error?.status || 502, {
      status: 'error',
      url: requestedUrl,
      domain,
      risk: 0,
      verdict: 'unknown',
      summary: 'Link detonation could not complete safely.',
      findings: [error?.message || 'Detonation unavailable'],
      evidence: { provider: 'vercel-link-detonation' },
      raw: { blocker: error?.message || 'Detonation unavailable' },
    });
  }
}
