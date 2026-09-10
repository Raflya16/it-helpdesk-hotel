# IT Helpdesk V4 - Responsive Mobile Update

## Fokus update
Versi ini memperbaiki masalah layout mobile yang sebelumnya masih memakai pola desktop dan menyebabkan menu seperti Laporan terpotong / tidak dapat diakses.

## Perubahan utama

### 1. Mobile navigation baru
- Sidebar desktop tetap dipakai pada desktop/tablet besar.
- Pada layar <= 780px, sidebar desktop disembunyikan.
- Ditambahkan top mobile header yang ringkas.
- Ditambahkan bottom navigation yang selalu terlihat.
- ADMIN: Home, Tickets, Users, Laporan, More.
- IT: Home, Tickets, Laporan, More.
- EMPLOYEE: Home, Create, Tickets, More.
- Settings milik ADMIN berada di menu More.
- More menggunakan bottom sheet, bukan menu horizontal yang bisa terpotong.

### 2. Dashboard mobile
- Summary Waiting / In Progress / Done / Critical menjadi grid 2x2.
- Search desktop disembunyikan pada mobile agar header tidak sesak.
- Notification tetap dapat diakses.
- Recent Tickets berubah dari tabel lebar menjadi card-style data list pada mobile.
- Recent Updates dan Needs Attention menyesuaikan satu kolom.

### 3. Ticket list mobile
- Tabel ticket ADMIN berubah menjadi card per ticket pada mobile.
- Tidak ada lagi kebutuhan horizontal scroll untuk membaca kolom ticket.
- Advanced filter memiliki tombol buka/tutup pada mobile agar tidak langsung memenuhi layar.
- Pagination disusun ulang untuk layar kecil.

### 4. My Tickets mobile
- Daftar ticket employee berubah menjadi card-style list pada mobile.
- Filter menjadi satu kolom.

### 5. Users mobile
- Daftar user berubah dari tabel lebar menjadi card-style list.
- Search dan role filter menjadi satu kolom.
- Modal Add/Edit User menjadi bottom-sheet style dan bisa discroll.
- Tombol action tetap memiliki touch target yang cukup besar.

### 6. Reports mobile
- Metric cards responsif.
- History Problem berubah menjadi card-style list pada mobile.
- Form periode laporan menjadi satu kolom.

### 7. Settings mobile
- Department dan Categories memakai tab mobile agar halaman tidak terlalu panjang.
- Hanya satu master-data section ditampilkan pada satu waktu di HP.
- Row master data menjadi compact mobile card.
- Modal Add/Edit/Delete muncul dari bawah dan tetap nyaman pada layar kecil.

### 8. Ticket detail / create ticket
- Grid dua kolom menjadi satu kolom pada mobile.
- Conversation dan attachment tidak melebar keluar viewport.
- Form action dan upload dibuat vertical bila ruang tidak cukup.
- Key/value ticket information menjadi satu kolom agar value panjang tidak terpotong.

## Breakpoint utama
- Mobile: <= 780px
- Small mobile: <= 520px
- Desktop: layout sidebar tetap seperti sebelumnya.

## Validasi
- `npm run typecheck` lulus tanpa error TypeScript.
- Production Vite build di environment update masih terhalang native Rollup binary dari `node_modules` ZIP asal (Windows dependency). Jalankan `npm install` ulang di mesin deployment/lokal sebelum `npm run build`.

## Deployment
Tidak ada SQL migration baru untuk update responsive ini.

Jika source ini menggantikan project yang sudah berjalan:
1. Pertahankan `.env` milik project Anda.
2. Hapus `node_modules` lama bila perlu.
3. Jalankan `npm install`.
4. Jalankan `npm run typecheck`.
5. Jalankan `npm run build`.
6. Commit dan push ke GitHub.
7. Vercel akan redeploy dari branch production.
