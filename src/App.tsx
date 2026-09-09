import { useAuth } from "./auth/AuthContext";
import { LoadingScreen } from "./components/LoadingScreen";
import { Navigate, useRouter } from "./router/Router";

import { LoginPage } from "./pages/LoginPage";
import { AdminDashboardPage } from "./pages/AdminDashboardPage";
import { EmployeeDashboardPage } from "./pages/EmployeeDashboardPage";
import { AdminTicketsPage } from "./pages/AdminTicketsPage";
import { ReportsPage } from "./pages/ReportsPage";
import { AdminUsersPage } from "./pages/AdminUsersPage";
import { AdminSettingsPage } from "./pages/AdminSettingsPage";
import { MyTicketsPage } from "./pages/MyTicketsPage";
import { CreateTicketPage } from "./pages/CreateTicketPage";
import { TicketDetailPage } from "./pages/TicketDetailPage";

export default function App() {
  const { pathname } = useRouter();
  const { profile, loading } = useAuth();
  const isITStaff = profile?.role === "ADMIN" || profile?.role === "IT";

  if (loading) {
    return <LoadingScreen />;
  }

  if (pathname === "/login") {
    if (profile) {
      return (
        <Navigate
          to={
            isITStaff
              ? "/admin/dashboard"
              : "/dashboard"
          }
        />
      );
    }

    return <LoginPage />;
  }

  if (!profile) {
    return (
      <Navigate
        to="/login"
        replace
      />
    );
  }

  if (pathname === "/") {
    return (
      <Navigate
        to={
          isITStaff
            ? "/admin/dashboard"
            : "/dashboard"
        }
      />
    );
  }

  if (pathname === "/admin/dashboard") {
    if (!isITStaff) {
      return (
        <Navigate
          to="/dashboard"
          replace
        />
      );
    }

    return (
      <AdminDashboardPage
        profile={profile}
      />
    );
  }

  if (pathname === "/admin/tickets") {
    if (!isITStaff) {
      return (
        <Navigate
          to="/dashboard"
          replace
        />
      );
    }

    return (
      <AdminTicketsPage
        profile={profile}
      />
    );
  }

  if (pathname === "/admin/users") {
    if (profile.role !== "ADMIN") {
      return (
        <Navigate
          to="/dashboard"
          replace
        />
      );
    }

    return (
      <AdminUsersPage
        profile={profile}
      />
    );
  }

  if (pathname === "/admin/settings") {
    if (profile.role !== "ADMIN") {
      return (
        <Navigate
          to={isITStaff ? "/admin/dashboard" : "/dashboard"}
          replace
        />
      );
    }

    return (
      <AdminSettingsPage
        profile={profile}
      />
    );
  }

  if (pathname === "/admin/reports") {
    if (!isITStaff) {
      return (
        <Navigate
          to="/dashboard"
          replace
        />
      );
    }

    return (
      <ReportsPage
        profile={profile}
      />
    );
  }

  if (pathname === "/dashboard") {
    if (isITStaff) {
      return (
        <Navigate
          to="/admin/dashboard"
          replace
        />
      );
    }

    return (
      <EmployeeDashboardPage
        profile={profile}
      />
    );
  }

  if (pathname === "/tickets") {
    return (
      <MyTicketsPage
        profile={profile}
      />
    );
  }

  if (pathname === "/tickets/create") {
    return (
      <CreateTicketPage
        profile={profile}
      />
    );
  }

  const ticketMatch =
    /^\/tickets\/([^/]+)$/.exec(
      pathname
    );

  if (ticketMatch) {
    return (
      <TicketDetailPage
        profile={profile}
        ticketId={decodeURIComponent(
          ticketMatch[1]
        )}
      />
    );
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "#f5f7fb",
      }}
    >
      <div
        className="card"
        style={{
          width: "min(460px, 92vw)",
          textAlign: "center",
        }}
      >
        <h1 className="page-title">
          404
        </h1>
        <p className="muted">
          Halaman tidak ditemukan.
        </p>
      </div>
    </main>
  );
}
