# Setup User Management

Fitur **Tambah User** dan **Reset Password** memakai Supabase Edge Functions agar `service_role` tidak pernah dimasukkan ke React/browser.

## 1. Pastikan Supabase CLI tersedia

```bash
npm install -g supabase
supabase login
supabase link --project-ref YOUR_PROJECT_REF
```

## 2. Set login domain

Project memakai username yang diubah menjadi email internal seperti `username@marriot.com`.

```bash
supabase secrets set AUTH_LOGIN_DOMAIN=marriot.com
```

Jika domain login Anda berbeda, samakan dengan `VITE_AUTH_LOGIN_DOMAIN` pada `.env`.

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, dan `SUPABASE_SERVICE_ROLE_KEY` tersedia sebagai secret bawaan Edge Function pada project Supabase.

## 3. Deploy functions

```bash
supabase functions deploy create-helpdesk-user
supabase functions deploy reset-helpdesk-password
```

Kedua function memvalidasi JWT pemanggil dan memastikan profile pemanggil adalah `ADMIN` aktif sebelum memakai Admin Auth API.

## 4. Gunakan dari web

Buka `/admin/users`.

- **Tambah User** membuat Auth account dan profile baru.
- **Edit User** mengatur department, position, employee ID, role, dan active status.
- **Reset Password** mengganti password Auth account melalui server-side Edge Function.

Role yang didukung: `EMPLOYEE`, `IT`, dan `ADMIN`.
