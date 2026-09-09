import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return json({ error: "Method not allowed." }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json({ error: "Konfigurasi Supabase Edge Function belum lengkap." }, 500);
  }

  const authorization = request.headers.get("Authorization");
  if (!authorization) return json({ error: "Unauthorized." }, 401);

  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const {
    data: { user: caller },
    error: callerError,
  } = await callerClient.auth.getUser();

  if (callerError || !caller) return json({ error: "Unauthorized." }, 401);

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: callerProfile, error: profileError } = await adminClient
    .from("profiles")
    .select("role,is_active")
    .eq("id", caller.id)
    .single();

  if (
    profileError ||
    !callerProfile ||
    callerProfile.role !== "ADMIN" ||
    callerProfile.is_active !== true
  ) {
    return json({ error: "Hanya ADMIN yang dapat mereset password." }, 403);
  }

  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "Request tidak valid." }, 400);
  }

  const userId = String(payload.user_id || "").trim();
  const newPassword = String(payload.new_password || "");

  if (!/^[0-9a-f-]{36}$/i.test(userId)) {
    return json({ error: "User ID tidak valid." }, 400);
  }

  if (newPassword.length < 8) {
    return json({ error: "Password baru minimal 8 karakter." }, 400);
  }

  const { data: targetProfile } = await adminClient
    .from("profiles")
    .select("id,name,is_active")
    .eq("id", userId)
    .maybeSingle();

  if (!targetProfile) {
    return json({ error: "User tidak ditemukan." }, 404);
  }

  const { error: resetError } = await adminClient.auth.admin.updateUserById(
    userId,
    { password: newPassword }
  );

  if (resetError) {
    return json({ error: resetError.message }, 400);
  }

  return json({
    success: true,
    message: `Password ${targetProfile.name || "user"} berhasil direset.`,
  });
});
