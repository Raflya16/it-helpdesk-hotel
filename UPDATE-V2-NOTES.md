# Hotel IT Helpdesk - Update V2

## Yang sudah diupdate

1. Notification bell untuk ADMIN dan EMPLOYEE.
2. Halaman ADMIN `Users` untuk edit profile, department, role, posisi, employee ID, dan status active/inactive.
3. SLA: `first_response_at`, `finished_at`, response time, resolution time, serta average SLA pada halaman Laporan/PDF.
4. Search ticket dashboard/admin tetap aktif dan duplicate JSX attribute pada halaman Tickets dibersihkan.
5. Activity Timeline sekarang memakai kalimat operasional, bukan label database mentah.
6. Mobile usability diperbaiki untuk form, card, detail ticket, notification dropdown, report, dan user management.
7. Gradient yang masih tersisa pada CSS login/legacy diganti warna solid sesuai desain.

## Satu langkah database

Untuk Supabase project yang sudah berjalan, jalankan:

`supabase/upgrade_helpdesk_v2.sql`

Tanpa SQL ini, aplikasi tetap bisa dibuka, tetapi Notification, SLA baru, dan edit profile admin belum berfungsi penuh.

## Vivid badge colors
- Role ADMIN: solid red
- Role EMPLOYEE: solid blue
- Account ACTIVE: solid green
- Account INACTIVE: solid gray
- Ticket WAITING: solid blue
- Ticket IN PROGRESS: solid orange
- Ticket DONE: solid green
- Priority LOW: solid gray
- Priority MEDIUM: solid blue
- Priority HIGH: solid orange
- Priority CRITICAL: solid red

## User creation
- Admin Users sekarang memiliki tombol **Tambah User**.
- Pembuatan login dilakukan melalui Supabase Edge Function `create-helpdesk-user`.
- Service-role key hanya dipakai di Edge Function, tidak pernah dikirim ke browser.
- Username tetap mengikuti mekanisme login project (`username@VITE_AUTH_LOGIN_DOMAIN`).
- Setup/deploy ada di `supabase/CREATE-USER-SETUP.md`.
