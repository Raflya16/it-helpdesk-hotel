import {
  ChevronLeft,
  ChevronRight,
  Pencil,
  Plus,
  Search,
  Trash2,
  TriangleAlert,
  X,
} from "lucide-react";
import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

import { AppShell } from "../components/AppShell";
import { supabase } from "../lib/supabase";
import type { Profile } from "../lib/types";

type MasterRow = {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
};

type AreaRow = MasterRow & {
  property_id: string | null;
};

type MasterTable = "departments" | "ticket_categories" | "hotel_properties";

const PAGE_SIZE = 7;

function EditorModal({
  itemLabel,
  row,
  open,
  saving,
  onClose,
  onSave,
}: {
  itemLabel: string;
  row: MasterRow | null;
  open: boolean;
  saving: boolean;
  onClose: () => void;
  onSave: (values: { name: string; description: string; isActive: boolean }) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (!open) return;
    setName(row?.name ?? "");
    setDescription(row?.description ?? "");
    setIsActive(row?.is_active ?? true);
  }, [open, row]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, saving, onClose]);

  if (!open) return null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) return;
    await onSave({
      name: name.trim(),
      description: description.trim(),
      isActive,
    });
  }

  return (
    <div className="settings-modal-backdrop" role="presentation" onMouseDown={() => !saving && onClose()}>
      <div
        className="settings-modal settings-editor-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-editor-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="settings-modal-header">
          <div>
            <span className="settings-modal-eyebrow">Master data</span>
            <h3 id="settings-editor-title">{row ? `Edit ${itemLabel}` : `Tambah ${itemLabel}`}</h3>
          </div>
          <button type="button" className="settings-icon-button" onClick={onClose} disabled={saving} aria-label="Tutup">
            <X size={18} />
          </button>
        </div>

        <form className="settings-modal-form" onSubmit={(event) => void submit(event)}>
          <label className="settings-field">
            <span>Nama {itemLabel}</span>
            <input
              className="input"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={`Masukkan nama ${itemLabel.toLowerCase()}`}
              autoFocus
              required
            />
          </label>

          <label className="settings-field">
            <span>Description <em>optional</em></span>
            <textarea
              className="textarea settings-description-input"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Tambahkan keterangan singkat jika diperlukan"
            />
          </label>

          <label className="settings-switch-line">
            <div>
              <strong>Status</strong>
              <span>Data aktif tersedia pada ticket baru.</span>
            </div>
            <button
              type="button"
              className={`settings-switch ${isActive ? "is-active" : ""}`}
              onClick={() => setIsActive((current) => !current)}
              aria-pressed={isActive}
            >
              <span />
            </button>
          </label>

          <div className="settings-modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>Batal</button>
            <button type="submit" className="btn btn-primary" disabled={saving || !name.trim()}>
              {saving ? "Menyimpan..." : row ? "Simpan perubahan" : `Tambah ${itemLabel}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AreaEditorModal({
  row,
  open,
  saving,
  onClose,
  onSave,
}: {
  row: AreaRow | null;
  open: boolean;
  saving: boolean;
  onClose: () => void;
  onSave: (values: { name: string; description: string; isActive: boolean }) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (!open) return;
    setName(row?.name ?? "");
    setDescription(row?.description ?? "");
    setIsActive(row?.is_active ?? true);
  }, [open, row]);

  if (!open) return null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) return;
    await onSave({
      name: name.trim(),
      description: description.trim(),
      isActive,
    });
  }

  return (
    <div className="settings-modal-backdrop" role="presentation" onMouseDown={() => !saving && onClose()}>
      <div className="settings-modal settings-editor-modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
        <div className="settings-modal-header">
          <div>
            <span className="settings-modal-eyebrow">Location master</span>
            <h3>{row ? "Edit Area" : "Tambah Area"}</h3>
          </div>
          <button type="button" className="settings-icon-button" onClick={onClose} disabled={saving} aria-label="Tutup">
            <X size={18} />
          </button>
        </div>

        <form className="settings-modal-form" onSubmit={(event) => void submit(event)}>
          <label className="settings-field">
            <span>Nama Area</span>
            <input className="input" value={name} onChange={(event) => setName(event.target.value)} placeholder="Contoh: Ballroom / Meeting Room" required />
          </label>

          <label className="settings-field">
            <span>Description <em>optional</em></span>
            <textarea className="textarea settings-description-input" value={description} onChange={(event) => setDescription(event.target.value)} />
          </label>

          <label className="settings-switch-line">
            <div>
              <strong>Status</strong>
              <span>Area aktif tersedia pada form ticket.</span>
            </div>
            <button type="button" className={`settings-switch ${isActive ? "is-active" : ""}`} onClick={() => setIsActive((current) => !current)} aria-pressed={isActive}>
              <span />
            </button>
          </label>

          <div className="settings-modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>Batal</button>
            <button type="submit" className="btn btn-primary" disabled={saving || !name.trim()}>
              {saving ? "Menyimpan..." : row ? "Simpan perubahan" : "Tambah Area"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DeleteModal({
  itemLabel,
  row,
  deleting,
  blockingMessage,
  onClose,
  onConfirm,
}: {
  itemLabel: string;
  row: MasterRow | AreaRow | null;
  deleting: boolean;
  blockingMessage: string | null;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  if (!row) return null;

  return (
    <div className="settings-modal-backdrop" role="presentation" onMouseDown={() => !deleting && onClose()}>
      <div className="settings-modal settings-delete-modal" role="alertdialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
        <div className={`settings-delete-icon ${blockingMessage ? "is-blocked" : ""}`}>
          <TriangleAlert size={24} />
        </div>
        <h3>{blockingMessage ? `${itemLabel} tidak dapat dihapus` : `Hapus ${itemLabel}?`}</h3>
        <p className="settings-delete-copy">
          {blockingMessage ? blockingMessage : <><strong>“{row.name}”</strong> akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.</>}
        </p>
        <div className="settings-modal-actions settings-delete-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={deleting}>{blockingMessage ? "Tutup" : "Batal"}</button>
          {!blockingMessage && (
            <button type="button" className="btn settings-confirm-delete" onClick={() => void onConfirm()} disabled={deleting}>
              <Trash2 size={16} />
              {deleting ? "Menghapus..." : "Hapus permanen"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function MasterSection({
  title,
  singular,
  description,
  table,
}: {
  title: string;
  singular: string;
  description: string;
  table: MasterTable;
}) {
  const [rows, setRows] = useState<MasterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<MasterRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MasterRow | null>(null);
  const [deleteBlockingMessage, setDeleteBlockingMessage] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const { data, error: loadError } = await supabase
      .from(table)
      .select("id,name,description,is_active")
      .order("is_active", { ascending: false })
      .order("name");

    if (loadError) {
      setError(loadError.message);
      setRows([]);
    } else {
      setRows((data ?? []) as MasterRow[]);
    }
    setLoading(false);
  }

  useEffect(() => { void load(); }, [table]);

  const filteredRows = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return keyword
      ? rows.filter((row) => `${row.name} ${row.description ?? ""}`.toLowerCase().includes(keyword))
      : rows;
  }, [rows, search]);

  const activeCount = rows.filter((row) => row.is_active).length;
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filteredRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const rangeStart = filteredRows.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(safePage * PAGE_SIZE, filteredRows.length);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  async function saveEditor(values: { name: string; description: string; isActive: boolean }) {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const payload = { name: values.name, description: values.description || null, is_active: values.isActive };
      const result = editingRow
        ? await supabase.from(table).update(payload).eq("id", editingRow.id)
        : await supabase.from(table).insert(payload);
      if (result.error) throw result.error;
      setEditorOpen(false);
      setEditingRow(null);
      setSuccess(`${values.name} berhasil ${editingRow ? "diperbarui" : "ditambahkan"}.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Data gagal disimpan.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(row: MasterRow) {
    setTogglingId(row.id);
    setError(null);
    const nextActive = !row.is_active;
    const { error: updateError } = await supabase.from(table).update({ is_active: nextActive }).eq("id", row.id);
    if (updateError) setError(updateError.message);
    else {
      setRows((current) => current.map((item) => item.id === row.id ? { ...item, is_active: nextActive } : item));
      setSuccess(`${row.name} ${nextActive ? "diaktifkan" : "dinonaktifkan"}.`);
    }
    setTogglingId(null);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const row = deleteTarget;
    setDeletingId(row.id);
    setDeleteBlockingMessage(null);

    try {
      if (table === "departments") {
        const [ticketUsage, profileUsage] = await Promise.all([
          supabase.from("tickets").select("id", { count: "exact", head: true }).eq("department_id", row.id),
          supabase.from("profiles").select("id", { count: "exact", head: true }).eq("department_id", row.id),
        ]);
        if (ticketUsage.error) throw ticketUsage.error;
        if (profileUsage.error) throw profileUsage.error;
        const ticketCount = ticketUsage.count ?? 0;
        const profileCount = profileUsage.count ?? 0;
        if (ticketCount || profileCount) {
          setDeleteBlockingMessage(`“${row.name}” masih digunakan oleh ${ticketCount} ticket dan ${profileCount} user. Nonaktifkan agar histori tetap aman.`);
          return;
        }
      } else if (table === "ticket_categories") {
        const usage = await supabase.from("tickets").select("id", { count: "exact", head: true }).eq("category_id", row.id);
        if (usage.error) throw usage.error;
        if ((usage.count ?? 0) > 0) {
          setDeleteBlockingMessage(`“${row.name}” sudah digunakan oleh ${usage.count ?? 0} ticket. Nonaktifkan agar histori tetap aman.`);
          return;
        }
      } else {
        const [ticketUsage, areaUsage] = await Promise.all([
          supabase.from("tickets").select("id", { count: "exact", head: true }).eq("property_id", row.id),
          supabase.from("hotel_areas").select("id", { count: "exact", head: true }).eq("property_id", row.id),
        ]);
        if (ticketUsage.error) throw ticketUsage.error;
        if (areaUsage.error) throw areaUsage.error;
        if ((ticketUsage.count ?? 0) > 0 || (areaUsage.count ?? 0) > 0) {
          setDeleteBlockingMessage(`“${row.name}” masih memiliki ${areaUsage.count ?? 0} area dan digunakan oleh ${ticketUsage.count ?? 0} ticket. Hapus/nonaktifkan area terlebih dahulu atau cukup nonaktifkan property.`);
          return;
        }
      }

      const { error: deleteError } = await supabase.from(table).delete().eq("id", row.id);
      if (deleteError) throw deleteError;
      setDeleteTarget(null);
      setSuccess(`${row.name} berhasil dihapus permanen.`);
      await load();
    } catch (err) {
      setDeleteBlockingMessage(err instanceof Error ? err.message : "Data gagal dihapus.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section className="card settings-master-card">
      <div className="settings-section-heading">
        <div>
          <div className="settings-section-title-line">
            <h2 className="section-title">{title}</h2>
            <span className="settings-count-badge">{rows.length}</span>
          </div>
          <p className="muted">{description}</p>
        </div>
        <button type="button" className="btn btn-primary settings-add-button" onClick={() => { setEditingRow(null); setEditorOpen(true); }}>
          <Plus size={16} /> Tambah
        </button>
      </div>

      <div className="settings-section-meta"><span><strong>{activeCount}</strong> aktif</span><span>{rows.length - activeCount} nonaktif</span></div>

      <div className="settings-search-box">
        <Search size={16} />
        <input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder={`Cari ${title.toLowerCase()}...`} />
        {search && <button type="button" onClick={() => { setSearch(""); setPage(1); }} aria-label="Hapus pencarian"><X size={15} /></button>}
      </div>

      {error && <div className="alert alert-error settings-inline-alert">{error}</div>}
      {success && <div className="alert alert-success settings-inline-alert">{success}</div>}

      <div className="settings-compact-list">
        <div className="settings-list-header" aria-hidden="true"><span>Nama</span><span>Status</span><span>Aksi</span></div>
        {loading ? <div className="settings-empty-state">Memuat data...</div> : pageRows.length === 0 ? (
          <div className="settings-empty-state">{search ? "Tidak ada data yang cocok." : "Belum ada data."}</div>
        ) : pageRows.map((row) => (
          <div className="settings-compact-row" key={row.id}>
            <div className="settings-row-copy"><strong>{row.name}</strong><span>{row.description || "Tanpa description"}</span></div>
            <button type="button" className={`settings-status-pill ${row.is_active ? "is-active" : "is-inactive"}`} onClick={() => void toggleActive(row)} disabled={togglingId === row.id}>
              <span className="settings-status-dot" />{togglingId === row.id ? "..." : row.is_active ? "Active" : "Inactive"}
            </button>
            <div className="settings-compact-actions">
              <button type="button" className="settings-action-button" onClick={() => { setEditingRow(row); setEditorOpen(true); }} aria-label={`Edit ${row.name}`}><Pencil size={15} /></button>
              <button type="button" className="settings-action-button settings-delete-button" onClick={() => { setDeleteTarget(row); setDeleteBlockingMessage(null); }} aria-label={`Hapus ${row.name}`}><Trash2 size={15} /></button>
            </div>
          </div>
        ))}
      </div>

      <div className="settings-pagination">
        <span>{rangeStart}-{rangeEnd} dari {filteredRows.length}</span>
        <div className="settings-pagination-actions">
          <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={safePage <= 1}><ChevronLeft size={16} /></button>
          <span>{safePage} / {totalPages}</span>
          <button type="button" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={safePage >= totalPages}><ChevronRight size={16} /></button>
        </div>
      </div>

      <EditorModal itemLabel={singular} row={editingRow} open={editorOpen} saving={saving} onClose={() => !saving && setEditorOpen(false)} onSave={saveEditor} />
      <DeleteModal itemLabel={singular} row={deleteTarget} deleting={deleteTarget ? deletingId === deleteTarget.id : false} blockingMessage={deleteBlockingMessage} onClose={() => { if (!deletingId) { setDeleteTarget(null); setDeleteBlockingMessage(null); } }} onConfirm={confirmDelete} />
    </section>
  );
}

function AreaSection() {
  const [rows, setRows] = useState<AreaRow[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editingRow, setEditingRow] = useState<AreaRow | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AreaRow | null>(null);
  const [deleteBlockingMessage, setDeleteBlockingMessage] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const areaResult = await supabase
      .from("hotel_areas")
      .select("id,name,description,is_active,property_id")
      .order("is_active", { ascending: false })
      .order("name");
    if (areaResult.error) {
      setError(areaResult.error.message);
      setRows([]);
    } else {
      setRows((areaResult.data ?? []) as unknown as AreaRow[]);
    }
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  const filteredRows = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return keyword ? rows.filter((row) => `${row.name} ${row.description ?? ""}`.toLowerCase().includes(keyword)) : rows;
  }, [rows, search]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filteredRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const activeCount = rows.filter((row) => row.is_active).length;
  const rangeStart = filteredRows.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(safePage * PAGE_SIZE, filteredRows.length);

  async function saveArea(values: { name: string; description: string; isActive: boolean }) {
    setSaving(true);
    setError(null);
    try {
      const payload = { property_id: null, name: values.name, description: values.description || null, is_active: values.isActive };
      const result = editingRow
        ? await supabase.from("hotel_areas").update(payload).eq("id", editingRow.id)
        : await supabase.from("hotel_areas").insert(payload);
      if (result.error) throw result.error;
      setSuccess(`${values.name} berhasil ${editingRow ? "diperbarui" : "ditambahkan"}.`);
      setEditorOpen(false);
      setEditingRow(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Area gagal disimpan.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(row: AreaRow) {
    setTogglingId(row.id);
    const nextActive = !row.is_active;
    const { error: updateError } = await supabase.from("hotel_areas").update({ is_active: nextActive }).eq("id", row.id);
    if (updateError) setError(updateError.message);
    else setRows((current) => current.map((item) => item.id === row.id ? { ...item, is_active: nextActive } : item));
    setTogglingId(null);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteBlockingMessage(null);
    try {
      const usage = await supabase.from("tickets").select("id", { count: "exact", head: true }).eq("area_id", deleteTarget.id);
      if (usage.error) throw usage.error;
      if ((usage.count ?? 0) > 0) {
        setDeleteBlockingMessage(`“${deleteTarget.name}” sudah digunakan oleh ${usage.count ?? 0} ticket. Nonaktifkan agar histori lokasi tetap aman.`);
        return;
      }
      const { error: deleteError } = await supabase.from("hotel_areas").delete().eq("id", deleteTarget.id);
      if (deleteError) throw deleteError;
      setSuccess(`${deleteTarget.name} berhasil dihapus permanen.`);
      setDeleteTarget(null);
      await load();
    } catch (err) {
      setDeleteBlockingMessage(err instanceof Error ? err.message : "Area gagal dihapus.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <section className="card settings-master-card">
      <div className="settings-section-heading">
        <div>
          <div className="settings-section-title-line"><h2 className="section-title">Areas</h2><span className="settings-count-badge">{rows.length}</span></div>
          <p className="muted">Area berlaku fleksibel untuk semua Property. Property pada ticket tetap opsional dan tidak membatasi pilihan Area.</p>
        </div>
        <button type="button" className="btn btn-primary settings-add-button" onClick={() => { setEditingRow(null); setEditorOpen(true); }}>
          <Plus size={16} /> Tambah
        </button>
      </div>

      <div className="settings-section-meta"><span><strong>{activeCount}</strong> aktif</span><span>{rows.length - activeCount} nonaktif</span></div>
      <div className="settings-search-box"><Search size={16} /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Cari area..." />{search && <button type="button" onClick={() => setSearch("")}><X size={15} /></button>}</div>
      {error && <div className="alert alert-error settings-inline-alert">{error}</div>}
      {success && <div className="alert alert-success settings-inline-alert">{success}</div>}

      <div className="settings-compact-list">
        <div className="settings-list-header" aria-hidden="true"><span>Area</span><span>Status</span><span>Aksi</span></div>
        {loading ? <div className="settings-empty-state">Memuat data...</div> : pageRows.length === 0 ? <div className="settings-empty-state">Belum ada area.</div> : pageRows.map((row) => (
          <div className="settings-compact-row" key={row.id}>
            <div className="settings-row-copy"><strong>{row.name}</strong><span>{row.description || "Berlaku untuk semua property"}</span></div>
            <button type="button" className={`settings-status-pill ${row.is_active ? "is-active" : "is-inactive"}`} onClick={() => void toggleActive(row)} disabled={togglingId === row.id}><span className="settings-status-dot" />{togglingId === row.id ? "..." : row.is_active ? "Active" : "Inactive"}</button>
            <div className="settings-compact-actions">
              <button type="button" className="settings-action-button" onClick={() => { setEditingRow(row); setEditorOpen(true); }}><Pencil size={15} /></button>
              <button type="button" className="settings-action-button settings-delete-button" onClick={() => { setDeleteTarget(row); setDeleteBlockingMessage(null); }}><Trash2 size={15} /></button>
            </div>
          </div>
        ))}
      </div>

      <div className="settings-pagination"><span>{rangeStart}-{rangeEnd} dari {filteredRows.length}</span><div className="settings-pagination-actions"><button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={safePage <= 1}><ChevronLeft size={16} /></button><span>{safePage} / {totalPages}</span><button type="button" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={safePage >= totalPages}><ChevronRight size={16} /></button></div></div>

      <AreaEditorModal row={editingRow} open={editorOpen} saving={saving} onClose={() => !saving && setEditorOpen(false)} onSave={saveArea} />
      <DeleteModal itemLabel="Area" row={deleteTarget} deleting={deleting} blockingMessage={deleteBlockingMessage} onClose={() => { if (!deleting) { setDeleteTarget(null); setDeleteBlockingMessage(null); } }} onConfirm={confirmDelete} />
    </section>
  );
}

export function AdminSettingsPage({ profile }: { profile: Profile }) {
  const [mobileSection, setMobileSection] = useState<"departments" | "categories" | "locations">("departments");

  return (
    <AppShell profile={profile}>
      <div className="topbar">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Kelola Department, Category, Property, dan Area tanpa merusak histori ticket lama. Property dan Area dikelola secara fleksibel.</p>
        </div>
      </div>

      <div className="settings-mobile-tabs settings-mobile-tabs-three" role="tablist" aria-label="Master data settings">
        <button type="button" className={mobileSection === "departments" ? "is-active" : ""} onClick={() => setMobileSection("departments")}>Departments</button>
        <button type="button" className={mobileSection === "categories" ? "is-active" : ""} onClick={() => setMobileSection("categories")}>Categories</button>
        <button type="button" className={mobileSection === "locations" ? "is-active" : ""} onClick={() => setMobileSection("locations")}>Locations</button>
      </div>

      <div className="settings-grid">
        <div className={`settings-mobile-panel ${mobileSection === "departments" ? "is-active" : ""}`}>
          <MasterSection title="Departments" singular="Department" description="Department untuk profile user dan ticket." table="departments" />
        </div>
        <div className={`settings-mobile-panel ${mobileSection === "categories" ? "is-active" : ""}`}>
          <MasterSection title="Categories" singular="Category" description="Category untuk klasifikasi ticket baru." table="ticket_categories" />
        </div>
        <div className={`settings-mobile-panel settings-location-panel ${mobileSection === "locations" ? "is-active" : ""}`}>
          <div className="settings-location-grid">
            <MasterSection title="Properties" singular="Property" description="Hotel/property tempat incident terjadi." table="hotel_properties" />
            <AreaSection />
          </div>
        </div>
      </div>
    </AppShell>
  );
}
