# Hotel IT Helpdesk — React + Vite

Project ini adalah hasil migrasi dari Next.js ke React + TypeScript biasa dengan Vite.

## Stack

- Frontend: React 19 + TypeScript
- Build tool/dev server: Vite
- Backend service: Supabase
- Database: PostgreSQL (Supabase)
- Authentication: Supabase Auth
- File storage: Supabase Storage
- PDF: pdf-lib
- Icons: lucide-react

Next.js sudah tidak digunakan.

## Yang dipertahankan

- Login username/password
- Role ADMIN dan EMPLOYEE
- Admin Dashboard
- Employee Dashboard
- Create Ticket
- Upload foto/video
- My Tickets
- Admin ticket list + filter
- Ticket detail
- Comment/conversation
- Assignment admin
- Status OPEN / IN PROGRESS / FINISH
- History ticket
- Attachment preview
- Laporan berdasarkan periode
- History problem
- Export PDF

## Menjalankan project

Buka terminal di folder project ini:

```bash
npm install
npm run dev
```

Lalu buka:

```text
http://localhost:5173
```

## Environment

File `.env` sudah dikonversi dari konfigurasi project lama:

```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
VITE_AUTH_LOGIN_DOMAIN=...
```

Jangan commit file `.env` ke repository publik.

## Database

Project masih menggunakan project Supabase/database yang sama. Tidak perlu membuat database baru.

Jika kolom `finished_at` belum pernah dibuat, jalankan:

```text
supabase/add_finished_at.sql
```

melalui Supabase SQL Editor.

## Production build

```bash
npm run build
```

Hasil production berada di:

```text
dist/
```

Untuk preview hasil build:

```bash
npm run preview
```

## Routing SPA

Project memakai History API agar URL tetap seperti:

```text
/admin/dashboard
/admin/tickets
/admin/reports
/tickets/create
/tickets/:id
```

Jika hosting static selain Vercel, web server harus diarahkan untuk fallback semua route ke `index.html`.

`vercel.json` sudah disediakan untuk deployment Vercel.

## Perubahan arsitektur

Sebelumnya:

```text
Next.js
├── React
├── App Router
├── Server Components
├── API Routes
└── Supabase
```

Sekarang:

```text
React + TypeScript
├── Custom SPA Router
├── Supabase Auth
├── Supabase PostgreSQL
├── Supabase Storage
└── pdf-lib
```

Export PDF sekarang dibuat langsung di browser admin, sehingga API Route Next.js tidak lagi dibutuhkan.


## Status UI
- Database status tetap kompatibel dengan nilai lama.
- Label UI: OPEN/ASSIGNED → WAITING (biru), IN_PROGRESS/WAITING_USER → IN PROGRESS (oranye), RESOLVED/CLOSED → DONE (hijau).

## Operational Upgrade v2

Project ini sudah dilengkapi dengan batch update operasional untuk penggunaan helpdesk hotel:

- Notification bell untuk ticket baru, balasan, assignment, dan perubahan status.
- User Management untuk mengelola profile user yang sudah ada.
- SLA: First Response, Response Time, Resolution Time.
- Search ticket admin tetap aktif dari Dashboard dan halaman Tickets.
- Activity Timeline dibuat lebih mudah dibaca.
- Mobile/responsive layout diperkuat.
- UI tetap menggunakan Roboto dan warna solid tanpa gradient.

### Wajib untuk database yang sudah pernah dibuat

Jalankan file berikut **sekali** di Supabase Dashboard > SQL Editor:

```text
supabase/upgrade_helpdesk_v2.sql
```

File tersebut menambahkan kolom SLA, tabel notifications, trigger notification, dan policy RLS yang dibutuhkan fitur baru.

### Catatan User Management

Halaman `/admin/users` mengelola profile user yang **sudah memiliki akun Auth**. Pembuatan akun login baru dan reset password tetap dilakukan dari Supabase Authentication. Ini sengaja dipisahkan agar service-role key tidak pernah ditaruh di frontend React/Vite.
