import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const WHATSAPP_NUMBER = "971547713447";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const CALLMEBOT_API_KEY = Deno.env.get("CALLMEBOT_API_KEY");
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

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

    // Parse multipart form data
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const note = ((formData.get("note") as string) || "").trim();
    const userFullName = ((formData.get("userFullName") as string) || user.email || "").trim();
    const userCompany = ((formData.get("userCompany") as string) || "").trim();
    const userEmail = ((formData.get("userEmail") as string) || user.email || "").trim();
    const userPhone = ((formData.get("userPhone") as string) || "").trim();

    if (!file) {
      return new Response(JSON.stringify({ error: "No file provided" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Service role client — bypasses RLS, can generate signed URLs
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Build a safe, unique file path
    const timestamp = Date.now();
    const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const filePath = `excel-requests/${user.id}/${timestamp}_${safeFileName}`;

    // Upload file bytes using service role
    const fileBytes = await file.arrayBuffer();
    const { error: uploadError } = await adminClient.storage
      .from("user-requests")
      .upload(filePath, fileBytes, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });

    if (uploadError) {
      console.error("Storage upload error:", JSON.stringify(uploadError));
    }

    // Build the public URL (bucket is now public)
    // Format: {SUPABASE_URL}/storage/v1/object/public/{bucket}/{path}
    let downloadUrl = "";
    if (!uploadError) {
      const { data: publicData } = adminClient.storage
        .from("user-requests")
        .getPublicUrl(filePath);
      downloadUrl = publicData.publicUrl;
    }

    // Fallback: signed URL if public URL somehow fails
    if (!downloadUrl && !uploadError) {
      const { data: signedData } = await adminClient.storage
        .from("user-requests")
        .createSignedUrl(filePath, 60 * 60 * 24 * 30); // 30 days
      downloadUrl = signedData?.signedUrl || "";
    }

    // Save request to database
    const queryText = `File: ${file.name}${note ? ` | Note: ${note}` : ""}`;
    await userClient.from("user_requests").insert({
      user_id: user.id,
      type: "excel_request",
      query: queryText,
      file_url: filePath || null,
      status: "pending",
    });

    // Timestamp for messages
    const now = new Date().toLocaleString("en-GB", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit", timeZone: "Asia/Dubai",
    });

    // Build WhatsApp message
    const messageParts = [
      "📋 *NEW EXCEL INQUIRY*",
      `📅 ${now}`,
      "",
      `👤 *Client:* ${userFullName}`,
      `🏢 *Company:* ${userCompany || "—"}`,
      `📧 *Email:* ${userEmail}`,
      `📞 *Phone:* ${userPhone || "—"}`,
      "",
      `📎 *File:* ${file.name}`,
    ];

    if (downloadUrl) {
      messageParts.push(`🔗 *Download:* ${downloadUrl}`);
    } else {
      messageParts.push("⚠️ File upload failed — please contact client to resend");
    }

    if (note) messageParts.push(`📝 *Note:* ${note}`);
    messageParts.push("", "Please process this parts list request.");

    const message = messageParts.join("\n");

    // Send WhatsApp via CallMeBot
    let whatsappSent = false;
    let whatsappError = "";

    if (CALLMEBOT_API_KEY) {
      try {
        const encoded = encodeURIComponent(message);
        const waUrl = `https://api.callmebot.com/whatsapp.php?phone=${WHATSAPP_NUMBER}&text=${encoded}&apikey=${CALLMEBOT_API_KEY}`;
        const waRes = await fetch(waUrl);
        const waText = await waRes.text();
        whatsappSent = waRes.ok ||
          waText.toLowerCase().includes("message queued") ||
          waText.toLowerCase().includes("sent");
        if (!whatsappSent) {
          whatsappError = waText.slice(0, 300);
          console.error("CallMeBot error:", waText);
        }
      } catch (e) {
        whatsappError = String(e);
        console.error("WhatsApp fetch error:", e);
      }
    } else {
      // Log to edge function console if no API key
      console.log("=== WhatsApp message (no CALLMEBOT_API_KEY) ===\n" + message);
      whatsappSent = true;
    }

    // Email via Resend as backup
    let emailSent = false;
    if (RESEND_API_KEY) {
      const emailHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10);">
  <tr><td style="background:linear-gradient(90deg,#1a1f6e,#252d8a);padding:24px 32px;text-align:center;">
    <p style="color:#a5b4fc;margin:0 0 4px;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;">PAPCO Online Platform</p>
    <h1 style="color:#fff;margin:0;font-size:20px;">NEW EXCEL REQUEST</h1>
    <p style="color:#cbd5e1;margin:6px 0 0;font-size:13px;">${now}</p>
  </td></tr>
  <tr><td style="padding:28px 32px;">
    <table width="100%" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:20px;">
      ${[
        ["Client", userFullName],
        ["Company", userCompany || "—"],
        ["Email", userEmail],
        ["Phone", userPhone || "—"],
        ["File", file.name],
        ...(note ? [["Note", note]] : []),
      ].map(([label, value], i) => `
      <tr style="background:${i % 2 === 0 ? "#fff" : "#f9fafb"};">
        <td style="padding:10px 16px;color:#6b7280;font-size:13px;width:120px;border-bottom:1px solid #f3f4f6;">${label}</td>
        <td style="padding:10px 16px;color:#111827;font-size:13px;font-weight:600;border-bottom:1px solid #f3f4f6;">${value}</td>
      </tr>`).join("")}
    </table>
    ${downloadUrl
      ? `<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px 18px;margin-bottom:16px;">
          <p style="color:#166534;font-size:13px;font-weight:700;margin:0 0 8px;">📥 Download Excel File</p>
          <a href="${downloadUrl}" style="display:inline-block;background:#16a34a;color:#fff;text-decoration:none;font-size:13px;font-weight:600;padding:10px 20px;border-radius:6px;">Download File</a>
          <p style="color:#6b7280;font-size:11px;margin:8px 0 0;word-break:break-all;">${downloadUrl}</p>
        </div>`
      : `<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:14px 18px;margin-bottom:16px;">
          <p style="color:#dc2626;font-size:13px;margin:0;">⚠️ File upload failed. Please contact client to resend.</p>
        </div>`}
    <p style="color:#9ca3af;font-size:12px;margin:0;">WhatsApp notification also sent to +${WHATSAPP_NUMBER}</p>
  </td></tr>
  <tr><td style="background:#f8fafc;padding:14px 32px;border-top:1px solid #e5e7eb;text-align:center;">
    <p style="margin:0;color:#9ca3af;font-size:12px;">PAPCO — Public Auto Parts Co. LLC</p>
  </td></tr>
</table></td></tr></table></body></html>`;

      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
          body: JSON.stringify({
            from: "PAPCO Platform <noreply@papco-uae.com>",
            to: ["papcorasul@gmail.com"],
            subject: `[Excel Request] ${file.name} — ${userCompany || userFullName}`,
            html: emailHtml,
            text: message,
          }),
        });
        emailSent = res.ok;
      } catch (e) {
        console.error("Email error:", e);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        fileName: file.name,
        downloadUrl: downloadUrl || null,
        uploadedToStorage: !uploadError,
        whatsappSent,
        emailSent,
        whatsappError: whatsappError || undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("upload-excel-request fatal error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
