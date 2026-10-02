export const config = {
  matcher: ['/pay/:path*', '/quote/:path*'],
};

export default function middleware(req: Request) {
  const url = new URL(req.url);
  const ua = (req.headers.get('user-agent') || '').toLowerCase();
  
  const BOT_AGENTS = [
    'whatsapp', 'facebookexternalhit', 'facebot', 'twitterbot',
    'linkedinbot', 'telegrambot', 'slackbot', 'discordbot',
    'googlebot', 'bingbot', 'yandexbot'
  ];

  const isBot = BOT_AGENTS.some(bot => ua.includes(bot));

  if (!isBot) {
    // Return empty response with x-middleware-next header to pass through to SPA
    return new Response(null, {
      headers: {
        'x-middleware-next': '1'
      }
    });
  }

  const pathname = url.pathname;
  const isInvoice = pathname.startsWith('/pay/');
  const baseUrl = 'https://billreve.app';

  const title = isInvoice
    ? "You've received an Invoice | BillReve"
    : "You've received a Quote | BillReve";
  const description = isInvoice
    ? 'Click to view your invoice details and confirm payment securely.'
    : 'Click to view your quote details, accept, or send a counter-offer.';
  const image = isInvoice
    ? `${baseUrl}/og-invoice.png`
    : `${baseUrl}/og-quote.png`;

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${baseUrl}${pathname}" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:image" content="${image}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${description}" />
  <meta name="twitter:image" content="${image}" />
  <title>${title}</title>
</head>
<body></body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html' },
  });
}
