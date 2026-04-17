import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { basicAuth, fetchUpstream, passthroughResponse, upstreamFailureResponse, upstreamHeaders } from '$lib/server/upstream';

export const POST: RequestHandler = async ({ request }) => {
  const body = (await request.json().catch(() => null)) as { email?: string; password?: string } | null;

  const email = body?.email?.trim();
  const password = body?.password ?? '';

  if (!email) {
    return json({ message: 'email is required' }, { status: 400 });
  }

  try {
    const upstream = await fetchUpstream('/authentication', {
      method: 'GET',
      headers: upstreamHeaders({
        Authorization: basicAuth(email, password)
      })
    });

    return passthroughResponse(upstream);
  } catch (error) {
    return upstreamFailureResponse(error);
  }
};
