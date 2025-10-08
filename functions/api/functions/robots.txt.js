export async function onRequest() {
  const body = `User-agent: *
Allow: /

Sitemap: https://oxfordexecutivetravel.co.uk/sitemap.xml
`;
  return new Response(body, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=3600'
    }
  });
}
