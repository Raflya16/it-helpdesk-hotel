import {
  ArrowUpRight,
  CircleCheckBig,
  Clock3,
  History,
  MessageSquare,
  Paperclip,
  Search,
  Ticket,
  TriangleAlert,
  UserCheck,
} from "lucide-react";
import {
  FormEvent,
  useEffect,
  useState,
} from "react";

import { AppShell } from "../components/AppShell";
import { NotificationBell } from "../components/NotificationBell";
import {
  PriorityBadge,
  StatusBadge,
} from "../components/status-badge";
import { supabase } from "../lib/supabase";
import {
  relationName,
  type NamedRelation,
  type Profile,
} from "../lib/types";
import {
  Link,
  useRouter,
} from "../router/Router";

type TicketRow = {
  id: string;
  ticket_number: string;
  title: string;
  status: string;
  priority: string;
  created_at: string;
  department: NamedRelation;
  reporter: NamedRelation;
  assignee: NamedRelation;
};

type UpdateActor = {
  name?: string;
  role?: string;
};

type UpdateTicket = {
  id?: string;
  ticket_number?: string;
  title?: string;
};

type RecentUpdateRow = {
  id: string;
  action: string;
  old_value: string | null;
  new_value: string | null;
  description: string | null;
  created_at: string;
  actor: UpdateActor | UpdateActor[] | null;
  ticket: UpdateTicket | UpdateTicket[] | null;
};

function firstRelation<T>(
  value: T | T[] | null
): T | null {
  if (!value) return null;
  return Array.isArray(value)
    ? value[0] ?? null
    : value;
}

function displayStatus(value: string | null) {
  const status = String(value ?? "")
    .trim()
    .toUpperCase();

  if (
    status === "OPEN" ||
    status === "ASSIGNED" ||
    status === "WAITING"
  ) {
    return "WAITING";
  }
  if (status === "WAITING_USER") return "IN PROGRESS";
  if (status === "IN_PROGRESS") return "IN PROGRESS";
  if (
    status === "RESOLVED" ||
    status === "CLOSED" ||
    status === "FINISH" ||
    status === "DONE"
  ) {
    return "DONE";
  }

  return status || "-";
}

function updateDescription(update: RecentUpdateRow) {
  switch (update.action) {
    case "STATUS_CHANGED":
      return `mengubah status ${displayStatus(
        update.old_value
      )} → ${displayStatus(update.new_value)}`;

    case "ASSIGNEE_CHANGED":
      return "mengubah penugasan ticket";

    case "PRIORITY_CHANGED":
      return `mengubah prioritas ${
        update.old_value ?? "-"
      } → ${update.new_value ?? "-"}`;

    case "COMMENT_ADDED":
      return "menambahkan komentar pada ticket";

    case "ATTACHMENT_ADDED":
      return "menambahkan lampiran pada ticket";

    default:
      return update.description || "memperbarui ticket";
  }
}

