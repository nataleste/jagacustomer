import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.84.0';

export function createServiceClient() {
  const url = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!url || !serviceRoleKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
    },
  });
}

export async function readFormOrJson(request: Request): Promise<Record<string, string>> {
  const contentType = request.headers.get('content-type') ?? '';

  if (contentType.includes('application/json')) {
    const body = await request.json();
    return Object.fromEntries(
      Object.entries(body as Record<string, unknown>).map(([key, value]) => [key, String(value ?? '')]),
    );
  }

  const form = await request.formData();
  return Object.fromEntries([...form.entries()].map(([key, value]) => [key, String(value)]));
}
