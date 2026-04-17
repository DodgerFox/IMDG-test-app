import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { fetchUpstream, passthroughResponse, upstreamFailureResponse, upstreamHeaders } from '$lib/server/upstream';

export const GET: RequestHandler = async ({ request, url }) => {
  const token = request.headers.get('Token') ?? request.headers.get('token');
  if (!token) {
    return json({ message: 'Token header is required' }, { status: 401 });
  }

  const query = url.searchParams.toString();
  try {
    const upstream = await fetchUpstream(`/imdg${query ? `?${query}` : ''}`, {
      method: 'GET',
      headers: upstreamHeaders({ Token: token })
    });

    return passthroughResponse(upstream);
  } catch (error) {
    return upstreamFailureResponse(error);
  }
};
