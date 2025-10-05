// functions/api/ack.js
// Sends an automatic acknowledgement to the customer when they request a quote.
// Works on Cloudflare Pages/Workers via MailChannels.

export const onRequestPost = async (ctx) => {
  try {
    // Accept both JSON and sendBeacon-without-headers
    const raw = await ctx.request.text();
    let data = {};
    try { data = JSON.parse(raw || "{}"); } catch (_) {}

    const name    = (data.name   || "Customer").toString().trim();
    const email   = (data.email  || "").toString().trim();
    const pickup  = (data.pickup || "").toString().trim();
    const dropoff = (data.dropoff|| "").toString().trim();
    const date    = (data.date   || "").toString().trim();
    const time    = (data.time   || "").toString().trim();
    const pax     = (data.pax    || "").toString().trim();
    const bags    = (data.bags   || "").toString().trim();
    const vehicle = (data.vehicle|| "").toString().trim();
    const notes   = (data.notes  || "").toString().trim();
    const ref     = (data.ref    || makeRef());

    if (!email) {
      return new Response("Missing customer email", { status: 400 });
    }

    const subject = `Thanks — we’ve got your request [${ref}] ✅`;

    const parts = [];
    if (pickup || dropoff) parts.push(`Route: ${pickup} → ${dropoff}`.trim());
    if (date || time)      parts.push(`When: ${date} ${time}`.trim());
    if (pax)               parts.push(`Passengers: ${pax}`);
    if (bags)              parts.push(`Luggage: ${bags}`);
    if (vehicle)           parts.push(`Vehicle: ${vehicle}`);
    const summary = parts.join("\n");

    const textBody = (
`Hi ${name},

Thanks for contacting Oxford Executive Travel. We’ve received your booking/quote request and will be in touch shortly with a fixed price and availability.

${summary ? "— Summary —\n" + summary + "\n" : ""}${notes ? "\nNotes:\n" + notes + "\n" : ""}Reference: ${ref}

Need it urgently? WhatsApp us now: +44 7344 145197
Or call: +44 7344 145197

— Oxford Executive Travel
Licensed & Insured • Mercedes E-Class & V-Class
https://oxfordexecutivetravel.co.uk`
    );

    // IMPORTANT: use a sender on your own domain and ensure SPF/DKIM are set in Cloudflare DNS
    const FROM_ADDRESS   = "no-reply@oxfordexecutivetravel.co.uk";
    const BOOKINGS_INBOX = "bookings@oxfordexecutivetravel.co.uk";

    const payload = {
      personalizations: [{ to: [{ email }] }],
      from: { email: FROM_ADDRESS, name: "Oxford Executive Travel" },
      reply_to: { email: BOOKINGS_INBOX, name: "Oxford Executive Travel" },
      subject,
      content: [{ type: "text/plain", value: textBody }],
    };

    const r = await fetch("https://api.mailchannels.net/tx/v1/send", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!r.ok) {
      const e = await r.text();
      return new Response(`MailChannels error: ${e}`, { status: 500 });
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
  const pad = n => String(n).padStart(2, "0");
  return `OET-${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}-${Math.floor(1000+Math.random()*9000)}`;
}
