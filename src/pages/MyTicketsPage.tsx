import {
  FormEvent,
  useEffect,
  useState,
} from "react";

import { AppShell } from "../components/AppShell";
import { ErrorState } from "../components/ErrorState";
import { Pagination } from "../components/Pagination";
import {
  PriorityBadge,
  StatusBadge,
} from "../components/status-badge";
import { friendlyErrorMessage } from "../lib/errors";
import { supabase } from "../lib/supabase";
import {
  relationName,
  type NamedRelation,
  type Profile,
} from "../lib/types";
import { Link, useRouter } from "../router/Router";

type TicketRow = {
  id: string;
  ticket_number: string;
  title: string;
  priority: string;
  status: string;
  location: string | null;
  created_at: string;
  category: NamedRelation;
  department: NamedRelation;
};

function positiveInt(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function MyTicketsPage({ profile }: { profile: Profile }) {
  const { search, navigate } = useRouter();
  const params = new URLSearchParams(search);
  const page = positiveInt(params.get("page"), 1);
  const pageSize = Math.min(50, positiveInt(params.get("pageSize"), 15));

  const [q, setQ] = useState(params.get("q") ?? "");
  const [status, setStatus] = useState(params.get("status") ?? "");
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const current = new URLSearchParams(search);
    setQ(current.get("q") ?? "");
    setStatus(current.get("status") ?? "");
  }, [search]);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);

      const current = new URLSearchParams(search);
      const queryText = (current.get("q") ?? "").trim();
      const statusFilter = current.get("status") ?? "";
      const currentPage = positiveInt(current.get("page"), 1);
      const currentPageSize = Math.min(50, positiveInt(current.get("pageSize"), 15));
      const from = (currentPage - 1) * currentPageSize;
      const to = from + currentPageSize - 1;

      let query = supabase
        .from("tickets")
        .select(
          `
            id,
            ticket_number,
            title,
            priority,
            status,
            location,
            created_at,
            category:ticket_categories(name),
            department:departments(name)
          `,
          { count: "exact" }
        )
        .eq("created_by", profile.id)
        .order("created_at", { ascending: false });

      if (queryText) {
        const keyword = queryText.replace(/[,%()]/g, " ").trim();
        if (keyword) {
          query = query.or(
            `ticket_number.ilike.%${keyword}%,title.ilike.%${keyword}%`
          );
        }
      }

      if (statusFilter === "OPEN") {
        query = query.in("status", ["OPEN", "ASSIGNED"]);
      } else if (statusFilter === "IN_PROGRESS") {
        query = query.in("status", ["IN_PROGRESS", "WAITING_USER"]);
      } else if (statusFilter === "FINISH") {
        query = query.in("status", ["RESOLVED", "CLOSED"]);
      } else if (statusFilter === "CANCELLED") {
        query = query.eq("status", "CANCELLED");
      } else {
        // Ticket yang dihapus user tidak memenuhi antrean/list aktif.
        // Histori tetap dapat dilihat lewat filter CANCELLED.
        query = query.neq("status", "CANCELLED");
      }

      const { data, error: queryError, count } = await query.range(from, to);
      if (!active) return;

      if (queryError) {
        setError(
          friendlyErrorMessage(
            queryError,
            "Daftar ticket tidak dapat dimuat. Silakan coba lagi."
          )
        );
        setTickets([]);
        setTotal(0);
      } else {
        setTickets((data ?? []) as unknown as TicketRow[]);
        setTotal(count ?? 0);
      }
      setLoading(false);
    }

    void load();
    return () => {
      active = false;
    };
  }, [profile.id, search, reloadKey]);

  function applyFilter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = new URLSearchParams();
    if (q.trim()) next.set("q", q.trim());
    if (status) next.set("status", status);
    if (pageSize !== 15) next.set("pageSize", String(pageSize));
    const query = next.toString();
    navigate(query ? `/tickets?${query}` : "/tickets");
  }

  function navigateWith(overrides: Record<string, string | null>) {
    const next = new URLSearchParams(search);
    for (const [key, value] of Object.entries(overrides)) {
      if (!value) next.delete(key);
      else next.set(key, value);
    }
    const query = next.toString();
    navigate(query ? `/tickets?${query}` : "/tickets");
  }

  return (
    <AppShell profile={profile}>
      <div className="topbar">
        <div>
          <h1 className="page-title">My Tickets</h1>
          <p className="page-subtitle">Semua laporan IT yang Anda buat.</p>
        </div>
        <Link className="btn btn-primary" to="/tickets/create">+ Create Ticket</Link>
      </div>

      <form className="card compact-filter-card" onSubmit={applyFilter}>
        <div className="compact-filter-grid">
          <input
            className="input"
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Cari kode ticket atau title"
          />
          <select className="select" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">All Status</option>
            <option value="OPEN">WAITING</option>
            <option value="IN_PROGRESS">IN PROGRESS</option>
            <option value="FINISH">DONE</option>
            <option value="CANCELLED">CANCELLED</option>
          </select>
          <button className="btn btn-primary" type="submit">Filter</button>
          <button className="btn btn-secondary" type="button" onClick={() => navigate("/tickets")}>Reset</button>
        </div>
      </form>

      {error ? (
        <ErrorState
          title="My Tickets tidak dapat dimuat"
          message={error}
          onRetry={() => setReloadKey((value) => value + 1)}
        />
      ) : (
      <div className="card table-wrap">
        <table className="responsive-data-table my-ticket-table">
          <thead>
            <tr>
              <th>Ticket</th>
              <th>Title</th>
              <th>Department</th>
              <th>Category</th>
              <th>Priority</th>
              <th>Status</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="muted table-empty">Memuat ticket...</td></tr>
            ) : tickets.length === 0 ? (
              <tr><td colSpan={7} className="muted table-empty">Belum ada ticket.</td></tr>
            ) : (
              tickets.map((ticket) => (
                <tr key={ticket.id}>
                  <td data-label="Ticket">
                    <Link to={`/tickets/${ticket.id}`} style={{ fontWeight: 800 }}>
                      {ticket.ticket_number}
                    </Link>
                  </td>
                  <td data-label="Title">{ticket.title}</td>
                  <td data-label="Department">{relationName(ticket.department)}</td>
                  <td data-label="Category">{relationName(ticket.category)}</td>
                  <td data-label="Priority"><PriorityBadge value={ticket.priority} /></td>
                  <td data-label="Status"><StatusBadge value={ticket.status} /></td>
                  <td data-label="Created">{new Date(ticket.created_at).toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta" })}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      )}

      <Pagination
        page={page}
        pageSize={pageSize}
        total={total}
        onPageChange={(nextPage) => navigateWith({ page: nextPage <= 1 ? null : String(nextPage) })}
        onPageSizeChange={(nextSize) => navigateWith({ pageSize: nextSize === 15 ? null : String(nextSize), page: null })}
      />
    </AppShell>
  );
}
