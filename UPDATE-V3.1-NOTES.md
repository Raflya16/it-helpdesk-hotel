# IT Helpdesk V3.1

## Settings master data
- Department dan Ticket Category sekarang memiliki tombol **Delete**.
- Delete hanya diperbolehkan jika record belum dipakai oleh ticket/user, untuk menjaga integritas ticket historis.
- Jika record sudah dipakai, aplikasi menampilkan jumlah referensi dan meminta admin menggunakan status **Inactive**.
- Delete meminta konfirmasi sebelum penghapusan permanen.

## Sidebar
- Urutan menu admin diubah menjadi Dashboard, Tickets, Users, Laporan, Settings.
- Settings tetap hanya tersedia untuk role ADMIN.

## Database
Tidak ada migration SQL tambahan untuk V3.1. Policy master-data V3 sudah menggunakan ADMIN-only `FOR ALL`, sehingga DELETE sudah termasuk dan foreign key tetap menjadi lapisan proteksi database.
