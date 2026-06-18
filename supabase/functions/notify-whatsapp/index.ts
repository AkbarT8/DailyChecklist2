import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { sendCallMeBotMessage, sendResendEmail } from "../_shared/integrationSecrets.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// WhatsApp business number to receive all notifications
const WHATSAPP_NUMBER = "971547713447";

interface NotifyPayload {
  type: "excel_request" | "pricelist_request" | "registration";
  userFullName: string;
  userCompany: string;
  userEmail: string;
  userPhone: string;
  registeredAt?: string;
  // excel_request fields
  fileName?: string;
  fileNote?: string;
  // pricelist_request fields
  brand?: string;
  note?: string;
}

function buildMessage(payload: NotifyPayload): string {
  const now = new Date().toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", timeZone: "Asia/Dubai",
  });

  if (payload.type === "registration") {
    const when = payload.registeredAt
      ? new Date(payload.registeredAt).toLocaleString("ru-RU", { timeZone: "Asia/Dubai" })
      : now;
    return [
      "Новая заявка на регистрацию!",
      `Имя: ${payload.userFullName}`,
      `Email: ${payload.userEmail}`,
      `Телефон: ${payload.userPhone || "—"}`,
      `Компания: ${payload.userCompany || "—"}`,
      `Время: ${when}`,
    ].join("\n");
  }

  if (payload.type === "excel_request") {
    return [
      "📋 *NEW EXCEL INQUIRY*",
      `📅 ${now}`,
      "",
      `👤 *Client:* ${payload.userFullName}`,
      `🏢 *Company:* ${payload.userCompany}`,
      `📧 *Email:* ${payload.userEmail}`,
      `📞 *Phone:* ${payload.userPhone}`,
      "",
      `📎 *File:* ${payload.fileName || "—"}`,
      payload.fileNote ? `📝 *Note:* ${payload.fileNote}` : "",
      "",
      "Please process this parts list request.",
    ].filter(l => l !== null).join("\n");
  }

  // pricelist_request
  return [
    "💰 *PRICE LIST REQUEST BY BRAND*",
    `📅 ${now}`,
    "",
    `👤 *Client:* ${payload.userFullName}`,
    `🏢 *Company:* ${payload.userCompany}`,
    `📧 *Email:* ${payload.userEmail}`,
    `📞 *Phone:* ${payload.userPhone}`,
    "",
    `🔖 *Brand:* ${payload.brand || "Not specified"}`,
    payload.note ? `📝 *Note:* ${payload.note}` : "",
    "",
    "Please send the price list to the client.",
  ].filter(l => l !== null).join("\n");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Authenticate caller
    const authHeader = req.headers.get("Authorization") || "";
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const payload: NotifyPayload = await req.json();
    const message = buildMessage(payload);

    const whatsapp = await sendCallMeBotMessage(adminClient, message);

    let emailSent = false;
    let emailError: string | undefined;
    if (payload.type !== "registration") {
      const emailSubject = payload.type === "excel_request"
        ? `[Excel Request] ${payload.userFullName} — ${payload.userCompany}`
        : `[Price List Request] ${payload.brand || "Brand"} — ${payload.userCompany}`;

      const emailHtml = `
<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10);">
  <tr>
    <td style="background:linear-gradient(90deg,#1a1f6e,#252d8a);padding:24px 32px;text-align:center;">
      <p style="color:#a5b4fc;margin:0 0 4px;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;">PAPCO Online Platform</p>
      <h1 style="color:#fff;margin:0;font-size:20px;">${payload.type === "excel_request" ? "NEW EXCEL REQUEST" : "PRICE LIST REQUEST"}</h1>
    </td>
  </tr>
  <tr>
    <td style="padding:28px 32px;">
      <table width="100%" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
        ${[
          ["Client", payload.userFullName],
          ["Company", payload.userCompany],
          ["Email", payload.userEmail],
          ["Phone", payload.userPhone],
          ...(payload.type === "excel_request"
            ? [["File", payload.fileName || "—"], ...(payload.fileNote ? [["Note", payload.fileNote]] : [])]
            : [["Brand", payload.brand || "Not specified"], ...(payload.note ? [["Note", payload.note]] : [])]),
        ].map(([label, value], i) => `
        <tr style="background:${i % 2 === 0 ? "#fff" : "#f9fafb"};">
          <td style="padding:10px 16px;color:#6b7280;font-size:13px;width:130px;">${label}</td>
          <td style="padding:10px 16px;color:#111827;font-size:13px;font-weight:600;">${value}</td>
        </tr>`).join("")}
      </table>
    </td>
  </tr>
</table>
</td></tr>
</table>
</body></html>`.trim();

      const email = await sendResendEmail(adminClient, {
        to: ["papcorasul@gmail.com"],
        subject: emailSubject,
        html: emailHtml,
        text: message,
      });
      emailSent = email.sent;
      emailError = email.error;
    }

    return new Response(
      JSON.stringify({
        success: true,
        whatsappSent: whatsapp.sent,
        emailSent,
        whatsappError: whatsapp.error,
        emailError,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("notify-whatsapp error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