function formatRelativeTime(value: string) {
  const time = new Date(value).getTime();
  const now = Date.now();
  const diffSeconds = Math.round((time - now) / 1000);
  const formatter = new Intl.RelativeTimeFormat("id-ID", {
    numeric: "auto",
  });

  if (Math.abs(diffSeconds) < 60) {
    return formatter.format(diffSeconds, "second");
  }

  const diffMinutes = Math.round(diffSeconds / 60);
  if (Math.abs(diffMinutes) < 60) {
    return formatter.format(diffMinutes, "minute");
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) {
    return formatter.format(diffHours, "hour");
  }

  const diffDays = Math.round(diffHours / 24);
  if (Math.abs(diffDays) <= 7) {
    return formatter.format(diffDays, "day");
  }

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function RecentUpdateIcon({ action }: { action: string }) {
  if (action === "COMMENT_ADDED") {
    return <MessageSquare size={17} />;
  }

  if (action === "ATTACHMENT_ADDED") {
    return <Paperclip size={17} />;
  }

  if (action === "ASSIGNEE_CHANGED") {
    return <UserCheck size={17} />;
  }

  return <History size={17} />;
}

export function AdminDashboardPage({
  profile,
}: {
  profile: Profile;
}) {
  const { navigate } = useRouter();
  const [tickets, setTickets] =
    useState<TicketRow[]>([]);
  const [loading, setLoading] =
    useState(true);
  const [search, setSearch] =
    useState("");
  const [recentUpdates, setRecentUpdates] =
    useState<RecentUpdateRow[]>([]);
  const [updatesLoading, setUpdatesLoading] =
    useState(true);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);

      const { data, error } =
        await supabase
          .from("tickets")
          .select(`
            id,
            ticket_number,
            title,
            status,
            priority,
            created_at,
            department:departments(name),
            reporter:profiles!tickets_created_by_fkey(name),
            assignee:profiles!tickets_assigned_to_fkey(name)
          `)
          .order("created_at", {
            ascending: false,
          })
          .limit(100);

      if (!active) return;

      if (error) {
        console.error(
          "Failed to load dashboard tickets:",
          error
        );
        setTickets([]);
      } else {
        setTickets(
          (data ??
            []) as unknown as TicketRow[]
        );
      }

      setLoading(false);
    }

    void load();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function loadRecentUpdates() {
      const { data, error } = await supabase
        .from("ticket_history")
        .select(`
          id,
          action,
          old_value,
          new_value,
          description,
          created_at,
          actor:profiles!ticket_history_user_id_fkey(name, role),
          ticket:tickets!ticket_history_ticket_id_fkey(id, ticket_number, title)
        `)
        .in("action", [
          "STATUS_CHANGED",
          "ASSIGNEE_CHANGED",
          "PRIORITY_CHANGED",
          "COMMENT_ADDED",
          "ATTACHMENT_ADDED",
        ])
        .order("created_at", { ascending: false })
        .limit(30);

      if (!active) return;

      if (error) {
        console.error(
          "Failed to load recent IT updates:",
          error
        );
        setRecentUpdates([]);
      } else {
        const rows = (data ?? []) as unknown as RecentUpdateRow[];

        setRecentUpdates(
          rows
            .filter((update) => {
              const actor = firstRelation(update.actor);
              return actor?.role === "ADMIN" || actor?.role === "IT";
            })
            .slice(0, 4)
        );
      }

      setUpdatesLoading(false);
    }

    void loadRecentUpdates();

    const intervalId = window.setInterval(() => {
      void loadRecentUpdates();
    }, 15000);

    const refreshOnFocus = () => {
      void loadRecentUpdates();
    };

    window.addEventListener("focus", refreshOnFocus);

    return () => {
      active = false;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refreshOnFocus);
    };
  }, []);

  const openCount =
    tickets.filter(
      (ticket) =>
        ticket.status === "OPEN" ||
        ticket.status === "ASSIGNED"
    ).length;

  const progressCount =
    tickets.filter(
      (ticket) =>
        ticket.status ===
          "IN_PROGRESS" ||
        ticket.status ===
          "WAITING_USER"
    ).length;

  const resolvedCount =
    tickets.filter(
      (ticket) =>
        ticket.status === "RESOLVED" ||
        ticket.status === "CLOSED"
    ).length;

  const criticalCount =
    tickets.filter(
      (ticket) =>
        ticket.priority === "CRITICAL"
    ).length;

  const recentTickets =
    tickets.slice(0, 6);

  const attentionTickets =
    tickets
      .filter((ticket) => {
        const finished =
          ticket.status === "RESOLVED" ||
          ticket.status === "CLOSED";

        if (finished) return false;

        return (
          ticket.priority === "CRITICAL" ||
          ticket.status ===
            "WAITING_USER" ||
          !ticket.assignee
        );
      })
      .slice(0, 4);

  const today =
    new Intl.DateTimeFormat(
      "en-GB",
      {
        day: "2-digit",
        month: "long",
        year: "numeric",
      }
    ).format(new Date());

  const initials = String(
    profile.name || "Administrator"
  )
    .trim()
    .split(/\s+/)
    .map((part) => part.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();

  function submitSearch(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    const q = search.trim();

    navigate(
      q
        ? `/admin/tickets?q=${encodeURIComponent(
            q
          )}`
        : "/admin/tickets"
    );
  }

  return (
    <AppShell profile={profile}>
      <header className="dashboard-topbar">
        <div>
          <h1>
            Dashboard Overview
          </h1>
          <p>{today}</p>
        </div>

        <div className="dashboard-topbar-right">
          <form
            onSubmit={submitSearch}
            className="dashboard-search"
          >
            <Search size={18} />
            <input
              type="search"
              placeholder="Search tickets"
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
              }
            />
          </form>

          <NotificationBell
            userId={profile.id}
          />

          <div className="dashboard-profile">
            <div className="dashboard-profile-avatar">
              {initials}
            </div>
            <div>
              <strong>
                {profile.name ||
                  "Administrator"}
              </strong>
              <span>
                Administrator
              </span>
            </div>
          </div>
        </div>
      </header>

      <section className="dashboard-summary-grid">
        <div className="dashboard-summary-card">
          <div className="dashboard-summary-icon summary-blue">
            <Ticket size={20} />
          </div>
          <div>
            <span>Waiting</span>
            <strong>
              {loading
                ? "..."
                : openCount}
            </strong>
          </div>
        </div>

        <div className="dashboard-summary-card">
          <div className="dashboard-summary-icon summary-purple">
            <Clock3 size={20} />
          </div>
          <div>
            <span>In Progress</span>
            <strong>
              {loading
                ? "..."
                : progressCount}
            </strong>
          </div>
        </div>

        <div className="dashboard-summary-card">
          <div className="dashboard-summary-icon summary-green">
            <CircleCheckBig
              size={20}
            />
          </div>
          <div>
            <span>Done</span>
            <strong>
              {loading
                ? "..."
                : resolvedCount}
            </strong>
          </div>
        </div>

        <div className="dashboard-summary-card">
          <div className="dashboard-summary-icon summary-orange">
            <TriangleAlert
              size={20}
            />
          </div>
          <div>
            <span>Critical</span>
            <strong>
              {loading
                ? "..."
                : criticalCount}
            </strong>
          </div>
        </div>
      </section>

      <section className="dashboard-content-grid">
        <div className="dashboard-panel dashboard-ticket-panel">
          <div className="dashboard-panel-header">
            <div>
              <h2>
                Recent Tickets
              </h2>
              <p>
                Latest reported IT issues
              </p>
            </div>

            <Link
              to="/admin/tickets"
              className="dashboard-panel-link"
            >
              View all
              <ArrowUpRight
                size={15}
              />
            </Link>
          </div>

          <div className="dashboard-table-wrapper">
            <table className="dashboard-table responsive-data-table">
              <thead>
                <tr>
                  <th>No</th>
                  <th>Issue</th>
                  <th>Departemen</th>
                  <th>Pelapor</th>
                  <th>
                    Ditugaskan Kepada
                  </th>
                  <th>Prioritas</th>
                  <th>Status</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="dashboard-empty"
                    >
                      Memuat ticket...
                    </td>
                  </tr>
                ) : recentTickets.length ===
                  0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="dashboard-empty"
                    >
                      Belum ada ticket.
                    </td>
                  </tr>
                ) : (
                  recentTickets.map(
                    (ticket) => (
                      <tr key={ticket.id}>
                        <td data-label="Ticket">
                          <Link
                            to={`/tickets/${ticket.id}`}
                            className="dashboard-ticket-number"
                          >
                            {
                              ticket.ticket_number
                            }
                          </Link>
                        </td>

                        <td data-label="Issue">
                          <strong className="dashboard-ticket-title">
                            {ticket.title}
                          </strong>
                        </td>

                        <td data-label="Department">
                          {relationName(
                            ticket.department
                          )}
                        </td>
                        <td data-label="Reporter">
                          {relationName(
                            ticket.reporter
                          )}
                        </td>
                        <td data-label="Assigned To">
                          {relationName(
                            ticket.assignee,
                            "Unassigned"
                          )}
                        </td>
                        <td data-label="Priority">
                          <PriorityBadge
                            value={
                              ticket.priority
                            }
                          />
                        </td>
                        <td data-label="Status">
                          <StatusBadge
                            value={
                              ticket.status
                            }
                          />
                        </td>
                      </tr>
                    )
                  )
                )}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="dashboard-panel">
          <div className="dashboard-panel-header">
            <div>
              <h2>
                Recent Updates
              </h2>
              <p>
                Latest activity from the IT team
              </p>
            </div>
          </div>

          <div className="dashboard-update-list">
            {updatesLoading ? (
              <div className="dashboard-update-empty">
                Memuat update terbaru...
              </div>
            ) : recentUpdates.length === 0 ? (
              <div className="dashboard-update-empty">
                Belum ada update dari tim IT.
              </div>
            ) : (
              recentUpdates.map((update) => {
                const actor = firstRelation(update.actor);
                const ticket = firstRelation(update.ticket);

                if (!ticket?.id) return null;

                return (
                  <Link
                    key={update.id}
                    to={`/tickets/${ticket.id}`}
                    className="dashboard-update-item"
                  >
                    <div className="dashboard-update-icon">
                      <RecentUpdateIcon action={update.action} />
                    </div>

                    <div className="dashboard-update-content">
                      <div className="dashboard-update-heading">
                        <strong>{actor?.name ?? "IT Team"}</strong>
                        <span>{formatRelativeTime(update.created_at)}</span>
                      </div>

                      <p>{updateDescription(update)}</p>

                      <span className="dashboard-update-ticket">
                        {ticket.ticket_number ?? "Ticket"}
                        {ticket.title ? ` · ${ticket.title}` : ""}
                      </span>
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </aside>
      </section>

      <section className="dashboard-panel dashboard-attention-panel">
        <div className="dashboard-panel-header">
          <div>
            <h2>
              Needs Attention
            </h2>
            <p>
              Critical, waiting, or
              unassigned tickets
            </p>
          </div>

          <Link
            to="/admin/tickets"
            className="dashboard-panel-link"
          >
            Manage tickets
            <ArrowUpRight
              size={15}
            />
          </Link>
        </div>

        <div className="dashboard-attention-grid">
          {loading ? (
            <div className="dashboard-attention-empty">
              Memuat ticket...
            </div>
          ) : attentionTickets.length ===
            0 ? (
            <div className="dashboard-attention-empty">
              Tidak ada ticket yang
              membutuhkan perhatian.
            </div>
          ) : (
            attentionTickets.map(
              (ticket) => (
                <Link
                  to={`/tickets/${ticket.id}`}
                  key={ticket.id}
                  className="dashboard-attention-card"
                >
                  <div className="dashboard-attention-top">
                    <span>
                      {
                        ticket.ticket_number
                      }
                    </span>
                    <PriorityBadge
                      value={
                        ticket.priority
                      }
                    />
                  </div>

                  <strong>
                    {ticket.title}
                  </strong>

                  <div className="dashboard-attention-meta">
                    <span>
                      {relationName(
                        ticket.department
                      )}
                    </span>
                    <StatusBadge
                      value={
                        ticket.status
                      }
                    />
                  </div>
                </Link>
              )
            )
          )}
        </div>
      </section>
    </AppShell>
  );
}
