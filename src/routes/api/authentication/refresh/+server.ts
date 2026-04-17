import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { fetchUpstream, passthroughResponse, upstreamFailureResponse, upstreamHeaders } from '$lib/server/upstream';

export const POST: RequestHandler = async ({ request }) => {
  const body = (await request.json().catch(() => null)) as { refreshToken?: string } | null;
  const refreshToken = body?.refreshToken?.trim();

  if (!refreshToken) {
    return json({ message: 'refreshToken is required' }, { status: 400 });
  }

  try {
    const upstream = await fetchUpstream('/authentication/refresh', {
      method: 'GET',
      headers: upstreamHeaders({ Token: refreshToken })
    });

    return passthroughResponse(upstream);
  } catch (error) {
    return upstreamFailureResponse(error);
  }
};
