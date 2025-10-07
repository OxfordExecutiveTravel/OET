// functions/api/ack.js
// Sends an automatic acknowledgement to the customer when they request a quote,
// and BCCs your team. Works on Cloudflare Pages/Workers via MailChannels.

const BRAND = "Oxford Executive Travel";

// Where customers can reply (goes to your inbox)
const BOOKINGS_INBOX = "bookings@oxfordexecutivetravel.co.uk";

// You asked to receive a copy of every acknowledgement here:
const OWNER_COPY = "oxfordexecutivetravel1283@gmail.com";

// "From" must be on your own domain (SPF includes MailChannels already)
const FROM_EMAIL = "noreply@oxfordexecutivetravel.co.uk";

export const onRequestPost = async (ctx) => {
  try {
    // Accept both JSON and sendBeacon-without-headers
    const raw = await ctx.request.text();
    let data = {};
    try { data = JSON.parse(raw || "{}"); } catch (_) {}

    const get = (k, d = "") => (data[k] ?? d).toString().trim();

    const name    = get("name", "Customer");
    const email   = get("email", "");
    const phone   = get("phone", "");
    const pickup  = get("pickup", "");
    const dropoff = get("dropoff", "");
    const date    = get("date", "");
    const time    = get("time", "");
    const pax     = get("pax", "");
    const bags    = get("bags", "");
    const vehicle = get("vehicle", "");
    const notes   = get("notes", "");
    const ref     = get("ref") || makeRef();

    if (!email) {
      return json({ ok: false, error: "Missing customer email" }, 400);
    }

    // ---------- Customer acknowledgement (with BCC to team) ----------
    const subjectAck = `Thank you — we’re preparing your quote (Ref ${ref})`;

    const textAck = [
      `Hello ${name},`,
      ``,
      `Thank you for your enquiry. A member of the team will review the details and reply shortly with a fixed quote.`,
      ``,
      `Reference: ${ref}`,
      `Pickup: ${pickup}`,
      `Drop-off: ${dropoff}`,
      `Date & Time: ${date} ${time}`,
      `Passengers / Luggage: ${pax} pax, ${bags} bags`,
      `Vehicle: ${vehicle}`,
      notes ? `Notes: ${notes}` : ``,
      ``,
      `If anything changes, you can reply directly to this email.`,
      ``,
      `— ${BRAND}`,
      `Tel: +44 7344 145197`,
      `Email: bookings@oxfordexecutivetravel.co.uk`,
      `Website: https://oxfordexecutivetravel.co.uk/`
    ].join("\n");

    const htmlAck = `
      <div style="font:14px/1.6 -apple-system,Segoe UI,Roboto,Helvetica,Arial;color:#0b1220">
        <p>Hello ${escapeHtml(name)},</p>
        <p>Thank you for your enquiry. A member of the team will review the details and reply shortly with a fixed quote.</p>
        <table style="border-collapse:collapse;margin:12px 0">
          <tr><td style="padding:4px 8px;color:#475569">Reference:</td><td style="padding:4px 8px"><b>${escapeHtml(ref)}</b></td></tr>
          <tr><td style="padding:4px 8px;color:#475569">Pickup:</td><td style="padding:4px 8px">${escapeHtml(pickup)}</td></tr>
          <tr><td style="padding:4px 8px;color:#475569">Drop-off:</td><td style="padding:4px 8px">${escapeHtml(dropoff)}</td></tr>
          <tr><td style="padding:4px 8px;color:#475569">Date &amp; Time:</td><td style="padding:4px 8px">${escapeHtml(date)} ${escapeHtml(time)}</td></tr>
          <tr><td style="padding:4px 8px;color:#475569">Passengers / Luggage:</td><td style="padding:4px 8px">${escapeHtml(pax)} pax, ${escapeHtml(bags)} bags</td></tr>
          <tr><td style="padding:4px 8px;color:#475569">Vehicle:</td><td style="padding:4px 8px">${escapeHtml(vehicle)}</td></tr>
          ${notes ? `<tr><td style="padding:4px 8px;color:#475569">Notes:</td><td style="padding:4px 8px">${escapeHtml(notes)}</td></tr>` : ``}
        </table>
        <p>If anything changes, you can reply directly to this email.</p>
        <p style="margin-top:16px">— ${BRAND}<br>
           Tel: +44 7344 145197<br>
           Email: bookings@oxfordexecutivetravel.co.uk<br>
           Website: <a href="https://oxfordexecutivetravel.co.uk/">oxfordexecutivetravel.co.uk</a></p>
      </div>
    `.trim();

    const ackPayload = {
      personalizations: [{
        to: [{ email, name }],
        bcc: [
          { email: BOOKINGS_INBOX, name: BRAND },
          { email: OWNER_COPY,     name: "Owner copy" }
        ]
      }],
      from: { email: FROM_EMAIL, name: BRAND },
      reply_to: { email: BOOKINGS_INBOX, name: BRAND },
      subject: subjectAck,
      content: [
        { type: "text/plain", value: textAck },
        { type: "text/html",  value: htmlAck }
      ],
    };

    const r1 = await fetch("https://api.mailchannels.net/tx/v1/send", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(ackPayload),
    });

    if (!r1.ok) {
      const e = await r1.text().catch(() => "");
      return json({ ok: false, error: `MailChannels error: ${e || r1.status}` }, 502);
    }

    // ---------- (Optional) Staff summary email ----------
    const subjectStaff = `New quote — ${pickup} → ${dropoff} (${date} ${time}) [${ref}]`;
    const textStaff = [
      `New quote request`,
      ``,
      `Ref: ${ref}`,
      `Name: ${name}`,
      `Email: ${email}`,
      `Phone: ${phone}`,
      ``,
      `Pickup: ${pickup}`,
      `Drop-off: ${dropoff}`,
      `Date & Time: ${date} ${time}`,
      `Passengers: ${pax}`,
      `Bags: ${bags}`,
      `Vehicle: ${vehicle}`,
      notes ? `Notes: ${notes}` : ``,
    ].join("\n");

    const staffPayload = {
      personalizations: [{ to: [{ email: BOOKINGS_INBOX, name: BRAND }] }],
      from: { email: FROM_EMAIL, name: `${BRAND} Website` },
      reply_to: { email: email || BOOKINGS_INBOX, name },
      subject: subjectStaff,
      content: [{ type: "text/plain", value: textStaff }],
    };

    // Fire and forget; if it fails we still return success for the customer ack
    fetch("https://api.mailchannels.net/tx/v1/send", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(staffPayload),
      // no await
    }).catch(() => {});

    return json({ ok: true, ref });

  } catch (err) {
    return json({ ok: false, error: (err && err.message) || "Server error" }, 500);
  }
};

// -------- helpers --------
function makeRef() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `OET-${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}-${Math.floor(1000 + Math.random()*9000)}`;
}

function escapeHtml(s = "") {
  return s.replace(/[&<>"']/g, (ch) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch])
  );
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json" },
  });
}
