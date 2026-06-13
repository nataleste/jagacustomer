export function publicFunctionsBaseUrl(request: Request) {
  const configured = Deno.env.get('PUBLIC_FUNCTIONS_BASE_URL');
  if (configured) return configured.replace(/\/$/, '');

  const url = new URL(request.url);
  const functionPrefix = '/functions/v1/';
  const prefixIndex = url.pathname.indexOf(functionPrefix);
  if (prefixIndex >= 0) {
    return `${url.origin}${url.pathname.slice(0, prefixIndex + functionPrefix.length - 1)}`;
  }

  if (url.hostname.endsWith('.supabase.co')) {
    return `https://${url.host}${functionPrefix.slice(0, -1)}`;
  }

  return url.origin;
}

export function demoUserId() {
  return Deno.env.get('DEMO_SUPABASE_USER_ID') || null;
}
