export async function onRequestPost(context) {
  try {
    const { targetUrl, method = 'POST', headers = {}, body } = await context.request.json();
    if (!targetUrl || typeof targetUrl !== 'string') {
      return new Response(JSON.stringify({ error: '缺少 targetUrl' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const u = new URL(targetUrl);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') {
      return new Response(JSON.stringify({ error: 'targetUrl 必须是 http(s) 地址' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const upstream = await fetch(targetUrl, {
      method,
      headers,
      body: body === undefined || body === null ? undefined : String(body),
    });
    const respHeaders = new Headers(upstream.headers);
    respHeaders.delete('content-length');
    return new Response(upstream.body, {
      status: upstream.status,
      headers: respHeaders,
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
