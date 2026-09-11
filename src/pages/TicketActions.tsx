import {
  FormEvent,
  useMemo,
  useState,
} from "react";
import { AlertTriangle, Trash2, X } from "lucide-react";

import { friendlyErrorMessage } from "../lib/errors";
import { isDoneStatus } from "../lib/sla";
import { supabase } from "../lib/supabase";

type ITUser = {
  id: string;
  name: string;
  role: string;
};

type UIStatus = "OPEN" | "IN_PROGRESS" | "FINISH";
type CancelReasonCode =
  | "WRONG_TICKET"
  | "RESOLVED_SELF"
  | "DUPLICATE"
  | "OTHER";

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
  currentFirstResponseAt,
  isIT,
  canReopen,
  canCancel,
  itUsers,
  userId,
  onUpdated,
}: {
  ticketId: string;
  currentStatus: string;
  currentAssignee: string | null;
  currentResolutionNote: string | null;
  currentFirstResponseAt: string | null;
  isIT: boolean;
  canReopen: boolean;
  canCancel: boolean;
  itUsers: ITUser[];
  userId: string;
  onUpdated: () => Promise<void>;
}) {
  const normalizedCurrentStatus = normalizeStatus(currentStatus);
  const ticketDone = isDoneStatus(currentStatus);
  const ticketCancelled = String(currentStatus).toUpperCase() === "CANCELLED";

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<UIStatus>(
    normalizedCurrentStatus
  );
  const [resolutionNote, setResolutionNote] = useState(
    currentResolutionNote ?? ""
  );
  const [reopenReason, setReopenReason] = useState("");
  const [commentMode, setCommentMode] = useState<"PUBLIC" | "INTERNAL">("PUBLIC");

  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReasonCode, setCancelReasonCode] =
    useState<CancelReasonCode>("WRONG_TICKET");
  const [cancelReasonDetail, setCancelReasonDetail] = useState("");
  const [duplicateTicketNumber, setDuplicateTicketNumber] = useState("");

  const fileLabel = useMemo(() => {
    if (files.length === 0) return "Tidak ada file dipilih";
    if (files.length === 1) return files[0].name;
    return `${files.length} file dipilih`;
  }, [files]);

  const reporterCancelBlocked =
    !isIT && Boolean(currentFirstResponseAt);

  function clearFeedback() {
    setError(null);
    setSuccess(null);
  }

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
    clearFeedback();

    const form = event.currentTarget;
    const formData = new FormData(form);
    const text = String(formData.get("comment") || "").trim();
    const fileError = validateFiles(files);

    if (fileError) {
      setError(fileError);
      return;
    }

    if (!text && files.length === 0) {
      setError("Tulis pesan atau pilih attachment terlebih dahulu.");
      return;
    }

    setBusy(true);

    try {
      const { data: comment, error: commentError } = await supabase
        .from("ticket_comments")
        .insert({
          ticket_id: ticketId,
          user_id: userId,
          comment: text || "Mengirim attachment.",
          is_internal: isIT && commentMode === "INTERNAL",
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
      setCommentMode("PUBLIC");
      setSuccess(
        isIT && commentMode === "INTERNAL"
          ? "Internal Note berhasil disimpan."
          : "Balasan berhasil dikirim."
      );
      await onUpdated();
    } catch (err) {
      console.error("Failed to add conversation update:", err);
      setError(
        friendlyErrorMessage(
          err,
          "Gagal mengirim komentar atau attachment. Silakan coba lagi."
        )
      );
    } finally {
      setBusy(false);
    }
  }

  async function updateTicket(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isIT || ticketCancelled) return;

    clearFeedback();
    const formData = new FormData(event.currentTarget);
    const assignedValue = String(formData.get("assigned_to") || "").trim();

    if (selectedStatus === "FINISH" && resolutionNote.trim().length < 5) {
      setError("Resolution Note minimal 5 karakter sebelum ticket diselesaikan.");
      return;
    }

    setBusy(true);

    try {
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

      if (updateError) throw updateError;

      setSuccess("Ticket berhasil diperbarui.");
      await onUpdated();
    } catch (err) {
      console.error("Failed to update ticket:", err);
      setError(
        friendlyErrorMessage(err, "Gagal memperbarui ticket. Silakan coba lagi.")
      );
    } finally {
      setBusy(false);
    }
  }

  async function reopenTicket() {
    const reason = reopenReason.trim();
    clearFeedback();

    if (reason.length < 5) {
      setError("Alasan reopen minimal 5 karakter.");
      return;
    }

    setBusy(true);

    try {
      const { error: reopenError } = await supabase.rpc("reopen_ticket", {
        p_ticket_id: ticketId,
        p_reason: reason,
      });

      if (reopenError) throw reopenError;

      setReopenReason("");
      setSelectedStatus("OPEN");
      setSuccess("Ticket berhasil dibuka kembali.");
      await onUpdated();
    } catch (err) {
      console.error("Failed to reopen ticket:", err);
      setError(
        friendlyErrorMessage(err, "Gagal membuka kembali ticket. Silakan coba lagi.")
      );
    } finally {
      setBusy(false);
    }
  }

  function openCancelModal() {
    clearFeedback();
    setCancelReasonCode("WRONG_TICKET");
    setCancelReasonDetail("");
    setDuplicateTicketNumber("");
    setCancelOpen(true);
  }

  async function cancelTicket(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearFeedback();

    if (cancelReasonCode === "OTHER" && cancelReasonDetail.trim().length < 5) {
      setError("Jelaskan alasan pembatalan minimal 5 karakter.");
      return;
    }

    if (cancelReasonCode === "DUPLICATE" && !duplicateTicketNumber.trim()) {
      setError("Masukkan nomor ticket yang menjadi duplikat.");
      return;
    }

    setBusy(true);

    try {
      const { error: cancelError } = await supabase.rpc("cancel_ticket", {
        p_ticket_id: ticketId,
        p_reason_code: cancelReasonCode,
        p_reason_detail: cancelReasonDetail.trim() || null,
        p_duplicate_ticket_number:
          cancelReasonCode === "DUPLICATE"
            ? duplicateTicketNumber.trim()
            : null,
      });

      if (cancelError) throw cancelError;

      setCancelOpen(false);
      setSuccess(
        isIT
          ? "Ticket berhasil dibatalkan."
          : "Ticket berhasil dihapus dari antrean aktif IT."
      );
      await onUpdated();
    } catch (err) {
      console.error("Failed to cancel ticket:", err);
      setError(
        friendlyErrorMessage(err, "Gagal membatalkan ticket. Silakan coba lagi.")
      );
    } finally {
      setBusy(false);
    }
  }

  if (ticketCancelled) {
    return (
      <div className="cancelled-ticket-notice">
        <AlertTriangle size={19} />
        <div>
          <strong>Ticket sudah dibatalkan</strong>
          <p>
            Ticket ini tidak lagi masuk antrean aktif IT. Riwayatnya tetap disimpan untuk audit.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <form onSubmit={addComment} style={{ display: "grid", gap: 9 }}>
        {isIT && (
          <div className="conversation-mode-toggle" role="tablist" aria-label="Jenis conversation">
            <button
              type="button"
              className={commentMode === "PUBLIC" ? "is-active" : ""}
              onClick={() => setCommentMode("PUBLIC")}
              disabled={busy}
              role="tab"
              aria-selected={commentMode === "PUBLIC"}
            >
              Public Reply
            </button>
            <button
              type="button"
              className={commentMode === "INTERNAL" ? "is-active is-internal" : ""}
              onClick={() => setCommentMode("INTERNAL")}
              disabled={busy}
              role="tab"
              aria-selected={commentMode === "INTERNAL"}
            >
              Internal Note
            </button>
          </div>
        )}

        {isIT && commentMode === "INTERNAL" && (
          <div className="internal-note-hint">
            Hanya IT/Admin yang dapat melihat catatan dan attachment ini. Reporter tidak menerima notification.
          </div>
        )}

        <textarea
          className="textarea"
          name="comment"
          disabled={busy}
          placeholder={
            isIT && commentMode === "INTERNAL"
              ? "Catatan troubleshooting, handover, atau informasi internal tim IT..."
              : "Tulis update, pertanyaan, atau jawaban untuk reporter..."
          }
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
          <label className={`btn btn-secondary conversation-upload-button ${busy ? "is-disabled" : ""}`}>
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
                setSuccess(null);
                setFiles(validationError ? [] : nextFiles);
              }}
            />
          </label>
          <span className="muted conversation-file-label">{fileLabel}</span>
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy
              ? "Menyimpan..."
              : isIT && commentMode === "INTERNAL"
                ? "Save Internal Note"
                : "Send Reply"}
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
              {busy ? "Menyimpan..." : "Save Update"}
            </button>
          </div>
        </form>
      )}

      {ticketDone && canReopen && (
        <div className="reopen-box">
          <div>
            <strong>Reopen Ticket</strong>
            <p className="muted">
              Ticket akan kembali ke WAITING dan target waktu aktif kembali dari waktu reopen.
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

      {!ticketDone && canCancel && (
        <div className="cancel-ticket-box">
          <div>
            <strong>{isIT ? "Cancel Ticket" : "Hapus Ticket"}</strong>
            <p className="muted">
              {isIT
                ? "Batalkan ticket tanpa menghapus histori audit."
                : "Gunakan ini jika ticket salah dibuat, masalah sudah selesai, atau ticket duplikat."}
            </p>
            {!isIT && reporterCancelBlocked && (
              <p className="cancel-ticket-warning">
                Ticket sudah mendapat respons IT dan tidak dapat dihapus langsung. Gunakan Conversation untuk meminta pembatalan.
              </p>
            )}
          </div>
          <div className="ticket-action-footer">
            <button
              type="button"
              className="btn btn-danger"
              disabled={busy || reporterCancelBlocked}
              onClick={openCancelModal}
            >
              <Trash2 size={16} />
              {isIT ? "Cancel Ticket" : "Hapus Ticket"}
            </button>
          </div>
        </div>
      )}

      {cancelOpen && (
        <div
          className="cancel-ticket-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !busy) {
              setCancelOpen(false);
            }
          }}
        >
          <form className="cancel-ticket-modal" onSubmit={cancelTicket}>
            <div className="cancel-ticket-modal-header">
              <div>
                <span className="cancel-ticket-eyebrow">
                  {isIT ? "CANCEL TICKET" : "HAPUS TICKET"}
                </span>
                <h3>
                  {isIT
                    ? "Batalkan ticket ini?"
                    : "Hapus ticket dari antrean IT?"}
                </h3>
              </div>
              <button
                type="button"
                className="cancel-ticket-close"
                onClick={() => setCancelOpen(false)}
                disabled={busy}
                aria-label="Tutup"
              >
                <X size={19} />
              </button>
            </div>

            <p className="cancel-ticket-description">
              Data ticket tidak benar-benar dihapus. Status akan menjadi CANCELLED dan seluruh histori tetap tersimpan untuk audit.
            </p>

            <div>
              <label className="label" htmlFor="cancel-reason">
                Alasan *
              </label>
              <select
                id="cancel-reason"
                className="select"
                value={cancelReasonCode}
                onChange={(event) => {
                  setCancelReasonCode(event.target.value as CancelReasonCode);
                  setError(null);
                }}
                disabled={busy}
              >
                <option value="WRONG_TICKET">Salah membuat ticket</option>
                <option value="RESOLVED_SELF">Masalah sudah selesai</option>
                <option value="DUPLICATE">Ticket duplikat</option>
                <option value="OTHER">Alasan lain</option>
              </select>
            </div>

            {cancelReasonCode === "DUPLICATE" && (
              <div>
                <label className="label" htmlFor="duplicate-ticket-number">
                  Nomor ticket yang benar *
                </label>
                <input
                  id="duplicate-ticket-number"
                  className="input"
                  value={duplicateTicketNumber}
                  onChange={(event) => setDuplicateTicketNumber(event.target.value)}
                  disabled={busy}
                  placeholder="Contoh: TKT-20260911-0003"
                />
              </div>
            )}

            <div>
              <label className="label" htmlFor="cancel-detail">
                Catatan {cancelReasonCode === "OTHER" ? "*" : "(opsional)"}
              </label>
              <textarea
                id="cancel-detail"
                className="textarea"
                value={cancelReasonDetail}
                onChange={(event) => setCancelReasonDetail(event.target.value)}
                disabled={busy}
                minLength={cancelReasonCode === "OTHER" ? 5 : undefined}
                placeholder="Tambahkan penjelasan singkat jika diperlukan..."
                style={{ minHeight: 88 }}
              />
            </div>

            {error && <div className="alert alert-error">{error}</div>}

            <div className="cancel-ticket-modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setCancelOpen(false)}
                disabled={busy}
              >
                Batal
              </button>
              <button type="submit" className="btn btn-danger" disabled={busy}>
                <Trash2 size={16} />
                {busy
                  ? "Memproses..."
                  : isIT
                    ? "Batalkan Ticket"
                    : "Hapus Ticket"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
