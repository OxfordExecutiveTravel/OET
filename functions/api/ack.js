// functions/api/ack.js
// Auto-acknowledgement to the customer + staff copy via MailChannels (Cloudflare Pages/Workers)

export const onRequestPost = async (ctx) => {
  try {
    // Read JSON payload sent from the booking form
    const raw = await ctx.request.text();
    let data = {};
    try { data = JSON.parse(raw || "{}"); } catch (_) {}

    const s = (v) => (v ?? "").toString().trim();

    const name    = s(data.name) || "Customer";
    const email   = s(data.email);           // customer's address (may be empty)
    const phone   = s(data.phone);
    const pickup  = s(data.pickup);
    const dropoff = s(data.dropoff);
    const date    = s(data.date);
    const time    = s(data.time);
    const pax     = s(data.pax);
    const bags    = s(data.bags);
    const vehicle = s(data.vehicle);
    const notes   = s(data.notes);
    const ref     = s(data.ref) || makeRef();

    // --- EDIT THIS: where you want a guaranteed copy of every request
    const OWNER_COPY = "yourgmail@gmail.com";

    // From/reply-to must be in your domain for SPF alignment
    const FROM_EMAIL = "no-reply@oxfordexecutivetravel.co.uk";
    const FROM_NAME  = "Oxford Executive Travel";
    const REPLY_TO   = "bookings@oxfordexecutivetravel.co.uk";

    // --- Customer acknowledgement (only if they entered an email)
    let ackSent = false;
    if (email) {
      const subject = `Thanks — quote request received (${ref})`;
      const textBody =
`Hello ${name},

Thanks for your request. Your reference: ${ref}.
We’ll review the details and reply with a fixed quote shortly.

Summary
- Pickup:   ${pickup}
- Drop-off: ${dropoff}
- Date:     ${date} ${time}
- Passengers: ${pax}   Luggage: ${bags}
- Vehicle:  ${vehicle}
- Notes:    ${notes || "-"}

If anything changes, just reply to this email or WhatsApp +44 7344 145197.

Oxford Executive Travel
Licensed • Insured • DBS checked
https://oxfordexecutivetravel.co.uk/`;

      const payload = {
        personalizations: [{
          to: [{ email, name }],
          bcc: [{ email:oxfordexecutivetravel1283@gmail.com }] // you get a copy of the ack as well
        }],
        from:     { email: FROM_EMAIL, name: FROM_NAME },
        reply_to: { email: REPLY_TO,   name: FROM_NAME },
        subject,
        content: [{ type: "text/plain", value: textBody }]
      };

      const r1 = await fetch("https://api.mailchannels.net/tx/v1/send", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });
      ackSent = r1.ok;
    }

    // --- Staff notification (always)
    const staffSubject = `New quote ${ref} — ${pickup} → ${dropoff}`;
    const staffBody =
`Ref: ${ref}
Name: ${name}
Email: ${email || "-"}
Phone: ${phone || "-"}

Pickup:   ${pickup}
Drop-off: ${dropoff}
Date:     ${date} ${time}
Passengers: ${pax}   Luggage: ${bags}
Vehicle:  ${vehicle}
Notes:    ${notes || "-"}

UA: ${ctx.request.headers.get("user-agent") || "-"}`;

    const staffPayload = {
      personalizations: [{
        to: [{ email: "bookings@oxfordexecutivetravel.co.uk", name: "Bookings" }],
        bcc: [{ email: OWNER_COPY }] // extra safety
      }],
      from:     { email: FROM_EMAIL, name: FROM_NAME },
      reply_to: { email: email || REPLY_TO, name: name || "Customer" },
      subject:  staffSubject,
      content: [{ type: "text/plain", value: staffBody }]
    };

    await fetch("https://api.mailchannels.net/tx/v1/send", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(staffPayload)
    });

    return new Response(JSON.stringify({ ok: true, ref, ackSent }), {
      headers: { "content-type": "application/json" }
    });

  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err?.message || err) }), {
      status: 500,
      headers: { "content-type": "application/json" }
    });
  }
};

function makeRef(){
  const d = new Date(), p = (n)=>String(n).padStart(2,"0");
  return `OET-${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}-${Math.floor(1000+Math.random()*9000)}`;
}
