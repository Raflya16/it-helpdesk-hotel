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

type AreaMaster = Master & {
  property_id: string | null;
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
  const [properties, setProperties] =
    useState<Master[]>([]);
  const [areas, setAreas] =
    useState<AreaMaster[]>([]);
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
        propertiesResult,
        areasResult,
      ] = await Promise.all([
        supabase
          .from("departments")
          .select("id,name")
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
      ]);

      if (!active) return;

      const firstError =
        departmentsResult.error ??
        categoriesResult.error ??
        propertiesResult.error ??
        areasResult.error;

      if (firstError) {
        setError(
          firstError.message.includes("hotel_properties") ||
            firstError.message.includes("hotel_areas")
            ? "Master Property/Area belum tersedia. Jalankan upgrade_helpdesk_v5.sql di Supabase terlebih dahulu."
            : firstError.message
        );
      }

      setDepartments(
        (departmentsResult.data ?? []) as Master[]
      );
      setCategories(
        (categoriesResult.data ?? []) as Master[]
      );
      setProperties(
        (propertiesResult.data ?? []) as Master[]
      );
      setAreas(
        (areasResult.data ?? []) as AreaMaster[]
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
            Jelaskan masalah dan lokasi dengan jelas agar tim IT dapat merespons lebih cepat.
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
          departments={departments}
          categories={categories}
          properties={properties}
          areas={areas}
        />
      )}
    </AppShell>
  );
}
