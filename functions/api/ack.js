// functions/api/ack.js
export async function onRequest({ request }) {
  // CORS + simple GET healthcheck
  if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders() });
  if (request.method !== "POST") return new Response("OK: /api/ack is live", { headers: corsHeaders() });

  let data = {};
  try { data = await request.json(); } catch (_) {}

  const {
    name = "Customer", email = "", phone = "",
    pickup = "", dropoff = "", date = "", time = "",
    pax = "", bags = "", vehicle = "", notes = "",
    ref = `OET-${Date.now()}`
  } = data;

  const subject = `Thanks — we received your request (ref ${ref})`;
  const ownerSubject = `New quote request ${ref} — ${pickup} → ${dropoff}`;

  const htmlCustomer = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial">
      <h2>Thanks ${escapeHtml(name)}, we’ve got your request.</h2>
      <p>Ref: <b>${ref}</b></p>
      <p>We’ll reply shortly with a fixed quote.</p>
      <hr>
      <p><b>Trip</b>: ${escapeHtml(pickup)} → ${escapeHtml(dropoff)}<br>
      <b>Date</b>: ${escapeHtml(date)} &nbsp; <b>Time</b>: ${escapeHtml(time)}<br>
      <b>Passengers</b>: ${escapeHtml(pax)} &nbsp; <b>Luggage</b>: ${escapeHtml(bags)}<br>
      <b>Vehicle</b>: ${escapeHtml(vehicle)}</p>
      <p><b>Notes</b>: ${escapeHtml(notes)}</p>
      <hr>
      <p>Oxford Executive Travel • +44 7344 145197 • bookings@oxfordexecutivetravel.co.uk</p>
    </div>`;

  const htmlOwner = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial">
      <h2>New quote request — ${escapeHtml(pickup)} → ${escapeHtml(dropoff)}</h2>
      <p>Ref: <b>${ref}</b></p>
      <p><b>Name</b>: ${escapeHtml(name)}<br>
      <b>Email</b>: ${escapeHtml(email)}<br>
      <b>Phone</b>: ${escapeHtml(phone)}</p>
      <p><b>Date</b>: ${escapeHtml(date)} &nbsp; <b>Time</b>: ${escapeHtml(time)}<br>
      <b>Passengers</b>: ${escapeHtml(pax)} &nbsp; <b>Luggage</b>: ${escapeHtml(bags)}<br>
      <b>Vehicle</b>: ${escapeHtml(vehicle)}</p>
      <p><b>Notes</b>: ${escapeHtml(notes)}</p>
    </div>`;

  const from = { email: "no-reply@oxfordexecutivetravel.co.uk", name: "Oxford Executive Travel" };

  if (email) {
    await sendMail({
      personalizations: [{ to: [{ email, name }] }],
      from, subject,
      content: [
        { type: "text/plain", value: stripHtml(htmlCustomer) },
        { type: "text/html", value: htmlCustomer }
      ],
      headers: { "Reply-To": "bookings@oxfordexecutivetravel.co.uk" }
    });
  }

  await sendMail({
    personalizations: [{
      to: [
        { email: "bookings@oxfordexecutivetravel.co.uk", name: "Bookings" },
        { email: "info@oxfordexecutivetravel.co.uk", name: "Info" }
      ]
    }],
    from, subject: ownerSubject,
    content: [
      { type: "text/plain", value: stripHtml(htmlOwner) },
      { type: "text/html", value: htmlOwner }
    ],
    headers: { "Reply-To": email || "bookings@oxfordexecutivetravel.co.uk" }
  });

  return new Response(JSON.stringify({ ok: true, ref }), {
    headers: { "content-type": "application/json", ...corsHeaders() }
  });
}

async function sendMail(payload) {
  await fetch("https://api.mailchannels.net/tx/v1/send", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
}
function corsHeaders() {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "POST,GET,OPTIONS",
    "access-control-allow-headers": "content-type"
  };
}
function stripHtml(s) { return s.replace(/<[^>]+>/g, ""); }
function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, c =>
    ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c])
  );
}
