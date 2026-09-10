import {
  ChevronRight,
  FileDown,
  LayoutDashboard,
  LogOut,
  MoreHorizontal,
  PlusCircle,
  Settings,
  Ticket,
  UsersRound,
  X,
} from "lucide-react";
import { useState, type ElementType, type ReactNode } from "react";

import { useAuth } from "../auth/AuthContext";
import { Link, useRouter } from "../router/Router";
import type { Profile } from "../lib/types";

type MenuItem = {
  label: string;
  href: string;
  icon: ElementType;
};

export function AppShell({
  profile,
  children,
}: {
  profile: Profile;
  children: ReactNode;
}) {
  const { pathname, navigate } = useRouter();
  const { signOut } = useAuth();
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);

  const isAdmin = profile.role === "ADMIN";
  const isITStaff = profile.role === "ADMIN" || profile.role === "IT";

  const adminMenu: MenuItem[] = [
    {
      label: "Dashboard",
      href: "/admin/dashboard",
      icon: LayoutDashboard,
    },
    {
      label: "Tickets",
      href: "/admin/tickets",
      icon: Ticket,
    },
    ...(isAdmin
      ? [
          {
            label: "Users",
            href: "/admin/users",
            icon: UsersRound,
          },
        ]
      : []),
    {
      label: "Laporan",
      href: "/admin/reports",
      icon: FileDown,
    },
    ...(isAdmin
      ? [
          {
            label: "Settings",
            href: "/admin/settings",
            icon: Settings,
          },
        ]
      : []),
  ];

  const employeeMenu: MenuItem[] = [
    {
      label: "Dashboard",
      href: "/dashboard",
      icon: LayoutDashboard,
    },
    {
      label: "Create Ticket",
      href: "/tickets/create",
      icon: PlusCircle,
    },
    {
      label: "My Tickets",
      href: "/tickets",
      icon: Ticket,
    },
  ];

  const menu = isITStaff ? adminMenu : employeeMenu;
  const mobilePrimaryMenu = isITStaff
    ? adminMenu.filter((item) => item.href !== "/admin/settings")
    : employeeMenu;

  const displayName = profile.name?.trim() || "User";
  const initials = displayName
    .split(/\s+/)
    .map((part) => part.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();

  function isActive(item: MenuItem) {
    if (isITStaff) {
      if (item.href === "/admin/dashboard") {
        return pathname === "/admin/dashboard";
      }

      if (item.href === "/admin/tickets") {
        return (
          pathname.startsWith("/admin/tickets") ||
          (pathname.startsWith("/tickets/") && pathname !== "/tickets/create")
        );
      }

      if (item.href === "/admin/users") {
        return pathname.startsWith("/admin/users");
      }

      if (item.href === "/admin/settings") {
        return pathname.startsWith("/admin/settings");
      }

      if (item.href === "/admin/reports") {
        return pathname.startsWith("/admin/reports");
      }

      return false;
    }

    if (item.href === "/dashboard") {
      return pathname === "/dashboard";
    }

    if (item.href === "/tickets/create") {
      return pathname === "/tickets/create";
    }

    if (item.href === "/tickets") {
      return (
        pathname === "/tickets" ||
        (pathname.startsWith("/tickets/") && pathname !== "/tickets/create")
      );
    }

    return false;
  }

  async function handleSignOut() {
    setMobileMoreOpen(false);
    await signOut();
    navigate("/login", { replace: true });
  }

  return (
    <div className="helpdesk-stage">
      <div className="helpdesk-frame">
        <aside className="helpdesk-sidebar">
          <div>
            <div className="helpdesk-brand">
              <strong className="helpdesk-brand-title">IT Helpdesk</strong>
            </div>

            <nav className="helpdesk-nav">
              {menu.map((item) => {
                const Icon = item.icon;
                const active = isActive(item);

                return (
                  <Link
                    to={item.href}
                    key={item.label}
                    className={`helpdesk-nav-item ${active ? "helpdesk-nav-active" : ""}`}
                  >
                    <div className="helpdesk-nav-left">
                      <Icon size={19} />
                      <span>{item.label}</span>
                    </div>

                    <ChevronRight size={15} className="helpdesk-nav-chevron" />
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="helpdesk-sidebar-bottom">
            <div className="helpdesk-user">
              <div className="helpdesk-avatar">{initials}</div>

              <div className="helpdesk-user-info">
                <strong>{displayName}</strong>
                <span>{profile.role}</span>
              </div>
            </div>

            <button
              type="button"
              className="helpdesk-signout"
              onClick={() => {
                void handleSignOut();
              }}
            >
              <LogOut size={18} />
              <span>Sign out</span>
            </button>
          </div>
        </aside>

        <header className="helpdesk-mobile-header">
          <strong>IT Helpdesk</strong>
          <button
            type="button"
            className="helpdesk-mobile-profile-button"
            onClick={() => setMobileMoreOpen(true)}
            aria-label="Buka menu akun"
          >
            {initials}
          </button>
        </header>

        <main className="helpdesk-main">{children}</main>

        <nav className="helpdesk-mobile-nav" aria-label="Navigasi utama mobile">
          {mobilePrimaryMenu.map((item) => {
            const Icon = item.icon;
            const active = isActive(item);

            return (
              <Link
                to={item.href}
                key={item.label}
                className={`helpdesk-mobile-nav-item ${active ? "is-active" : ""}`}
                onClick={() => setMobileMoreOpen(false)}
              >
                <Icon size={20} />
                <span>{item.label === "Dashboard" ? "Home" : item.label === "Create Ticket" ? "Create" : item.label === "My Tickets" ? "Tickets" : item.label}</span>
              </Link>
            );
          })}

          <button
            type="button"
            className={`helpdesk-mobile-nav-item helpdesk-mobile-more-button ${
              mobileMoreOpen || pathname.startsWith("/admin/settings") ? "is-active" : ""
            }`}
            onClick={() => setMobileMoreOpen(true)}
          >
            <MoreHorizontal size={20} />
            <span>More</span>
          </button>
        </nav>

        {mobileMoreOpen && (
          <div
            className="helpdesk-mobile-more-backdrop"
            role="presentation"
            onClick={() => setMobileMoreOpen(false)}
          >
            <section
              className="helpdesk-mobile-more-sheet"
              role="dialog"
              aria-modal="true"
              aria-label="Menu lainnya"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="helpdesk-mobile-more-handle" />
              <div className="helpdesk-mobile-more-header">
                <div className="helpdesk-mobile-more-profile">
                  <div className="helpdesk-avatar">{initials}</div>
                  <div>
                    <strong>{displayName}</strong>
                    <span>{profile.role}</span>
                  </div>
                </div>

                <button
                  type="button"
                  className="helpdesk-mobile-sheet-close"
                  onClick={() => setMobileMoreOpen(false)}
                  aria-label="Tutup menu"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="helpdesk-mobile-more-actions">
                {isAdmin && (
                  <Link
                    to="/admin/settings"
                    className={`helpdesk-mobile-more-link ${
                      pathname.startsWith("/admin/settings") ? "is-active" : ""
                    }`}
                    onClick={() => setMobileMoreOpen(false)}
                  >
                    <Settings size={20} />
                    <div>
                      <strong>Settings</strong>
                      <span>Department, category, property, dan area</span>
                    </div>
                    <ChevronRight size={17} />
                  </Link>
                )}

                <button
                  type="button"
                  className="helpdesk-mobile-more-link helpdesk-mobile-signout"
                  onClick={() => {
                    void handleSignOut();
                  }}
                >
                  <LogOut size={20} />
                  <div>
                    <strong>Sign out</strong>
                    <span>Keluar dari akun helpdesk</span>
                  </div>
                  <ChevronRight size={17} />
                </button>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
