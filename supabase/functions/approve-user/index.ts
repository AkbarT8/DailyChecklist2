import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function htmlPage(title: string, message: string, color: string, icon: string) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} — PAPCO Admin</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; background: #f1f5f9; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; }
    .card { background: #fff; border-radius: 16px; box-shadow: 0 8px 40px rgba(0,0,0,0.12); overflow: hidden; max-width: 480px; width: 100%; }
    .header { background: linear-gradient(90deg, #1a1f6e, #252d8a); padding: 28px 32px; text-align: center; }
    .header p { color: #a5b4fc; font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; margin-bottom: 4px; }
    .header h1 { color: #fff; font-size: 18px; letter-spacing: 0.04em; }
    .body { padding: 36px 32px; text-align: center; }
    .icon { font-size: 56px; margin-bottom: 20px; }
    .title { font-size: 22px; font-weight: 800; color: #111827; margin-bottom: 12px; }
    .message { font-size: 15px; color: #6b7280; line-height: 1.6; }
    .badge { display: inline-block; margin-top: 20px; padding: 6px 18px; border-radius: 999px; font-size: 13px; font-weight: 700; background: ${color}20; color: ${color}; }
    .footer { background: #f8fafc; padding: 16px 32px; border-top: 1px solid #e5e7eb; text-align: center; }
    .footer p { color: #9ca3af; font-size: 12px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <p>PAPCO Online Platform</p>
      <h1>Administrator Action</h1>
    </div>
    <div class="body">
      <div class="icon">${icon}</div>
      <div class="title">${title}</div>
      <div class="message">${message}</div>
      <div class="badge">${title}</div>
    </div>
    <div class="footer">
      <p>PAPCO — Public Auto Parts Co. LLC &nbsp;|&nbsp; papco-uae.com</p>
    </div>
  </div>
</body>
</html>`;
}

function approvedEmailHtml(fullName: string) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10);">
        <tr>
          <td style="background:linear-gradient(90deg,#16a34a,#15803d);padding:28px 32px;text-align:center;">
            <p style="color:#bbf7d0;margin:0 0 4px;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;">PAPCO Online Platform</p>
            <h1 style="color:#fff;margin:0;font-size:22px;letter-spacing:0.04em;">REGISTRATION APPROVED</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 32px;text-align:center;">
            <p style="font-size:48px;margin:0 0 20px;">✓</p>
            <h2 style="color:#111827;font-size:20px;margin:0 0 16px;">Welcome, ${fullName}!</h2>
            <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 24px;">
              Your registration has been <strong>successfully confirmed</strong> by the administrator.<br>
              You can now sign in to the PAPCO Online Platform.
            </p>
            <p style="color:#6b7280;font-size:13px;line-height:1.6;">
              Visit the platform and sign in with your registered email and password.
            </p>
          </td>
        </tr>
        <tr>
          <td style="background:#f8fafc;padding:16px 32px;border-top:1px solid #e5e7eb;text-align:center;">
            <p style="margin:0;color:#9ca3af;font-size:12px;">PAPCO — Public Auto Parts Co. LLC &nbsp;|&nbsp; papco-uae.com</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function rejectedEmailHtml(fullName: string, reason: string) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10);">
        <tr>
          <td style="background:linear-gradient(90deg,#dc2626,#b91c1c);padding:28px 32px;text-align:center;">
            <p style="color:#fecaca;margin:0 0 4px;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;">PAPCO Online Platform</p>
            <h1 style="color:#fff;margin:0;font-size:22px;letter-spacing:0.04em;">REGISTRATION DECLINED</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 32px;text-align:center;">
            <p style="font-size:48px;margin:0 0 20px;">✕</p>
            <h2 style="color:#111827;font-size:20px;margin:0 0 16px;">Dear ${fullName},</h2>
            <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 16px;">
              Unfortunately, your registration request has been <strong>declined by the administrator</strong>.
            </p>
            ${reason ? `<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:14px 20px;margin:0 0 20px;text-align:left;">
              <p style="color:#6b7280;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;margin:0 0 6px;">Reason</p>
              <p style="color:#111827;font-size:14px;margin:0;">${reason}</p>
            </div>` : ""}
            <p style="color:#6b7280;font-size:13px;line-height:1.6;">
              If you believe this is an error, please contact us at<br>
              <a href="mailto:sales@papco-uae.com" style="color:#1a1f6e;">sales@papco-uae.com</a>
            </p>
          </td>
        </tr>
        <tr>
          <td style="background:#f8fafc;padding:16px 32px;border-top:1px solid #e5e7eb;text-align:center;">
            <p style="margin:0;color:#9ca3af;font-size:12px;">PAPCO — Public Auto Parts Co. LLC &nbsp;|&nbsp; papco-uae.com</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const userId = url.searchParams.get("userId");
    const action = url.searchParams.get("action"); // 'approve' | 'reject' | 'reclaim'
    const reason = url.searchParams.get("reason") || "";

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    if (action === "reclaim") {
      const email = (url.searchParams.get("email") || "").toLowerCase().trim();
      if (!email) {
        return new Response(JSON.stringify({ success: false, error: "Missing email" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: rpcResult, error: rpcError } = await adminClient.rpc("reclaim_deleted_email", {
        p_email: email,
      });
      if (!rpcError && (rpcResult as { success?: boolean })?.success) {
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: byMarker } = await adminClient
        .from("profiles")
        .select("id")
        .like("email", "__deleted__%")
        .like("rejection_reason", `%original_email:${email}%`)
        .limit(1)
        .maybeSingle();

      let targetId = byMarker?.id as string | undefined;

      if (!targetId) {
        const { data: byAdminDeleted } = await adminClient
          .from("profiles")
          .select("id")
          .ilike("email", email)
          .like("rejection_reason", "Account deleted by administrator%")
          .limit(1)
          .maybeSingle();
        targetId = byAdminDeleted?.id as string | undefined;
      }

      if (!targetId) {
        const { data: authList } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
        const authUser = authList?.users?.find((u) => u.email?.toLowerCase() === email);
        if (authUser) {
          const { data: prof } = await adminClient
            .from("profiles")
            .select("id, email, rejection_reason")
            .eq("id", authUser.id)
            .maybeSingle();
          const removedProfile =
            !prof
            || prof.email?.startsWith("__deleted__")
            || (prof.rejection_reason ?? "").includes("Account deleted by administrator");
          if (removedProfile) {
            targetId = authUser.id;
          }
        }
      }

      if (!targetId) {
        return new Response(JSON.stringify({ success: false, error: "not_deleted" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: forceResult, error: forceError } = await adminClient.rpc("force_delete_auth_user", {
        target_user_id: targetId,
      });
      if (forceError || !(forceResult as { success?: boolean })?.success) {
        await adminClient.auth.admin.deleteUser(targetId);
      }
      await adminClient.from("profiles").delete().eq("id", targetId);

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!userId || !action || !["approve", "reject"].includes(action)) {
      return new Response(
        htmlPage("Invalid Request", "Missing or invalid parameters.", "#dc2626", "⚠️"),
        { status: 400, headers: { "Content-Type": "text/html" } }
      );
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

    // Get the user profile
    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (profileError || !profile) {
      return new Response(
        htmlPage("User Not Found", "The user account could not be found.", "#dc2626", "⚠️"),
        { status: 404, headers: { "Content-Type": "text/html" } }
      );
    }

    if (profile.registration_status === action + "d" ||
        (action === "approve" && profile.registration_status === "approved") ||
        (action === "reject" && profile.registration_status === "rejected")) {
      return new Response(
        htmlPage(
          "Already Processed",
          `This registration was already ${profile.registration_status}.`,
          "#6b7280",
          "ℹ️"
        ),
        { status: 200, headers: { "Content-Type": "text/html" } }
      );
    }

    const newStatus = action === "approve" ? "approved" : "rejected";

    // Update profile status
    await adminClient
      .from("profiles")
      .update({ registration_status: newStatus })
      .eq("id", userId);

    // Log the action
    const { data: adminProfile } = await adminClient
      .from("profiles")
      .select("id")
      .eq("is_admin", true)
      .maybeSingle();

    if (adminProfile) {
      await adminClient.from("admin_logs").insert({
        admin_id: adminProfile.id,
        action: action === "approve" ? "approve_user" : "reject_user",
        target_type: "user",
        target_id: userId,
        details: `${action === "approve" ? "Approved" : "Rejected"} via email link: ${profile.full_name} (${profile.company_name})`,
      });
    }

    // Send notification email to the user
    const userEmail = profile.email || "";
    if (RESEND_API_KEY && userEmail) {
      const emailHtml = action === "approve"
        ? approvedEmailHtml(profile.full_name)
        : rejectedEmailHtml(profile.full_name, reason);

      const emailSubject = action === "approve"
        ? "Your PAPCO registration has been approved"
        : "Your PAPCO registration request was declined";

      const emailText = action === "approve"
        ? `Dear ${profile.full_name},\n\nYour registration has been approved. You can now sign in to the PAPCO Online Platform.\n\nPAPCO — Public Auto Parts Co. LLC`
        : `Dear ${profile.full_name},\n\nYour registration request has been declined by the administrator.${reason ? `\n\nReason: ${reason}` : ""}\n\nIf you have questions, contact us at sales@papco-uae.com\n\nPAPCO — Public Auto Parts Co. LLC`;

      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: "PAPCO Platform <noreply@papco-uae.com>",
          to: [userEmail],
          subject: emailSubject,
          text: emailText,
          html: emailHtml,
        }),
      });
    }

    // Return a nice HTML confirmation page
    if (action === "approve") {
      return new Response(
        htmlPage(
          "Registration Approved",
          `<strong>${profile.full_name}</strong> from <strong>${profile.company_name}</strong> has been approved. A confirmation email has been sent to ${profile.email}.`,
          "#16a34a",
          "✅"
        ),
        { status: 200, headers: { "Content-Type": "text/html" } }
      );
    } else {
      return new Response(
        htmlPage(
          "Registration Rejected",
          `The registration for <strong>${profile.full_name}</strong> from <strong>${profile.company_name}</strong> has been declined. A notification email has been sent to ${profile.email}.`,
          "#dc2626",
          "❌"
        ),
        { status: 200, headers: { "Content-Type": "text/html" } }
      );
    }
  } catch (err) {
    console.error("Error in approve-user:", err);
    return new Response(
      htmlPage("Server Error", `An unexpected error occurred: ${String(err)}`, "#dc2626", "⚠️"),
      { status: 500, headers: { "Content-Type": "text/html" } }
    );
  }
});
