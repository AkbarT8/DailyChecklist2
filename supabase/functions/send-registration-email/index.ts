import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { sendCallMeBotMessage, sendResendEmail } from "../_shared/integrationSecrets.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface RegistrationPayload {
  userId: string;
  fullName: string;
  companyName: string;
  phone: string;
  country: string;
  city: string;
  address: string;
  email: string;
  registeredAt: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const payload: RegistrationPayload = await req.json();
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const baseUrl = `${SUPABASE_URL}/functions/v1/approve-user`;
    const approveUrl = `${baseUrl}?userId=${payload.userId}&action=approve`;
    const rejectUrl = `${baseUrl}?userId=${payload.userId}&action=reject`;

    const formattedDate = new Date(payload.registeredAt).toLocaleString("en-GB", {
      day: "2-digit", month: "long", year: "numeric",
      hour: "2-digit", minute: "2-digit", timeZone: "Asia/Dubai",
    });

    const htmlBody = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10);">
        <tr>
          <td style="background:linear-gradient(90deg,#1a1f6e,#252d8a);padding:28px 32px;text-align:center;">
            <p style="color:#a5b4fc;margin:0 0 4px;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;">PAPCO Online Platform</p>
            <h1 style="color:#fff;margin:0;font-size:22px;letter-spacing:0.04em;">NEW REGISTRATION REQUEST</h1>
            <p style="color:#cbd5e1;margin:8px 0 0;font-size:13px;">${formattedDate}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <p style="color:#374151;font-size:15px;margin:0 0 24px;line-height:1.6;">
              A new client has submitted a registration request and is awaiting your approval.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:28px;">
              <tr style="background:#f8fafc;">
                <td colspan="2" style="padding:12px 16px;font-size:11px;color:#6b7280;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;border-bottom:1px solid #e5e7eb;">CLIENT INFORMATION</td>
              </tr>
              ${[
                ["Full Name", payload.fullName],
                ["Company", payload.companyName],
                ["Phone", payload.phone],
                ["Country", payload.country],
                ["City", payload.city],
                ["Address", payload.address],
                ["Email", payload.email],
              ].map(([label, value], i) => `
              <tr style="background:${i % 2 === 0 ? "#fff" : "#f9fafb"};">
                <td style="padding:10px 16px;color:#6b7280;font-size:13px;width:140px;border-bottom:1px solid #f3f4f6;">${label}</td>
                <td style="padding:10px 16px;color:#111827;font-size:13px;font-weight:600;border-bottom:1px solid #f3f4f6;">${value}</td>
              </tr>`).join("")}
            </table>
            <p style="color:#374151;font-size:14px;margin:0 0 16px;font-weight:600;">Take Action:</p>
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding-right:12px;">
                  <a href="${approveUrl}" style="display:inline-block;background:#16a34a;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:700;">✓ Approve Registration</a>
                </td>
                <td>
                  <a href="${rejectUrl}" style="display:inline-block;background:#dc2626;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:700;">✕ Reject Registration</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="background:#f8fafc;padding:16px 32px;border-top:1px solid #e5e7eb;text-align:center;">
            <p style="margin:0;color:#9ca3af;font-size:12px;">PAPCO — Public Auto Parts Co. LLC</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`.trim();

    const textBody = `
New Registration Request — PAPCO Online Platform
Date: ${formattedDate}

Full Name: ${payload.fullName}
Company: ${payload.companyName}
Phone: ${payload.phone}
Country: ${payload.country}
City: ${payload.city}
Address: ${payload.address}
Email: ${payload.email}

APPROVE: ${approveUrl}
REJECT: ${rejectUrl}
    `.trim();

    const { data: adminProfile } = await adminClient
      .from("profiles")
      .select("id")
      .eq("is_admin", true)
      .maybeSingle();

    if (adminProfile) {
      await adminClient.from("admin_logs").insert({
        admin_id: adminProfile.id,
        action: "registration_received",
        target_type: "user",
        target_id: payload.userId,
        details: `New registration: ${payload.fullName} (${payload.companyName})`,
      });
    }

    const waText = [
      "Новая заявка на регистрацию!",
      `Имя: ${payload.fullName}`,
      `Email: ${payload.email}`,
      `Телефон: ${payload.phone || "—"}`,
      `Время: ${formattedDate}`,
    ].join("\n");

    const whatsapp = await sendCallMeBotMessage(adminClient, waText);
    const email = await sendResendEmail(adminClient, {
      to: ["papcorasul@gmail.com"],
      subject: `[Action Required] New Registration: ${payload.fullName} — ${payload.companyName}`,
      text: textBody,
      html: htmlBody,
    });

    if (!whatsapp.sent) console.warn("Registration WhatsApp failed:", whatsapp.error);
    if (!email.sent) console.warn("Registration email failed:", email.error);

    return new Response(JSON.stringify({
      success: true,
      whatsappSent: whatsapp.sent,
      emailSent: email.sent,
      whatsappError: whatsapp.error,
      emailError: email.error,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error in send-registration-email:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
