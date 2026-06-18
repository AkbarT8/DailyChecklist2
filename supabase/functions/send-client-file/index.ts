import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function safePath(filename: string): string {
  const base = filename.replace(/[/\\]/g, "_").replace(/\s+/g, "_");
  return `sent/${Date.now()}_${base}`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization") || "";
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

    const { data: profile } = await db
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile?.is_admin) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const userId = String(formData.get("user_id") ?? "");
    const requestId = String(formData.get("request_id") ?? "") || null;

    if (!file || !userId) {
      return new Response(JSON.stringify({ error: "file and user_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const path = safePath(file.name);

    const { error: uploadErr } = await db.storage
      .from("admin-files")
      .upload(path, file, {
        upsert: false,
        contentType: file.type || "application/octet-stream",
      });

    if (uploadErr) {
      return new Response(JSON.stringify({ error: uploadErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: verify } = await db.storage.from("admin-files").download(path);
    if (!verify) {
      await db.storage.from("admin-files").remove([path]);
      return new Response(JSON.stringify({ error: "Upload verification failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let linkedRequestId = requestId;
    if (!linkedRequestId) {
      const { data: reqRow } = await db
        .from("user_requests")
        .insert({
          user_id: userId,
          type: "admin_file",
          query: file.name,
          status: "processed",
        })
        .select("id")
        .single();
      linkedRequestId = reqRow?.id ?? null;
    }

    const { data: inserted, error: dbErr } = await db
      .from("file_attachments")
      .insert({
        user_id: userId,
        request_id: linkedRequestId,
        filename: file.name,
        file_path: path,
        file_size: file.size,
        mime_type: file.type || "application/octet-stream",
      })
      .select("id, filename, file_path")
      .single();

    if (dbErr) {
      await db.storage.from("admin-files").remove([path]);
      return new Response(JSON.stringify({ error: dbErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (requestId) {
      await db.from("user_requests").update({ status: "processed" }).eq("id", requestId);
    }

    return new Response(
      JSON.stringify({ success: true, id: inserted?.id, file_path: path, filename: file.name }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
