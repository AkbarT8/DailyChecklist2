import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

const ENV_KEYS: Record<string, string> = {
  callmebot_api_key: "CALLMEBOT_API_KEY",
  resend_api_key: "RESEND_API_KEY",
};

export async function getIntegrationSecret(
  adminClient: SupabaseClient,
  key: "callmebot_api_key" | "resend_api_key",
): Promise<string | null> {
  const envName = ENV_KEYS[key];
  const fromEnv = Deno.env.get(envName);
  if (fromEnv) return fromEnv;

  try {
    const { data } = await adminClient
      .from("integration_secrets")
      .select("value")
      .eq("key", key)
      .maybeSingle();
    return data?.value || null;
  } catch {
    return null;
  }
}

export async function sendCallMeBotMessage(
  adminClient: SupabaseClient,
  message: string,
  phone = "971547713447",
): Promise<{ sent: boolean; error?: string }> {
  const apiKey = await getIntegrationSecret(adminClient, "callmebot_api_key");
  if (!apiKey) {
    return { sent: false, error: "CALLMEBOT_API_KEY not configured" };
  }

  const url =
    `https://api.callmebot.com/whatsapp.php?phone=${phone}` +
    `&text=${encodeURIComponent(message)}` +
    `&apikey=${encodeURIComponent(apiKey)}`;

  try {
    const response = await fetch(url);
    const text = await response.text();
    const sent = response.ok ||
      /message queued|sent/i.test(text);
    return sent
      ? { sent: true }
      : { sent: false, error: text.slice(0, 200) };
  } catch (err) {
    return { sent: false, error: String(err) };
  }
}

const DEFAULT_FROM = "PAPCO Platform <onboarding@resend.dev>";
const CUSTOM_FROM = "PAPCO Platform <noreply@papco-uae.com>";

async function postResendEmail(
  apiKey: string,
  payload: {
    to: string[];
    subject: string;
    text: string;
    html?: string;
    from: string;
  },
): Promise<{ ok: boolean; result: unknown }> {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from: payload.from,
      to: payload.to,
      subject: payload.subject,
      text: payload.text,
      html: payload.html,
    }),
  });
  const result = await response.json().catch(() => ({}));
  return { ok: response.ok, result };
}

export async function sendResendEmail(
  adminClient: SupabaseClient,
  payload: {
    to: string[];
    subject: string;
    text: string;
    html?: string;
    from?: string;
  },
): Promise<{ sent: boolean; error?: string }> {
  const apiKey = await getIntegrationSecret(adminClient, "resend_api_key");
  if (!apiKey) {
    return { sent: false, error: "RESEND_API_KEY not configured" };
  }

  const preferredFrom = payload.from || Deno.env.get("RESEND_FROM") || CUSTOM_FROM;
  const body = {
    to: payload.to,
    subject: payload.subject,
    text: payload.text,
    html: payload.html,
    from: preferredFrom,
  };

  try {
    let { ok, result } = await postResendEmail(apiKey, body);
    let errText = JSON.stringify(result);
    if (!ok && /domain is not verified|validation_error/i.test(errText)) {
      ({ ok, result } = await postResendEmail(apiKey, { ...body, from: DEFAULT_FROM }));
      errText = JSON.stringify(result);
    }
    if (!ok && /only send testing emails to your own email address/i.test(errText)) {
      const fallbackTo = Deno.env.get("RESEND_ACCOUNT_EMAIL") || "t8.fd88@gmail.com";
      const intended = body.to.join(", ");
      ({ ok, result } = await postResendEmail(apiKey, {
        ...body,
        from: DEFAULT_FROM,
        to: [fallbackTo],
        subject: `[For ${intended}] ${body.subject}`,
        text: `Intended recipient: ${intended}\n\n${body.text}`,
        html: body.html
          ? `<p style="color:#6b7280;font-size:13px;">Intended recipient: <strong>${intended}</strong></p>${body.html}`
          : undefined,
      }));
    }
    if (!ok) {
      return { sent: false, error: JSON.stringify(result).slice(0, 200) };
    }
    return { sent: true };
  } catch (err) {
    return { sent: false, error: String(err) };
  }
}
