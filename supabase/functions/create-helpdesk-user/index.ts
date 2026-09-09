import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const USERNAME_RE = /^[a-zA-Z0-9._-]{3,50}$/;
const VALID_ROLES = new Set(["ADMIN", "IT", "EMPLOYEE"]);

function json(
  body: Record<string, unknown>,
  status = 200
) {
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
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  if (request.method !== "POST") {
    return json({ error: "Method not allowed." }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get(
    "SUPABASE_SERVICE_ROLE_KEY"
  );
  const loginDomain =
    Deno.env.get("AUTH_LOGIN_DOMAIN") || "marriot.com";

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json(
      { error: "Konfigurasi Supabase Edge Function belum lengkap." },
      500
    );
  }

  const authorization = request.headers.get("Authorization");

  if (!authorization) {
    return json({ error: "Unauthorized." }, 401);
  }

  const callerClient = createClient(
    supabaseUrl,
    anonKey,
    {
      global: {
        headers: {
          Authorization: authorization,
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );

  const {
    data: { user: caller },
    error: callerError,
  } = await callerClient.auth.getUser();

  if (callerError || !caller) {
    return json({ error: "Unauthorized." }, 401);
  }

  const adminClient = createClient(
    supabaseUrl,
    serviceRoleKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );

  const { data: callerProfile, error: profileError } =
    await adminClient
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
    return json({ error: "Hanya ADMIN yang dapat membuat user." }, 403);
  }

  let payload: Record<string, unknown>;

  try {
    payload = await request.json();
  } catch {
    return json({ error: "Request tidak valid." }, 400);
  }

  const username = String(payload.username || "")
    .trim()
    .toLowerCase();
  const password = String(payload.password || "");
  const name = String(payload.name || "").trim();
  const role = String(payload.role || "EMPLOYEE")
    .trim()
    .toUpperCase();
  const departmentId = String(
    payload.department_id || ""
  ).trim();
  const position = String(payload.position || "").trim();
  const employeeId = String(payload.employee_id || "").trim();

  if (!USERNAME_RE.test(username)) {
    return json(
      {
        error:
          "Username harus 3-50 karakter dan hanya boleh berisi huruf, angka, titik, underscore, atau dash.",
      },
      400
    );
  }

  if (password.length < 8) {
    return json(
      { error: "Password minimal 8 karakter." },
      400
    );
  }

  if (!name) {
    return json({ error: "Nama user wajib diisi." }, 400);
  }

  if (!VALID_ROLES.has(role)) {
    return json({ error: "Role tidak valid." }, 400);
  }

  const email = `${username}@${loginDomain}`;

  const {
    data: created,
    error: createError,
  } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      name,
    },
  });

  if (createError || !created.user) {
    const message = createError?.message || "Gagal membuat akun login.";

    if (/already|registered|exists/i.test(message)) {
      return json(
        { error: "Username tersebut sudah digunakan." },
        409
      );
    }

    return json({ error: message }, 400);
  }

  const { error: updateProfileError } = await adminClient
    .from("profiles")
    .update({
      name,
      email,
      role,
      department_id: departmentId || null,
      position: position || null,
      employee_id: employeeId || null,
      is_active: true,
    })
    .eq("id", created.user.id);

  if (updateProfileError) {
    await adminClient.auth.admin.deleteUser(created.user.id);

    return json(
      {
        error:
          "Akun login sempat dibuat tetapi profile gagal disimpan. Pembuatan akun dibatalkan.",
        detail: updateProfileError.message,
      },
      500
    );
  }

  return json(
    {
      id: created.user.id,
      username,
      email,
      name,
      role,
    },
    201
  );
});
