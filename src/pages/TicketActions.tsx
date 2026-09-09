import {
  FormEvent,
  useMemo,
  useState,
} from "react";

import { isDoneStatus } from "../lib/sla";
import { supabase } from "../lib/supabase";

type ITUser = {
  id: string;
  name: string;
  role: string;
};

type UIStatus = "OPEN" | "IN_PROGRESS" | "FINISH";

const MAX_FILES = 5;
const MAX_FILE_SIZE = 50 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4",
  "video/quicktime",
]);

function normalizeStatus(status: string): UIStatus {
  const value = String(status).trim().toUpperCase();

  if (value === "OPEN" || value === "ASSIGNED") return "OPEN";
  if (value === "IN_PROGRESS" || value === "WAITING_USER") {
    return "IN_PROGRESS";
  }
  return "FINISH";
}

function statusToDatabase(status: UIStatus) {
  if (status === "OPEN") return "OPEN";
  if (status === "IN_PROGRESS") return "IN_PROGRESS";
  return "CLOSED";
}

function safeFileName(name: string) {
  return name
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(-120);
}

export function TicketActions({
  ticketId,
  currentStatus,
  currentAssignee,
  currentResolutionNote,
  isIT,
  canReopen,
  itUsers,
  userId,
  onUpdated,
}: {
  ticketId: string;
  currentStatus: string;
  currentAssignee: string | null;
  currentResolutionNote: string | null;
  isIT: boolean;
  canReopen: boolean;
  itUsers: ITUser[];
  userId: string;
  onUpdated: () => Promise<void>;
}) {
  const normalizedCurrentStatus = normalizeStatus(currentStatus);
  const ticketDone = isDoneStatus(currentStatus);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<UIStatus>(
    normalizedCurrentStatus
  );
  const [resolutionNote, setResolutionNote] = useState(
    currentResolutionNote ?? ""
  );
  const [reopenReason, setReopenReason] = useState("");

  const fileLabel = useMemo(() => {
    if (files.length === 0) return "Tidak ada file dipilih";
    if (files.length === 1) return files[0].name;
    return `${files.length} file dipilih`;
  }, [files]);

  function validateFiles(nextFiles: File[]) {
    if (nextFiles.length > MAX_FILES) {
      return `Maksimal ${MAX_FILES} attachment per komentar.`;
    }

    for (const file of nextFiles) {
      if (!ALLOWED_TYPES.has(file.type)) {
        return `Format ${file.name} tidak didukung. Gunakan JPG, PNG, WEBP, MP4, atau MOV.`;
      }
      if (file.size > MAX_FILE_SIZE) {
        return `${file.name} melebihi batas 50 MB.`;
      }
    }

    return null;
  }

  async function uploadConversationAttachments(
    commentId: string,
    selectedFiles: File[]
  ) {
    for (const file of selectedFiles) {
      const storagePath = `${userId}/${ticketId}/conversation/${commentId}/${crypto.randomUUID()}-${safeFileName(file.name)}`;

      const { error: uploadError } = await supabase.storage
        .from("ticket-attachments")
        .upload(storagePath, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type,
        });

      if (uploadError) throw uploadError;

      const { error: metaError } = await supabase
        .from("ticket_attachments")
        .insert({
          ticket_id: ticketId,
          comment_id: commentId,
          file_name: file.name,
          storage_path: storagePath,
          file_type: file.type || "application/octet-stream",
          file_size: file.size,
          uploaded_by: userId,
        });

      if (metaError) {
        await supabase.storage
          .from("ticket-attachments")
          .remove([storagePath]);
        throw metaError;
      }
    }
  }

  async function addComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);
    const text = String(formData.get("comment") || "").trim();
    const fileError = validateFiles(files);

    if (fileError) {
      setError(fileError);
      return;
    }

    if (!text && files.length === 0) return;

    setBusy(true);
    setError(null);

    try {
      const { data: comment, error: commentError } = await supabase
        .from("ticket_comments")
        .insert({
          ticket_id: ticketId,
          user_id: userId,
          comment: text || "Mengirim attachment.",
        })
        .select("id")
        .single();

      if (commentError || !comment) {
        throw commentError ?? new Error("Komentar gagal dibuat.");
      }

      if (files.length > 0) {
        await uploadConversationAttachments(String(comment.id), files);
      }

      form.reset();
      setFiles([]);
      await onUpdated();
    } catch (err) {
      console.error("Failed to add conversation update:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Gagal mengirim komentar atau attachment."
      );
      await onUpdated();
    } finally {
      setBusy(false);
    }
  }

  async function updateTicket(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isIT) return;

    const formData = new FormData(event.currentTarget);
    const assignedValue = String(formData.get("assigned_to") || "").trim();

    if (selectedStatus === "FINISH" && resolutionNote.trim().length < 5) {
      setError("Resolution Note minimal 5 karakter sebelum ticket diselesaikan.");
      return;
    }

    setBusy(true);
    setError(null);

    const payload: Record<string, string | null> = {
      assigned_to: assignedValue || null,
    };

    if (!ticketDone) {
      payload.status = statusToDatabase(selectedStatus);
    }

    if (selectedStatus === "FINISH" || ticketDone) {
      payload.resolution_note = resolutionNote.trim() || null;
    }

    const { error: updateError } = await supabase
      .from("tickets")
      .update(payload)
      .eq("id", ticketId);

    if (updateError) {
      setError(updateError.message);
      setBusy(false);
      return;
    }

    await onUpdated();
    setBusy(false);
  }

  async function reopenTicket() {
    const reason = reopenReason.trim();

    if (reason.length < 5) {
      setError("Alasan reopen minimal 5 karakter.");
      return;
    }

    setBusy(true);
    setError(null);

    const { error: reopenError } = await supabase.rpc("reopen_ticket", {
      p_ticket_id: ticketId,
      p_reason: reason,
    });

    if (reopenError) {
      setError(reopenError.message);
      setBusy(false);
      return;
    }

    setReopenReason("");
    await onUpdated();
    setSelectedStatus("OPEN");
    setBusy(false);
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      {error && <div className="alert alert-error">{error}</div>}

      <form onSubmit={addComment} style={{ display: "grid", gap: 9 }}>
        <textarea
          className="textarea"
          name="comment"
          disabled={busy}
          placeholder="Tulis update, pertanyaan, atau jawaban..."
          style={{ minHeight: 90 }}
          onKeyDown={(event) => {
            if (
              event.key === "Enter" &&
              !event.shiftKey &&
              !event.nativeEvent.isComposing
            ) {
              const value = event.currentTarget.value.trim();
              if (!value || busy || files.length > 0) return;
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
        />

        <div className="conversation-upload-row">
          <label className="btn btn-secondary conversation-upload-button">
            Attachment
            <input
              type="file"
              multiple
              hidden
              disabled={busy}
              accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime"
              onChange={(event) => {
                const nextFiles = Array.from(event.target.files ?? []);
                const validationError = validateFiles(nextFiles);
                setError(validationError);
                setFiles(validationError ? [] : nextFiles);
              }}
            />
          </label>
          <span className="muted conversation-file-label">{fileLabel}</span>
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? "Saving..." : "Send Update"}
          </button>
        </div>
      </form>

      {isIT && (
        <form
          onSubmit={updateTicket}
          style={{ borderTop: "1px solid #e5eaf2", paddingTop: 16 }}
        >
          <div className="form-grid">
            <div>
              <label className="label">Assigned To</label>
              <select
                className="select"
                name="assigned_to"
                defaultValue={currentAssignee ?? ""}
                disabled={busy}
              >
                <option value="">Unassigned</option>
                {itUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Status</label>
              <select
                className="select"
                name="status"
                value={selectedStatus}
                disabled={busy || ticketDone}
                onChange={(event) =>
                  setSelectedStatus(event.target.value as UIStatus)
                }
              >
                <option value="OPEN">WAITING</option>
                <option value="IN_PROGRESS">IN PROGRESS</option>
                <option value="FINISH">DONE</option>
              </select>
            </div>
          </div>

          {(selectedStatus === "FINISH" || ticketDone) && (
            <div style={{ marginTop: 12 }}>
              <label className="label" htmlFor="resolution-note">
                Resolution Note *
              </label>
              <textarea
                id="resolution-note"
                className="textarea"
                value={resolutionNote}
                onChange={(event) => setResolutionNote(event.target.value)}
                disabled={busy}
                minLength={5}
                placeholder="Jelaskan root cause dan tindakan penyelesaian ticket."
                style={{ minHeight: 90 }}
              />
            </div>
          )}

          <div className="ticket-action-footer">
            <button className="btn btn-secondary" type="submit" disabled={busy}>
              {busy ? "Saving..." : "Save Update"}
            </button>
          </div>
        </form>
      )}

      {ticketDone && canReopen && (
        <div className="reopen-box">
          <div>
            <strong>Reopen Ticket</strong>
            <p className="muted">
              Ticket akan kembali ke WAITING dan SLA aktif kembali dari waktu reopen.
            </p>
          </div>
          <textarea
            className="textarea"
            value={reopenReason}
            onChange={(event) => setReopenReason(event.target.value)}
            disabled={busy}
            placeholder="Alasan ticket perlu dibuka kembali..."
            style={{ minHeight: 76 }}
          />
          <div className="ticket-action-footer">
            <button
              type="button"
              className="btn btn-secondary"
              disabled={busy}
              onClick={() => void reopenTicket()}
            >
              Reopen Ticket
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
