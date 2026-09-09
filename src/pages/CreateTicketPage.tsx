import {
  useEffect,
  useState,
} from "react";

import { AppShell } from "../components/AppShell";
import { supabase } from "../lib/supabase";
import type { Profile } from "../lib/types";
import { CreateTicketForm } from "./CreateTicketForm";

type Master = {
  id: string;
  name: string;
};

export function CreateTicketPage({
  profile,
}: {
  profile: Profile;
}) {
  const [departments, setDepartments] =
    useState<Master[]>([]);
  const [categories, setCategories] =
    useState<Master[]>([]);
  const [loading, setLoading] =
    useState(true);
  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);

      const [
        departmentsResult,
        categoriesResult,
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
      ]);

      if (!active) return;

      if (
        departmentsResult.error ||
        categoriesResult.error
      ) {
        setError(
          departmentsResult.error?.message ??
            categoriesResult.error
              ?.message ??
            "Gagal mengambil master data."
        );
      }

      setDepartments(
        (departmentsResult.data ??
          []) as Master[]
      );
      setCategories(
        (categoriesResult.data ??
          []) as Master[]
      );
      setLoading(false);
    }

    void load();

    return () => {
      active = false;
    };
  }, []);

  return (
    <AppShell profile={profile}>
      <div className="topbar">
        <div>
          <h1 className="page-title">
            Create Ticket
          </h1>
          <p className="page-subtitle">
            Jelaskan masalah sejelas
            mungkin agar tim IT dapat
            merespons lebih cepat.
          </p>
        </div>
      </div>

      {error && (
        <div className="alert alert-error">
          {error}
        </div>
      )}

      {loading ? (
        <div className="card muted">
          Memuat form...
        </div>
      ) : (
        <CreateTicketForm
          profile={profile}
          departments={
            departments
          }
          categories={categories}
        />
      )}
    </AppShell>
  );
}
