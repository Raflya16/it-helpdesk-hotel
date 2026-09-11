# IT Helpdesk V6 — Safe Cancel/Duplicate + Error Handling

## 1. Hapus / Cancel Ticket tanpa hard delete

User sekarang dapat memakai tombol **Hapus Ticket** untuk ticket miliknya yang masih WAITING dan belum mendapat first response dari IT.

Yang terjadi di database bukan DELETE row. Ticket berubah menjadi `CANCELLED` agar audit trail, attachment, conversation, dan nomor ticket tetap utuh.

Alasan yang tersedia:

- Salah membuat ticket
- Masalah sudah selesai
- Ticket duplikat
- Alasan lain

Jika memilih **Ticket duplikat**, user memasukkan nomor ticket yang benar. Database menyimpan relasi `duplicate_of`.

ADMIN/IT juga dapat memakai **Cancel Ticket** untuk ticket aktif.

Ticket `CANCELLED`:

- tidak muncul di antrean ticket default ADMIN/IT;
- tidak muncul di dashboard aktif;
- tidak muncul di daftar My Tickets default;
- tetap dapat dicari melalui filter `CANCELLED`;
- tetap dapat dibuka melalui detail ticket;
- tidak dihitung sebagai SLA overdue.

## 2. Security / audit

Migration V6 menambahkan:

- `status = CANCELLED`;
- `cancelled_at`;
- `cancelled_by`;
- `cancel_reason_code`;
- `cancel_reason`;
- `duplicate_of`;
- RPC `cancel_ticket(...)`.

Reporter tidak mendapat permission UPDATE ticket secara umum. Cancel dilakukan melalui SECURITY DEFINER RPC dengan validasi server-side:

- reporter hanya dapat cancel ticket miliknya;
- reporter hanya dapat cancel sebelum IT mulai merespons;
- IT/Admin dapat cancel ticket aktif;
- ticket DONE/CANCELLED tidak dapat dicancel lagi;
- cancelled ticket tidak dapat diam-diam diaktifkan kembali melalui UPDATE biasa.

Audit event baru:

- `TICKET_CANCELLED`
- `TICKET_MARKED_DUPLICATE`

## 3. Error handling

V6 menambahkan lapisan error handling berikut:

- React `AppErrorBoundary` untuk mencegah blank page saat render crash;
- pesan error jaringan/session/permission yang lebih mudah dipahami;
- tombol **Coba Lagi** pada Ticket Detail, My Tickets, Admin Tickets, Create Ticket, dan dashboard;
- loading/disabled state pada action ticket;
- success/error feedback pada comment, update, reopen, dan cancel;
- upload evidence yang gagal tidak dibiarkan menjadi ticket aktif tanpa bukti: sistem mencoba membatalkan ticket incomplete agar IT tidak menerima laporan setengah jadi.

## 4. Migration

Jalankan setelah V5.3:

```text
supabase/upgrade_helpdesk_v6.sql
```

Urutan database untuk instalasi existing:

```text
V3 → V5 → V5.1 → V5.2 → V5.3 → V6
```

Jika menggunakan `supabase/schema.sql` untuk fresh install, perubahan V6 juga sudah ditambahkan di bagian akhir schema.

## 5. Validation

`npm run typecheck` sudah lolos tanpa error TypeScript.

Production Vite build pada environment update tidak dapat diselesaikan karena `node_modules` dari ZIP sumber membawa optional binary Rollup untuk OS lain. Jalankan `npm install` pada mesin target sebelum `npm run build`.
