# Next.js Removal Summary

Komponen Next.js yang dihapus dari hasil migrasi:

- `next`
- `eslint-config-next`
- `@supabase/ssr`
- folder `app/`
- folder `.next/`
- `next-env.d.ts`
- `next/link`
- `next/navigation`
- `next/font`
- `next/server`
- Next.js App Router
- Next.js API Route
- Next.js middleware/proxy

Pengganti:

- Routing: router SPA ringan berbasis History API (`src/router/Router.tsx`)
- Navigasi: komponen `Link` internal
- Auth session: Supabase browser client
- Data loading: React hooks + Supabase
- PDF report: `pdf-lib` di browser
- Build/dev server: Vite

TypeScript source telah dicek dengan `tsc --noEmit` setelah migrasi.


## Dashboard Recent Updates

Panel Quick Actions pada dashboard admin diubah menjadi Recent Updates. Data diambil dari `ticket_history`, difilter untuk aktivitas actor role `ADMIN`/`IT`, dan diperbarui otomatis setiap 15 detik serta saat window kembali fokus. Tidak memerlukan tabel baru karena `ticket_history` sudah ada pada `supabase/schema.sql`.


## Status UI
- Database status tetap kompatibel dengan nilai lama.
- Label UI: OPEN/ASSIGNED → WAITING (biru), IN_PROGRESS/WAITING_USER → IN PROGRESS (oranye), RESOLVED/CLOSED → DONE (hijau).

## V5.2 — Flexible Property & Area
Run `supabase/upgrade_helpdesk_v5_2.sql` after V5.1. Property remains optional and Area becomes a global master independent from Property.
