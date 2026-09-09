# Hotel IT Helpdesk - Update V3

## Fitur yang ditambahkan

1. **Resolution Note** wajib saat IT/Admin mengubah ticket menjadi DONE.
2. **Reopen Ticket** untuk reporter ticket dan IT/Admin, dengan alasan minimal 5 karakter dan audit event `REOPENED`.
3. **Conversation Attachment**: gambar/video dapat dikirim bersama komentar dan ditampilkan pada komentar yang sesuai.
4. **Settings > Departments / Categories** untuk ADMIN, termasuk add, edit, activate/deactivate tanpa merusak foreign key ticket lama.
5. **SLA Overdue** berbasis due timestamp di database, bukan perhitungan UI saja.
6. **Reset Password** dari halaman Users melalui Edge Function admin.
7. **Server-side pagination** pada Admin Tickets dan My Tickets.
8. **Advanced filter** Admin Tickets: search, status, priority, department, category, assignee, SLA overdue, dan tanggal pembuatan.
9. **Audit Timeline** diperluas untuk status, assignee, priority, category, department, resolution note, attachment, dan reopen.
10. **Security / RLS hardening**: master-data write ADMIN-only, employee tidak dapat mengubah authorization profile sendiri, attachment conversation divalidasi ke ticket/comment yang sama, audit table tidak dapat dimanipulasi langsung, dan penghapusan evidence di Storage dibatasi ke IT/Admin.
11. Role **IT** sekarang diperlakukan sebagai operational helpdesk staff untuk Dashboard/Tickets/Reports, sedangkan Users/Settings tetap ADMIN-only.

## SLA default

SLA disimpan di tabel `sla_policies` dan dapat diubah melalui SQL tanpa mengubah source frontend:

| Priority | First response | Resolution |
|---|---:|---:|
| CRITICAL | 15 menit | 2 jam |
| HIGH | 30 menit | 4 jam |
| MEDIUM | 2 jam | 8 jam |
| LOW | 4 jam | 24 jam |

Perhitungan menggunakan elapsed/calendar time. Jika operasional Anda hanya menghitung business hours, fungsi SLA perlu disesuaikan dengan kalender kerja.

## Upgrade database existing

Jalankan migration setelah V2:

```text
supabase/upgrade_helpdesk_v3.sql
```

Fresh install cukup memakai `supabase/schema.sql`, karena V3 sudah disertakan di bagian akhir file tersebut.

## Deploy Edge Functions

Dari root project yang sudah `supabase link`:

```bash
supabase functions deploy create-helpdesk-user
supabase functions deploy reset-helpdesk-password
```

`SUPABASE_SERVICE_ROLE_KEY` hanya digunakan di server-side Edge Function, tidak di React/browser.

## Validasi source

`npm run typecheck` harus lolos sebelum deploy. Jika folder `node_modules` berasal dari ZIP/OS lain dan Vite/Rollup gagal menemukan native optional dependency, hapus `node_modules`, lalu jalankan `npm install` kembali pada mesin deployment.
