// functions/api/ack.js
// Auto-acknowledgement email for quote requests (Cloudflare Pages Functions + MailChannels)

export const onRequestPost = async (ctx) => {
  try {
    // Read JSON body (sendBeacon/fetch both OK)
    const raw = await ctx.request.text();
    const data = raw ? JSON.parse(raw) : {};

    // Basic fields (defensive defaults)
    const name    = (data.name || "Customer").toString().trim();
    const email   = (data.email || "").toString().trim();
    const phone   = (data.phone || "").toString().trim();
    const pickup  = (data.pickup || "").toString().trim();
    const dropoff = (data.dropoff || "").toString().trim();
    const date    = (data.date || "").toString().trim();
    const time    = (data.time || "").toString().trim();
    const pax     = (data.pax || "").toString().trim();
    const bags    = (data.bags || "").toString().trim();
    const vehicle = (data.vehicle || "").toString().trim();
    const notes   = (data.notes || "").toString().trim();
    const ref     = (data.ref || makeRef());

    if (!email) {
      return new Response('Missing customer email', { status: 400 });
    }

    // ---- CONFIGURE YOUR DESTINATION/ROUTING HERE ----
    const BOOKINGS_INBOX = "bookings@oxfordexecutivetravel.co.uk";     // shown in Reply-To and internal copy
    const INTERNAL_FALLBACK = "oxfordexecutivetravel1283@gmail.com";   // your Gmail

    // Subject + body (plain text, friendly + low-spammy)
    const subject = `Thanks ${name} — we’ve received your quote request (Ref ${ref})`;
    const textBody =
`Hello ${name},

Thanks for getting in touch with Oxford Executive Travel — your quote request has been received.

Request details (Ref ${ref})
• Pickup:   ${pickup || "-"}
• Drop-off: ${dropoff || "-"}
• Date:     ${date || "-"}   Time: ${time || "-"}
• Passengers: ${pax || "-"}  Luggage: ${bags || "-"}
• Vehicle:  ${vehicle || "-"}
• Notes:    ${notes || "-"}

What happens next
• We’ll review your request and reply with a fixed written quote shortly.
• For anything urgent, you can WhatsApp or call us on +44 7344 145197.

Kind regards,
Oxford Executive Travel
bookings@oxfordexecutivetravel.co.uk • +44 7344 145197
`;

    // MailChannels payload
    const payload = {
      personalizations: [
        {
          to: [{ email, name }],
        },
        // BCC a copy to your internal mailbox so you see every ack
        {
          bcc: [{ email: INTERNAL_FALLBACK, name: "OET Internal" }]
        }
      ],
      from: { email: "ack@oxfordexecutivetravel.co.uk", name: "Oxford Executive Travel" },
      reply_to: { email: BOOKINGS_INBOX, name: "Bookings — Oxford Executive Travel" },
      subject,
      headers: {
        // These help mailbox providers understand this is an automatic acknowledgement
        "Auto-Submitted": "auto-replied",
        "Precedence": "auto_reply",
        "X-Ack-Ref": ref,
        // Optional unsubscribe header (points to your bookings inbox)
        "List-Unsubscribe": "<mailto:bookings@oxfordexecutivetravel.co.uk?subject=unsubscribe>"
      },
      content: [
        { type: "text/plain", value: textBody }
      ]
    };

    const r = await fetch("https://api.mailchannels.net/tx/v1/send", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!r.ok) {
      const e = await r.text();
      return new Response(`MailChannels error: ${e}`, { status: 502 });
    }

    return new Response(JSON.stringify({ ok: true, ref }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (err) {
    return new Response(`Error: ${err.message}`, { status: 500 });
  }
};

function makeRef() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `OET-${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}-${Math.floor(1000+Math.random()*9000)}`;
}
