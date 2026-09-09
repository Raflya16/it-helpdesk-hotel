import {
  ArrowUpRight,
  CircleCheckBig,
  Clock3,
  Plus,
  Ticket,
} from "lucide-react";
import {
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
import type { Profile } from "../lib/types";
import { Link } from "../router/Router";

type TicketRow = {
  id: string;
  ticket_number: string;
  title: string;
  status: string;
  priority: string;
  created_at: string;
};

export function EmployeeDashboardPage({
  profile,
}: {
  profile: Profile;
}) {
  const [tickets, setTickets] =
    useState<TicketRow[]>([]);
  const [loading, setLoading] =
    useState(true);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);

      const { data, error } =
        await supabase
          .from("tickets")
          .select(
            "id,ticket_number,title,status,priority,created_at"
          )
          .eq(
            "created_by",
            profile.id
          )
          .order("created_at", {
            ascending: false,
          })
          .limit(50);

      if (!active) return;

      if (error) {
        console.error(
          "Failed to load employee tickets:",
          error
        );
        setTickets([]);
      } else {
        setTickets(
          (data ?? []) as TicketRow[]
        );
      }

      setLoading(false);
    }

    void load();

    return () => {
      active = false;
    };
  }, [profile.id]);

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

  const recentTickets =
    tickets.slice(0, 6);

  const today =
    new Intl.DateTimeFormat(
      "en-GB",
      {
        day: "2-digit",
        month: "long",
        year: "numeric",
      }
    ).format(new Date());

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
          <NotificationBell
            userId={profile.id}
          />

          <div className="dashboard-profile">
            <div className="dashboard-profile-avatar">
              {(profile.name || "U")
                .slice(0, 2)
                .toUpperCase()}
            </div>

            <div>
              <strong>
                {profile.name ||
                  "Employee"}
              </strong>
              <span>Employee</span>
            </div>
          </div>
        </div>
      </header>

      <section className="employee-help-card">
        <div>
          <span>IT SUPPORT</span>
          <h2>
            Need IT assistance?
          </h2>
          <p>
            Report a problem and attach
            photo or video evidence for
            the IT team.
          </p>
        </div>

        <Link
          to="/tickets/create"
          className="employee-create-button"
        >
          <Plus size={18} />
          Create Ticket
        </Link>
      </section>

      <section className="dashboard-summary-grid employee-summary-grid">
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
      </section>

      <section className="dashboard-panel">
        <div className="dashboard-panel-header">
          <div>
            <h2>
              My Recent Tickets
            </h2>
            <p>
              Your latest IT support
              reports
            </p>
          </div>

          <Link
            to="/tickets"
            className="dashboard-panel-link"
          >
            View all
            <ArrowUpRight
              size={15}
            />
          </Link>
        </div>

        <div className="employee-ticket-list">
          {loading ? (
            <div className="dashboard-empty">
              Memuat ticket...
            </div>
          ) : recentTickets.length ===
            0 ? (
            <div className="dashboard-empty">
              Belum ada ticket.
            </div>
          ) : (
            recentTickets.map(
              (ticket) => (
                <Link
                  to={`/tickets/${ticket.id}`}
                  className="employee-ticket-item"
                  key={ticket.id}
                >
                  <div>
                    <span className="employee-ticket-number">
                      {
                        ticket.ticket_number
                      }
                    </span>

                    <strong>
                      {ticket.title}
                    </strong>
                  </div>

                  <div className="employee-ticket-badges">
                    <PriorityBadge
                      value={
                        ticket.priority
                      }
                    />
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
