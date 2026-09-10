import { Eye, SlidersHorizontal } from "lucide-react";
import {
  FormEvent,
  useEffect,
  useState,
} from "react";

import { AppShell } from "../components/AppShell";
import { Pagination } from "../components/Pagination";
import {
  PriorityBadge,
  SlaBadge,
  StatusBadge,
} from "../components/status-badge";
import {
  formatDateTime,
  problemSummary,
} from "../lib/format";
import { getSlaState } from "../lib/sla";
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
  description: string;
  status: string;
  priority: string;
  location: string | null;
  device_name: string | null;
  created_at: string;
  updated_at: string;
  first_response_at: string | null;
  finished_at: string | null;
  sla_response_due_at: string | null;
  sla_resolution_due_at: string | null;
  department: NamedRelation;
  category: NamedRelation;
  reporter: NamedRelation;
  assignee: NamedRelation;
};

type MasterRow = { id: string; name: string };
type AreaRow = MasterRow & { property_id: string | null };
type AssigneeRow = { id: string; name: string };

function positiveInt(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function endOfJakartaDate(value: string) {
  return `${value}T23:59:59.999+07:00`;
}

export function AdminTicketsPage({
  profile,
}: {
  profile: Profile;
}) {
  const { search, navigate } = useRouter();
  const params = new URLSearchParams(search);

  const [q, setQ] = useState(params.get("q") ?? "");
  const [status, setStatus] = useState(params.get("status") ?? "");
  const [priority, setPriority] = useState(params.get("priority") ?? "");
  const [department, setDepartment] = useState(params.get("department") ?? "");
  const [category, setCategory] = useState(params.get("category") ?? "");
  const [property, setProperty] = useState(params.get("property") ?? "");
  const [area, setArea] = useState(params.get("area") ?? "");
  const [assignee, setAssignee] = useState(params.get("assignee") ?? "");
  const [sla, setSla] = useState(params.get("sla") ?? "");
  const [dateFrom, setDateFrom] = useState(params.get("from") ?? "");
  const [dateTo, setDateTo] = useState(params.get("to") ?? "");

  const page = positiveInt(params.get("page"), 1);
  const pageSize = Math.min(100, positiveInt(params.get("pageSize"), 20));

  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [departments, setDepartments] = useState<MasterRow[]>([]);
  const [categories, setCategories] = useState<MasterRow[]>([]);
  const [properties, setProperties] = useState<MasterRow[]>([]);
  const [areas, setAreas] = useState<AreaRow[]>([]);
  const [assignees, setAssignees] = useState<AssigneeRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  useEffect(() => {
    const current = new URLSearchParams(search);
    setQ(current.get("q") ?? "");
    setStatus(current.get("status") ?? "");
    setPriority(current.get("priority") ?? "");
    setDepartment(current.get("department") ?? "");
    setCategory(current.get("category") ?? "");
    setProperty(current.get("property") ?? "");
    setArea(current.get("area") ?? "");
    setAssignee(current.get("assignee") ?? "");
    setSla(current.get("sla") ?? "");
    setDateFrom(current.get("from") ?? "");
    setDateTo(current.get("to") ?? "");
  }, [search]);

  useEffect(() => {
    let active = true;

    async function loadMasters() {
      const [
        departmentResult,
        categoryResult,
        propertyResult,
        areaResult,
        assigneeResult,
      ] = await Promise.all([
        supabase
          .from("departments")
          .select("id,name")
          .eq("is_active", true)
          .order("name"),
        supabase
          .from("ticket_categories")
          .select("id,name")
          .eq("is_active", true)
          .order("name"),
        supabase
          .from("hotel_properties")
          .select("id,name")
          .eq("is_active", true)
          .order("name"),
        supabase
          .from("hotel_areas")
          .select("id,name,property_id")
          .eq("is_active", true)
          .order("name"),
        supabase
          .from("profiles")
          .select("id,name")
          .in("role", ["IT", "ADMIN"])
          .eq("is_active", true)
          .order("name"),
      ]);

      if (!active) return;
      setDepartments((departmentResult.data ?? []) as MasterRow[]);
      setCategories((categoryResult.data ?? []) as MasterRow[]);
      setProperties((propertyResult.data ?? []) as MasterRow[]);
      setAreas((areaResult.data ?? []) as AreaRow[]);
      setAssignees((assigneeResult.data ?? []) as AssigneeRow[]);
    }

    void loadMasters();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);

      const current = new URLSearchParams(search);
      const queryText = (current.get("q") ?? "").trim();
      const statusFilter = current.get("status") ?? "";
      const priorityFilter = current.get("priority") ?? "";
      const departmentFilter = current.get("department") ?? "";
      const categoryFilter = current.get("category") ?? "";
      const propertyFilter = current.get("property") ?? "";
      const areaFilter = current.get("area") ?? "";
      const assigneeFilter = current.get("assignee") ?? "";
      const slaFilter = current.get("sla") ?? "";
      const fromFilter = current.get("from") ?? "";
      const toFilter = current.get("to") ?? "";
      const currentPage = positiveInt(current.get("page"), 1);
      const currentPageSize = Math.min(
        100,
        positiveInt(current.get("pageSize"), 20)
      );
      const from = (currentPage - 1) * currentPageSize;
      const to = from + currentPageSize - 1;

      let query = supabase
        .from("tickets")
        .select(
          `
            id,
            ticket_number,
            title,
            description,
            status,
            priority,
            location,
            device_name,
            created_at,
            updated_at,
            first_response_at,
            finished_at,
            sla_response_due_at,
            sla_resolution_due_at,
            department:departments(name),
            category:ticket_categories(name),
            reporter:profiles!tickets_created_by_fkey(name),
            assignee:profiles!tickets_assigned_to_fkey(name)
          `,
          { count: "exact" }
        )
        .order("created_at", { ascending: false });

      if (queryText) {
        const keyword = queryText.replace(/[,%()]/g, " ").trim();
        if (keyword) {
          query = query.or(
            `ticket_number.ilike.%${keyword}%,title.ilike.%${keyword}%,description.ilike.%${keyword}%,location.ilike.%${keyword}%,device_name.ilike.%${keyword}%`
          );
        }
      }

      if (statusFilter === "OPEN") {
        query = query.in("status", ["OPEN", "ASSIGNED"]);
      } else if (statusFilter === "IN_PROGRESS") {
        query = query.in("status", ["IN_PROGRESS", "WAITING_USER"]);
      } else if (statusFilter === "FINISH") {
        query = query.in("status", ["RESOLVED", "CLOSED"]);
      }

      if (priorityFilter) query = query.eq("priority", priorityFilter);
      if (departmentFilter) query = query.eq("department_id", departmentFilter);
      if (categoryFilter) query = query.eq("category_id", categoryFilter);
      if (propertyFilter) query = query.eq("property_id", propertyFilter);
      if (areaFilter) query = query.eq("area_id", areaFilter);

      if (assigneeFilter === "UNASSIGNED") {
        query = query.is("assigned_to", null);
      } else if (assigneeFilter) {
        query = query.eq("assigned_to", assigneeFilter);
      }

      const now = new Date().toISOString();
      if (slaFilter === "RESPONSE_OVERDUE") {
        query = query
          .is("first_response_at", null)
          .lt("sla_response_due_at", now)
          .not("status", "in", "(RESOLVED,CLOSED)");
      } else if (slaFilter === "RESOLUTION_OVERDUE") {
        query = query
          .is("finished_at", null)
          .lt("sla_resolution_due_at", now)
          .not("status", "in", "(RESOLVED,CLOSED)");
      }

      if (fromFilter) {
        query = query.gte("created_at", `${fromFilter}T00:00:00+07:00`);
      }
      if (toFilter) {
        query = query.lte("created_at", endOfJakartaDate(toFilter));
      }

      const { data, error: queryError, count } = await query.range(from, to);

      if (!active) return;

      if (queryError) {
        setError(queryError.message);
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
  }, [search]);

  function buildQuery(overrides: Record<string, string | null>) {
    const next = new URLSearchParams(search);
    for (const [key, value] of Object.entries(overrides)) {
      if (!value) next.delete(key);
      else next.set(key, value);
    }
    const query = next.toString();
    return query ? `/admin/tickets?${query}` : "/admin/tickets";
  }

  function applyFilter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = new URLSearchParams();

    const values: Record<string, string> = {
      q: q.trim(),
      status,
      priority,
      department,
      category,
      property,
      area,
      assignee,
      sla,
      from: dateFrom,
      to: dateTo,
      pageSize: String(pageSize),
    };

    for (const [key, value] of Object.entries(values)) {
      if (value && !(key === "pageSize" && value === "20")) {
        next.set(key, value);
      }
    }

    const query = next.toString();
    setMobileFilterOpen(false);
    navigate(query ? `/admin/tickets?${query}` : "/admin/tickets");
  }

  return (
    <AppShell profile={profile}>
      <div className="topbar">
        <div>
          <h1 className="page-title">Tickets</h1>
          <p className="page-subtitle">
            Daftar seluruh laporan masalah IT hotel dengan filter operasional dan target waktu.
          </p>
        </div>
      </div>

      <form
        className={`card advanced-filter-card ${mobileFilterOpen ? "is-mobile-open" : ""}`}
        onSubmit={applyFilter}
        style={{ marginBottom: 18 }}
      >
        <button
          type="button"
          className="btn btn-secondary mobile-filter-toggle"
          onClick={() => setMobileFilterOpen((current) => !current)}
          aria-expanded={mobileFilterOpen}
        >
          <SlidersHorizontal size={17} />
          {mobileFilterOpen ? "Tutup Filter" : "Filter Tickets"}
        </button>

        <div className="advanced-filter-body">
          <div className="advanced-filter-grid">
          <div className="advanced-filter-search">
            <label className="label" htmlFor="ticket-search">Search</label>
            <input
              id="ticket-search"
              className="input"
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder="Kode ticket, title, kendala, lokasi, device"
            />
          </div>

          <div>
            <label className="label">Status</label>
            <select className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All Status</option>
              <option value="OPEN">WAITING</option>
              <option value="IN_PROGRESS">IN PROGRESS</option>
              <option value="FINISH">DONE</option>
            </select>
          </div>

          <div>
            <label className="label">Priority</label>
            <select className="select" value={priority} onChange={(e) => setPriority(e.target.value)}>
              <option value="">All Priority</option>
              {['LOW','MEDIUM','HIGH','CRITICAL'].map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Department</label>
            <select className="select" value={department} onChange={(e) => setDepartment(e.target.value)}>
              <option value="">All Department</option>
              {departments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </div>

          <div>
            <label className="label">Category</label>
            <select className="select" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">All Category</option>
              {categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </div>

          <div>
            <label className="label">Property</label>
            <select
              className="select"
              value={property}
              onChange={(e) => {
                const nextProperty = e.target.value;
                setProperty(nextProperty);
                if (area && !areas.some((item) => item.id === area && (item.property_id === null || item.property_id === nextProperty))) {
                  setArea("");
                }
              }}
            >
              <option value="">All Property</option>
              {properties.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </div>

          <div>
            <label className="label">Area</label>
            <select className="select" value={area} onChange={(e) => setArea(e.target.value)}>
              <option value="">All Area</option>
              {areas
                .filter((item) => !property || item.property_id === null || item.property_id === property)
                .map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </div>

          <div>
            <label className="label">Assigned To</label>
            <select className="select" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
              <option value="">All Assignee</option>
              <option value="UNASSIGNED">Unassigned</option>
              {assignees.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </div>

          <div>
            <label className="label">Target Waktu</label>
            <select className="select" value={sla} onChange={(e) => setSla(e.target.value)}>
              <option value="">Semua target</option>
              <option value="RESPONSE_OVERDUE">Respons terlambat</option>
              <option value="RESOLUTION_OVERDUE">Penyelesaian terlambat</option>
            </select>
          </div>

          <div>
            <label className="label">Created From</label>
            <input className="input" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>

          <div>
            <label className="label">Created To</label>
            <input className="input" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
        </div>

          <div className="filter-action-row">
            <button className="btn btn-primary" type="submit">Apply Filter</button>
            <button className="btn btn-secondary" type="button" onClick={() => navigate("/admin/tickets")}>Reset</button>
          </div>
        </div>
      </form>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="card table-wrap">
        <table className="ticket-list-table responsive-data-table admin-ticket-table">
          <thead>
            <tr>
              <th>No</th>
              <th>Kode Ticket</th>
              <th>Category</th>
              <th>Kendala</th>
              <th>Priority</th>
              <th>Tanggal Buat</th>
              <th>Reporter</th>
              <th>Assigned To</th>
              <th>Status</th>
              <th>Target</th>
              <th className="ticket-action-heading">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={11} className="muted table-empty">Memuat ticket...</td></tr>
            ) : tickets.length === 0 ? (
              <tr><td colSpan={11} className="muted table-empty">Tidak ada ticket yang cocok.</td></tr>
            ) : (
              tickets.map((ticket, index) => (
                <tr key={ticket.id}>
                  <td className="ticket-row-number" data-label="No">{(page - 1) * pageSize + index + 1}</td>
                  <td data-label="Ticket"><span className="ticket-code">{ticket.ticket_number}</span></td>
                  <td data-label="Category"><span className="ticket-category">{relationName(ticket.category)}</span></td>
                  <td data-label="Kendala"><div className="ticket-problem" title={ticket.description}>{problemSummary(ticket.description)}</div></td>
                  <td data-label="Priority"><PriorityBadge value={ticket.priority} /></td>
                  <td data-label="Tanggal"><span className="ticket-date">{formatDateTime(ticket.created_at)}</span></td>
                  <td data-label="Reporter">{relationName(ticket.reporter)}</td>
                  <td data-label="Assigned To">{ticket.assignee ? relationName(ticket.assignee) : <span className="ticket-unassigned">Unassigned</span>}</td>
                  <td data-label="Status"><StatusBadge value={ticket.status} /></td>
                  <td data-label="Target"><SlaBadge value={getSlaState(ticket)} /></td>
                  <td data-label="Aksi">
                    <Link
                      to={`/tickets/${ticket.id}`}
                      className="ticket-view-button"
                      title="Lihat detail ticket"
                      aria-label={`Lihat ticket ${ticket.ticket_number}`}
                    >
                      <Eye size={17} />
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Pagination
        page={page}
        pageSize={pageSize}
        total={total}
        onPageChange={(nextPage) =>
          navigate(buildQuery({ page: nextPage <= 1 ? null : String(nextPage) }))
        }
        onPageSizeChange={(nextSize) =>
          navigate(buildQuery({ pageSize: nextSize === 20 ? null : String(nextSize), page: null }))
        }
      />
    </AppShell>
  );
}
