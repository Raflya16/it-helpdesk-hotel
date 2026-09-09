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

type MasterTable = "departments" | "ticket_categories";

type EditorModalProps = {
  itemLabel: string;
  row: MasterRow | null;
  open: boolean;
  saving: boolean;
  onClose: () => void;
  onSave: (values: {
    name: string;
    description: string;
    isActive: boolean;
  }) => Promise<void>;
};

const PAGE_SIZE = 7;

function EditorModal({
  itemLabel,
  row,
  open,
  saving,
  onClose,
  onSave,
}: EditorModalProps) {
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

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving) onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, saving, onClose]);

  if (!open) return null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return;

    await onSave({
      name: trimmedName,
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
            <h3 id="settings-editor-title">
              {row ? `Edit ${itemLabel}` : `Tambah ${itemLabel}`}
            </h3>
          </div>
          <button
            type="button"
            className="settings-icon-button"
            onClick={onClose}
            disabled={saving}
            aria-label="Tutup"
          >
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
              <span>Data aktif akan tersedia pada pilihan ticket baru.</span>
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
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
              Batal
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving || !name.trim()}>
              {saving ? "Menyimpan..." : row ? "Simpan perubahan" : `Tambah ${itemLabel}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

type DeleteModalProps = {
  itemLabel: string;
  row: MasterRow | null;
  deleting: boolean;
  blockingMessage: string | null;
  onClose: () => void;
  onConfirm: () => Promise<void>;
};

function DeleteModal({
  itemLabel,
  row,
  deleting,
  blockingMessage,
  onClose,
  onConfirm,
}: DeleteModalProps) {
  useEffect(() => {
    if (!row) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !deleting) onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [row, deleting, onClose]);

  if (!row) return null;

  return (
    <div className="settings-modal-backdrop" role="presentation" onMouseDown={() => !deleting && onClose()}>
      <div
        className="settings-modal settings-delete-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="settings-delete-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className={`settings-delete-icon ${blockingMessage ? "is-blocked" : ""}`}>
          <TriangleAlert size={24} />
        </div>

        <h3 id="settings-delete-title">
          {blockingMessage ? `${itemLabel} tidak dapat dihapus` : `Hapus ${itemLabel}?`}
        </h3>

        {blockingMessage ? (
          <p className="settings-delete-copy">{blockingMessage}</p>
        ) : (
          <p className="settings-delete-copy">
            <strong>“{row.name}”</strong> akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.
            Jika data sudah digunakan pada ticket atau user, sistem akan mempertahankannya demi histori.
          </p>
        )}

        <div className="settings-modal-actions settings-delete-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={deleting}>
            {blockingMessage ? "Tutup" : "Batal"}
          </button>
          {!blockingMessage && (
            <button
              type="button"
              className="btn settings-confirm-delete"
              onClick={() => void onConfirm()}
              disabled={deleting}
            >
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

  useEffect(() => {
    void load();
  }, [table]);

  const filteredRows = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return rows;

    return rows.filter((row) =>
      `${row.name} ${row.description ?? ""}`.toLowerCase().includes(keyword),
    );
  }, [rows, search]);

  const activeCount = useMemo(() => rows.filter((row) => row.is_active).length, [rows]);
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filteredRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const rangeStart = filteredRows.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(safePage * PAGE_SIZE, filteredRows.length);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  function openCreate() {
    setEditingRow(null);
    setEditorOpen(true);
    setError(null);
    setSuccess(null);
  }

  function openEdit(row: MasterRow) {
    setEditingRow(row);
    setEditorOpen(true);
    setError(null);
    setSuccess(null);
  }

  async function saveEditor(values: {
    name: string;
    description: string;
    isActive: boolean;
  }) {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      if (editingRow) {
        const { error: updateError } = await supabase
          .from(table)
          .update({
            name: values.name,
            description: values.description || null,
            is_active: values.isActive,
          })
          .eq("id", editingRow.id);

        if (updateError) throw updateError;
        setSuccess(`${values.name} berhasil diperbarui.`);
      } else {
        const { error: insertError } = await supabase.from(table).insert({
          name: values.name,
          description: values.description || null,
          is_active: values.isActive,
        });

        if (insertError) throw insertError;
        setSuccess(`${values.name} berhasil ditambahkan.`);
      }

      setEditorOpen(false);
      setEditingRow(null);
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Data gagal disimpan.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(row: MasterRow) {
    setTogglingId(row.id);
    setError(null);
    setSuccess(null);

    const nextActive = !row.is_active;
    const { error: updateError } = await supabase
      .from(table)
      .update({ is_active: nextActive })
      .eq("id", row.id);

    if (updateError) {
      setError(updateError.message);
    } else {
      setRows((current) =>
        current.map((item) => (item.id === row.id ? { ...item, is_active: nextActive } : item)),
      );
      setSuccess(`${row.name} ${nextActive ? "diaktifkan" : "dinonaktifkan"}.`);
    }

    setTogglingId(null);
  }

  function requestDelete(row: MasterRow) {
    setDeleteTarget(row);
    setDeleteBlockingMessage(null);
    setError(null);
    setSuccess(null);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;

    const row = deleteTarget;
    setDeletingId(row.id);
    setDeleteBlockingMessage(null);

    try {
      if (table === "departments") {
        const [ticketUsage, profileUsage] = await Promise.all([
          supabase
            .from("tickets")
            .select("id", { count: "exact", head: true })
            .eq("department_id", row.id),
          supabase
            .from("profiles")
            .select("id", { count: "exact", head: true })
            .eq("department_id", row.id),
        ]);

        if (ticketUsage.error) throw ticketUsage.error;
        if (profileUsage.error) throw profileUsage.error;

        const ticketCount = ticketUsage.count ?? 0;
        const profileCount = profileUsage.count ?? 0;

        if (ticketCount > 0 || profileCount > 0) {
          setDeleteBlockingMessage(
            `“${row.name}” masih digunakan oleh ${ticketCount} ticket dan ${profileCount} user. Nonaktifkan data ini agar tidak muncul pada pilihan baru tanpa merusak histori.`,
          );
          return;
        }
      } else {
        const ticketUsage = await supabase
          .from("tickets")
          .select("id", { count: "exact", head: true })
          .eq("category_id", row.id);

        if (ticketUsage.error) throw ticketUsage.error;

        const ticketCount = ticketUsage.count ?? 0;
        if (ticketCount > 0) {
          setDeleteBlockingMessage(
            `“${row.name}” sudah digunakan oleh ${ticketCount} ticket. Nonaktifkan category ini agar tidak muncul pada ticket baru tanpa menghapus histori.`,
          );
          return;
        }
      }

      const { error: deleteError } = await supabase.from(table).delete().eq("id", row.id);
      if (deleteError) throw deleteError;

      setDeleteTarget(null);
      setSuccess(`${row.name} berhasil dihapus permanen.`);
      await load();
    } catch (deleteError) {
      setDeleteBlockingMessage(
        deleteError instanceof Error ? deleteError.message : "Data gagal dihapus.",
      );
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
        <button type="button" className="btn btn-primary settings-add-button" onClick={openCreate}>
          <Plus size={16} />
          Tambah
        </button>
      </div>

      <div className="settings-section-meta">
        <span><strong>{activeCount}</strong> aktif</span>
        <span>{rows.length - activeCount} nonaktif</span>
      </div>

      <div className="settings-search-box">
        <Search size={16} />
        <input
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          placeholder={`Cari ${title.toLowerCase()}...`}
          aria-label={`Cari ${title}`}
        />
        {search && (
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setPage(1);
            }}
            aria-label="Hapus pencarian"
          >
            <X size={15} />
          </button>
        )}
      </div>

      {error && <div className="alert alert-error settings-inline-alert">{error}</div>}
      {success && <div className="alert alert-success settings-inline-alert">{success}</div>}

      <div className="settings-compact-list">
        <div className="settings-list-header" aria-hidden="true">
          <span>Nama</span>
          <span>Status</span>
          <span>Aksi</span>
        </div>

        {loading ? (
          <div className="settings-empty-state">Memuat data...</div>
        ) : pageRows.length === 0 ? (
          <div className="settings-empty-state">
            {search ? "Tidak ada data yang cocok dengan pencarian." : "Belum ada data."}
          </div>
        ) : (
          pageRows.map((row) => (
            <div className="settings-compact-row" key={row.id}>
              <div className="settings-row-copy">
                <strong title={row.name}>{row.name}</strong>
                <span title={row.description ?? ""}>{row.description || "Tanpa description"}</span>
              </div>

              <button
                type="button"
                className={`settings-status-pill ${row.is_active ? "is-active" : "is-inactive"}`}
                onClick={() => void toggleActive(row)}
                disabled={togglingId === row.id}
                title={row.is_active ? "Klik untuk menonaktifkan" : "Klik untuk mengaktifkan"}
              >
                <span className="settings-status-dot" />
                {togglingId === row.id ? "..." : row.is_active ? "Active" : "Inactive"}
              </button>

              <div className="settings-compact-actions">
                <button
                  type="button"
                  className="settings-action-button"
                  onClick={() => openEdit(row)}
                  title={`Edit ${row.name}`}
                  aria-label={`Edit ${row.name}`}
                >
                  <Pencil size={15} />
                </button>
                <button
                  type="button"
                  className="settings-action-button settings-delete-button"
                  onClick={() => requestDelete(row)}
                  title={`Hapus ${row.name}`}
                  aria-label={`Hapus ${row.name}`}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="settings-pagination">
        <span>
          {rangeStart}-{rangeEnd} dari {filteredRows.length}
        </span>
        <div className="settings-pagination-actions">
          <button
            type="button"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={safePage <= 1}
            aria-label="Halaman sebelumnya"
          >
            <ChevronLeft size={16} />
          </button>
          <span>{safePage} / {totalPages}</span>
          <button
            type="button"
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            disabled={safePage >= totalPages}
            aria-label="Halaman berikutnya"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <EditorModal
        itemLabel={singular}
        row={editingRow}
        open={editorOpen}
        saving={saving}
        onClose={() => {
          if (saving) return;
          setEditorOpen(false);
          setEditingRow(null);
        }}
        onSave={saveEditor}
      />

      <DeleteModal
        itemLabel={singular}
        row={deleteTarget}
        deleting={deleteTarget ? deletingId === deleteTarget.id : false}
        blockingMessage={deleteBlockingMessage}
        onClose={() => {
          if (deletingId) return;
          setDeleteTarget(null);
          setDeleteBlockingMessage(null);
        }}
        onConfirm={confirmDelete}
      />
    </section>
  );
}

export function AdminSettingsPage({ profile }: { profile: Profile }) {
  return (
    <AppShell profile={profile}>
      <div className="topbar">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">
            Kelola Department dan Ticket Category dalam tampilan ringkas. Data historis tetap aman saat dinonaktifkan.
          </p>
        </div>
      </div>

      <div className="settings-grid">
        <MasterSection
          title="Departments"
          singular="Department"
          description="Department untuk profile user dan ticket."
          table="departments"
        />
        <MasterSection
          title="Categories"
          singular="Category"
          description="Category untuk klasifikasi ticket baru."
          table="ticket_categories"
        />
      </div>
    </AppShell>
  );
}
