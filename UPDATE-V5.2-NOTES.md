# IT Helpdesk V5.2 — Flexible Property & Area

## Perubahan utama

Model lokasi disederhanakan agar tidak terlalu spesifik terhadap hotel/property.

- **Property tetap opsional** pada Create Ticket.
- **Area selalu menampilkan seluruh area aktif**, baik Property dipilih maupun tidak.
- Area tidak lagi dibatasi berdasarkan Four Points atau Fairfield.
- Master **Area di Settings menjadi global** dan tidak meminta pilihan Property saat Add/Edit.
- Area dengan nama yang sama dari migration lama otomatis digabung menjadi satu master Area tanpa memutus referensi ticket lama.
- Property tetap berguna sebagai konteks tambahan bila reporter memang perlu membedakan Four Points dan Fairfield.

Contoh yang sekarang valid:

- Property: Tidak ditentukan → Area: Front Office
- Property: Tidak ditentukan → Area: Guest Room
- Property: Tidak ditentukan → Area: Ballroom / Meeting Room
- Property: Four Points → Area: Ballroom / Meeting Room
- Property: Fairfield → Area: Front Office

Dengan model ini tim IT tidak dipaksa memilih struktur lokasi yang terlalu kaku. Admin tetap dapat menambah Area baru lewat Settings kapan saja.

## Database

Jalankan `supabase/upgrade_helpdesk_v5_2.sql` **setelah V5.1**.

Urutan instalasi existing:

1. `upgrade_helpdesk_v3.sql`
2. `upgrade_helpdesk_v5.sql`
3. `upgrade_helpdesk_v5_1.sql`
4. `upgrade_helpdesk_v5_2.sql`

Jika V5, V5.1 sudah pernah dijalankan, cukup jalankan V5.2.
