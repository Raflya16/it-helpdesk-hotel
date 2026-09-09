import {
  ChevronRight,
  FileDown,
  LayoutDashboard,
  LogOut,
  PlusCircle,
  Settings,
  Ticket,
  UsersRound,
} from "lucide-react";
import type { ReactNode } from "react";

import { useAuth } from "../auth/AuthContext";
import { Link, useRouter } from "../router/Router";
import type { Profile } from "../lib/types";

type MenuItem = {
  label: string;
  href: string;
  icon: React.ElementType;
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
  const isAdmin =
    profile.role === "ADMIN";
  const isITStaff =
    profile.role === "ADMIN" ||
    profile.role === "IT";

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

  const menu =
    isITStaff ? adminMenu : employeeMenu;

  const displayName =
    profile.name?.trim() || "User";

  const initials = displayName
    .split(/\s+/)
    .map((part) => part.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();

  function isActive(item: MenuItem) {
    if (isITStaff) {
      if (
        item.href === "/admin/dashboard"
      ) {
        return (
          pathname === "/admin/dashboard"
        );
      }

      if (
        item.href === "/admin/tickets"
      ) {
        return (
          pathname.startsWith(
            "/admin/tickets"
          ) ||
          (pathname.startsWith(
            "/tickets/"
          ) &&
            pathname !==
              "/tickets/create")
        );
      }

      if (
        item.href === "/admin/users"
      ) {
        return pathname.startsWith(
          "/admin/users"
        );
      }

      if (
        item.href === "/admin/settings"
      ) {
        return pathname.startsWith(
          "/admin/settings"
        );
      }

      if (
        item.href === "/admin/reports"
      ) {
        return pathname.startsWith(
          "/admin/reports"
        );
      }

      return false;
    }

    if (item.href === "/dashboard") {
      return pathname === "/dashboard";
    }

    if (
      item.href === "/tickets/create"
    ) {
      return (
        pathname === "/tickets/create"
      );
    }

    if (item.href === "/tickets") {
      return (
        pathname === "/tickets" ||
        (pathname.startsWith(
          "/tickets/"
        ) &&
          pathname !==
            "/tickets/create")
      );
    }

    return false;
  }

  async function handleSignOut() {
    await signOut();
    navigate("/login", {
      replace: true,
    });
  }

  return (
    <div className="helpdesk-stage">
      <div className="helpdesk-frame">
        <aside className="helpdesk-sidebar">
          <div>
            <div className="helpdesk-brand">
              <strong className="helpdesk-brand-title">
                IT Helpdesk
              </strong>
            </div>

            <nav className="helpdesk-nav">
              {menu.map((item) => {
                const Icon = item.icon;
                const active =
                  isActive(item);

                return (
                  <Link
                    to={item.href}
                    key={item.label}
                    className={`helpdesk-nav-item ${
                      active
                        ? "helpdesk-nav-active"
                        : ""
                    }`}
                  >
                    <div className="helpdesk-nav-left">
                      <Icon size={19} />
                      <span>
                        {item.label}
                      </span>
                    </div>

                    <ChevronRight
                      size={15}
                      className="helpdesk-nav-chevron"
                    />
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="helpdesk-sidebar-bottom">
            <div className="helpdesk-user">
              <div className="helpdesk-avatar">
                {initials}
              </div>

              <div className="helpdesk-user-info">
                <strong>
                  {displayName}
                </strong>
                <span>
                  {profile.role}
                </span>
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

        <main className="helpdesk-main">
          {children}
        </main>
      </div>
    </div>
  );
}
