import {
  useCallback,
  useEffect,
  useState,
} from "react";

import { AppShell } from "../components/AppShell";
import { AttachmentPreviewGallery } from "../components/attachment-preview-gallery";
import { ErrorState } from "../components/ErrorState";
import {
  PriorityBadge,
  SlaBadge,
  StatusBadge,
} from "../components/status-badge";
import { friendlyErrorMessage } from "../lib/errors";
import { localDate } from "../lib/format";
import {
  durationMs,
  formatDueDistance,
  formatDuration,
  getSlaState,
} from "../lib/sla";
import { supabase } from "../lib/supabase";
import {
  relationName,
  type NamedRelation,
  type Profile,
} from "../lib/types";
import { TicketActions } from "./TicketActions";

type Ticket = {
  id: string;
  ticket_number: string;
  title: string;
  description: string;
  priority: string;
  status: string;
  category_id: string;
  department_id: string;
  property_id: string | null;
  area_id: string | null;
  location: string | null;
  device_name: string | null;
  created_by: string;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
  first_response_at: string | null;
  finished_at: string | null;
  resolution_note: string | null;
  reopened_at: string | null;
  reopened_by: string | null;
  reopen_count: number;
  cancelled_at: string | null;
  cancelled_by: string | null;
  cancel_reason_code: string | null;
  cancel_reason: string | null;
  duplicate_of: string | null;
  sla_response_due_at: string | null;
  sla_resolution_due_at: string | null;
  category: NamedRelation;
  department: NamedRelation;
  property: NamedRelation;
  area: NamedRelation;
  reporter: NamedRelation;
  assignee: NamedRelation;
  canceller: NamedRelation;
  duplicate_ticket_number: string | null;
};

type CommentUser = {
  name?: string;
  role?: string;
};

type CommentRow = {
  id: string;
  comment: string;
  is_internal: boolean;
  created_at: string;
  user:
    | CommentUser
    | CommentUser[]
    | null;
};

type HistoryRow = {
  id: string;
  action: string;
  old_value: string | null;
  new_value: string | null;
  description: string | null;
  created_at: string;
  user: NamedRelation;
};

type AttachmentRow = {
  id: string;
  comment_id: string | null;
  file_name: string;
  storage_path: string;
  file_type: string;
  file_size: number;
  created_at: string;
};

type PreviewAttachment = {
  id: string;
  comment_id?: string | null;
  file_name: string;
  file_type: string;
  file_size: number;
  url: string;
};

type AdminUser = {
  id: string;
  name: string;
  role: string;
};

function commentUser(
  value: CommentRow["user"]
) {
  if (!value) return null;

  return Array.isArray(value)
    ? value[0] ?? null
    : value;
}

function displayStatus(
  value: string | null
) {
  const status = String(value ?? "")
    .trim()
    .toUpperCase();

  if (
    status === "OPEN" ||
    status === "ASSIGNED" ||
    status === "WAITING"
  ) {
    return "WAITING";
  }

  if (
    status === "IN_PROGRESS" ||
    status === "WAITING_USER"
  ) {
    return "IN PROGRESS";
  }

  if (
    status === "RESOLVED" ||
    status === "CLOSED" ||
    status === "FINISH" ||
    status === "DONE"
  ) {
    return "DONE";
  }

  if (status === "CANCELLED") {
    return "CANCELLED";
  }

  return status || "-";
}

function historyText(
  item: HistoryRow
) {
  switch (item.action) {
    case "TICKET_CREATED":
      return "membuat ticket";

    case "COMMENT_ADDED":
      return "menambahkan balasan publik";

    case "INTERNAL_NOTE_ADDED":
      return "menambahkan Internal Note";

    case "INTERNAL_ATTACHMENT_ADDED":
      return item.new_value
        ? `mengunggah attachment internal ${item.new_value}`
        : "menambahkan attachment internal";

    case "ATTACHMENT_ADDED":
      return item.new_value
        ? `mengunggah ${item.new_value}`
        : "menambahkan attachment";

    case "STATUS_CHANGED":
      return `mengubah status ${displayStatus(
        item.old_value
      )} → ${displayStatus(
        item.new_value
      )}`;

    case "ASSIGNEE_CHANGED":
      return "mengubah penugasan ticket";

    case "REOPENED":
      return item.description
        ? `membuka kembali ticket · ${item.description}`
        : "membuka kembali ticket";

    case "TICKET_CANCELLED":
      return item.description
        ? `membatalkan ticket · ${item.description}`
        : "membatalkan ticket";

    case "TICKET_MARKED_DUPLICATE":
      return item.description
        ? `menandai ticket sebagai duplikat · ${item.description}`
        : "menandai ticket sebagai duplikat";

    case "RESOLUTION_NOTE_UPDATED":
      return "memperbarui Resolution Note";

    case "CATEGORY_CHANGED":
      return "mengubah category ticket";

    case "DEPARTMENT_CHANGED":
      return "mengubah department ticket";

    case "PROPERTY_CHANGED":
      return "mengubah property ticket";

    case "AREA_CHANGED":
      return "mengubah area ticket";

    case "LOCATION_CHANGED":
      return "mengubah detail lokasi ticket";

    case "PRIORITY_CHANGED":
      return `mengubah priority ${
        item.old_value ?? "-"
      } → ${item.new_value ?? "-"}`;

    default:
      return (
        item.description ||
        item.action
          .replaceAll("_", " ")
          .toLowerCase()
      );
  }
}

export function TicketDetailPage({
  profile,
  ticketId,
}: {
  profile: Profile;
  ticketId: string;
}) {
  const isIT =
    profile.role === "ADMIN" ||
    profile.role === "IT";

  const [ticket, setTicket] =
    useState<Ticket | null>(null);

  const [comments, setComments] =
    useState<CommentRow[]>([]);

  const [history, setHistory] =
    useState<HistoryRow[]>([]);

  const [
    attachments,
    setAttachments,
  ] = useState<
    PreviewAttachment[]
  >([]);

  const [itUsers, setItUsers] =
    useState<AdminUser[]>([]);

  const [
    commentAttachments,
    setCommentAttachments,
  ] = useState<
    Record<
      string,
      PreviewAttachment[]
    >
  >({});

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  const load = useCallback(
    async () => {
      setLoading(true);
      setError(null);

      const {
        data: ticketData,
        error: ticketError,
      } = await supabase
        .from("tickets")
        .select(`
          *,
          category:ticket_categories(name),
          department:departments(name),
          property:hotel_properties(name),
          area:hotel_areas(name),
          reporter:profiles!tickets_created_by_fkey(name,email),
          assignee:profiles!tickets_assigned_to_fkey(name,email),
          canceller:profiles!tickets_cancelled_by_fkey(name,email)
        `)
        .eq("id", ticketId)
        .single();

      if (
        ticketError ||
        !ticketData
      ) {
        setTicket(null);

        setError(
          ticketError?.message ??
            "Ticket tidak ditemukan."
        );

        setLoading(false);
        return;
      }

      let duplicateTicketNumber: string | null = null;

      if (ticketData.duplicate_of) {
        const {
          data: duplicateData,
          error: duplicateError,
        } = await supabase
          .from("tickets")
          .select("ticket_number")
          .eq(
            "id",
            ticketData.duplicate_of
          )
          .maybeSingle();

        if (duplicateError) {
          console.error(
            "Failed to load duplicate ticket:",
            duplicateError
          );
        } else {
          duplicateTicketNumber =
            duplicateData?.ticket_number ??
            null;
        }
      }

      const [
        commentsResult,
        historyResult,
        attachmentsResult,
        adminResult,
      ] = await Promise.all([
        supabase
          .from("ticket_comments")
          .select(`
            id,
            comment,
            is_internal,
            created_at,
            user:profiles(name,role)
          `)
          .eq(
            "ticket_id",
            ticketId
          )
          .order(
            "created_at"
          ),

        supabase
          .from("ticket_history")
          .select(`
            id,
            action,
            old_value,
            new_value,
            description,
            created_at,
            user:profiles(name)
          `)
          .eq(
            "ticket_id",
            ticketId
          )
          .order(
            "created_at",
            {
              ascending: false,
            }
          ),

        supabase
          .from(
            "ticket_attachments"
          )
          .select(`
            id,
            comment_id,
            file_name,
            storage_path,
            file_type,
            file_size,
            created_at
          `)
          .eq(
            "ticket_id",
            ticketId
          )
          .order(
            "created_at"
          ),

        isIT
          ? supabase
              .from(
                "profiles"
              )
              .select(
                "id,name,role"
              )
              .in(
                "role",
                ["IT", "ADMIN"]
              )
              .eq(
                "is_active",
                true
              )
              .order(
                "name"
              )
          : Promise.resolve({
              data: [],
              error: null,
            }),
      ]);

      const rawAttachments =
        (attachmentsResult.data ??
          []) as AttachmentRow[];

      const links =
        await Promise.all(
          rawAttachments.map(
            async (
              attachment
            ) => {
              const {
                data,
              } =
                await supabase.storage
                  .from(
                    "ticket-attachments"
                  )
                  .createSignedUrl(
                    attachment.storage_path,
                    60 * 60
                  );

              return {
                id:
                  attachment.id,
                comment_id:
                  attachment.comment_id,
                file_name:
                  attachment.file_name,
                file_type:
                  attachment.file_type,
                file_size:
                  attachment.file_size,
                url:
                  data?.signedUrl ??
                  "",
              };
            }
          )
        );

      setTicket({
        ...(ticketData as unknown as Ticket),
        duplicate_ticket_number:
          duplicateTicketNumber,
      });

      setComments(
        (commentsResult.data ??
          []) as unknown as CommentRow[]
      );

      setHistory(
        (historyResult.data ??
          []) as unknown as HistoryRow[]
      );

      const validLinks =
        links.filter(
          (item) =>
            Boolean(item.url)
        );

      setAttachments(
        validLinks.filter(
          (item) =>
            !item.comment_id
        )
      );

      const groupedConversationAttachments: Record<
        string,
        PreviewAttachment[]
      > = {};

      for (const item of validLinks) {
        if (!item.comment_id) {
          continue;
        }

        groupedConversationAttachments[
          item.comment_id
        ] ??= [];

        groupedConversationAttachments[
          item.comment_id
        ].push(item);
      }

      setCommentAttachments(
        groupedConversationAttachments
      );

      setItUsers(
        (
          adminResult.data ??
          []
        ).map(
          (user) => ({
            id: String(
              user.id
            ),
            name: String(
              user.name ??
                "Admin"
            ),
            role: String(
              user.role ??
                "ADMIN"
            ),
          })
        )
      );

      if (
        commentsResult.error ||
        historyResult.error ||
        attachmentsResult.error ||
        adminResult.error
      ) {
        console.error(
          "Some ticket detail data failed:",
          commentsResult.error,
          historyResult.error,
          attachmentsResult.error,
          adminResult.error
        );
        setError(
          "Sebagian informasi ticket belum berhasil dimuat. Coba muat ulang jika Conversation, attachment, atau audit belum lengkap."
        );
      }

      setLoading(false);
    },
    [isIT, ticketId]
  );

  useEffect(() => {
    void load().catch((loadError) => {
      console.error("Failed to load ticket detail:", loadError);
      setError(
        friendlyErrorMessage(
          loadError,
          "Detail ticket tidak dapat dimuat. Silakan coba lagi."
        )
      );
      setLoading(false);
    });
  }, [load]);

  return (
    <AppShell profile={profile}>
      {loading && !ticket ? (
        <div className="card muted">
          Memuat detail ticket...
        </div>
      ) : error && !ticket ? (
        <ErrorState
          title="Detail ticket tidak dapat dimuat"
          message={error}
          onRetry={() => void load()}
        />
      ) : ticket ? (
        <>
          <div className="topbar">
            <div>
              <div
                className="muted"
                style={{
                  fontWeight: 700,
                  fontSize: 13,
                }}
              >
                {ticket.ticket_number}
              </div>

              <h1
                className="page-title"
                style={{
                  marginTop: 4,
                }}
              >
                {ticket.title}
              </h1>
            </div>

            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
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

              <SlaBadge
                value={getSlaState(
                  ticket
                )}
              />
            </div>
          </div>

          {error && (
            <div className="alert alert-error ticket-detail-warning">
              <span>{error}</span>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => void load()}
                disabled={loading}
              >
                {loading ? "Memuat..." : "Coba Lagi"}
              </button>
            </div>
          )}

          <div className="grid-2">
            <div
              style={{
                display: "grid",
                gap: 18,
              }}
            >
              <section className="card">
                <h2 className="section-title">
                  Problem Description
                </h2>

                <p
                  style={{
                    whiteSpace:
                      "pre-wrap",
                    lineHeight: 1.65,
                    margin: 0,
                  }}
                >
                  {
                    ticket.description
                  }
                </p>
              </section>

              {ticket.resolution_note && (
                <section className="card resolution-note-card">
                  <h2 className="section-title">
                    Resolution Note
                  </h2>

                  <p className="resolution-note-text">
                    {ticket.resolution_note}
                  </p>
                </section>
              )}

              {ticket.status === "CANCELLED" && (
                <section className="card cancelled-ticket-card">
                  <h2 className="section-title">Ticket Dibatalkan</h2>
                  <p className="cancelled-ticket-reason">
                    {ticket.cancel_reason || "Ticket dibatalkan."}
                  </p>
                  <div className="cancelled-ticket-meta">
                    {ticket.cancelled_at && (
                      <span>{localDate(ticket.cancelled_at)}</span>
                    )}
                    {ticket.canceller && (
                      <span>oleh {relationName(ticket.canceller)}</span>
                    )}
                    {ticket.duplicate_of && (
                      <span>
                        duplikat dari{" "}
                        {ticket.duplicate_ticket_number ??
                          "ticket terkait"}
                      </span>
                    )}
                  </div>
                </section>
              )}

              <section className="card">
                <h2 className="section-title">
                  Attachments
                </h2>

                <AttachmentPreviewGallery
                  attachments={
                    attachments
                  }
                />
              </section>

              <section className="card">
                <h2 className="section-title">
                  Conversation
                </h2>

                <div
                  style={{
                    display: "grid",
                    gap: 10,
                    marginBottom: 16,
                  }}
                >
                  {comments.length ===
                  0 ? (
                    <div className="muted">
                      Belum ada
                      komentar.
                    </div>
                  ) : (
                    comments.map(
                      (
                        comment
                      ) => {
                        const user =
                          commentUser(
                            comment.user
                          );

                        return (
                          <div
                            className="comment"
                            key={
                              comment.id
                            }
                          >
                            <div className="comment-head">
                              <span className="comment-author-line">
                                <span>
                                  <strong>
                                    {user?.name ??
                                      "User"}
                                  </strong>

                                  {" · "}

                                  {user?.role ===
                                    "ADMIN" ||
                                  user?.role ===
                                    "IT"
                                    ? "IT"
                                    : relationName(
                                        ticket.department,
                                        "Staff"
                                      )}
                                </span>

                                {comment.is_internal && (
                                  <span className="internal-note-badge">
                                    Internal
                                    Note
                                  </span>
                                )}
                              </span>

                              <span>
                                {localDate(
                                  comment.created_at
                                )}
                              </span>
                            </div>

                            <div
                              style={{
                                whiteSpace:
                                  "pre-wrap",
                              }}
                            >
                              {
                                comment.comment
                              }
                            </div>

                            {(commentAttachments[
                              comment.id
                            ]?.length ??
                              0) >
                              0 && (
                              <div className="conversation-attachment-gallery">
                                <AttachmentPreviewGallery
                                  attachments={
                                    commentAttachments[
                                      comment.id
                                    ]
                                  }
                                />
                              </div>
                            )}
                          </div>
                        );
                      }
                    )
                  )}
                </div>

                <TicketActions
                  key={`${ticket.status}-${ticket.assigned_to ?? ""}`}
                  ticketId={
                    ticket.id
                  }
                  currentStatus={
                    ticket.status
                  }
                  currentAssignee={
                    ticket.assigned_to
                  }
                  currentResolutionNote={
                    ticket.resolution_note
                  }
                  currentFirstResponseAt={
                    ticket.first_response_at
                  }
                  isIT={isIT}
                  canReopen={
                    isIT ||
                    ticket.created_by ===
                      profile.id
                  }
                  canCancel={
                    isIT ||
                    (ticket.created_by === profile.id &&
                      !ticket.first_response_at &&
                      ["OPEN", "ASSIGNED"].includes(ticket.status))
                  }
                  itUsers={
                    itUsers
                  }
                  userId={
                    profile.id
                  }
                  onUpdated={
                    load
                  }
                />
              </section>
            </div>

            <div
              style={{
                display: "grid",
                gap: 18,
                alignContent:
                  "start",
              }}
            >
              <section className="card">
                <h2 className="section-title">
                  Ticket Information
                </h2>

                <div
                  style={{
                    display: "grid",
                    gap: 0,
                  }}
                >
                  {/* PELAPOR */}
                  <div
                    style={{
                      padding: "4px 0 18px",
                      borderBottom: "1px solid #e8edf3",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 800,
                        color: "#111827",
                        marginBottom: 10,
                      }}
                    >
                      Pelapor
                    </div>

                    <div
                      style={{
                        fontSize: 15,
                        fontWeight: 700,
                        color: "#111827",
                      }}
                    >
                      {relationName(
                        ticket.reporter,
                        "-"
                      )}
                    </div>

                    <div
                      style={{
                        marginTop: 3,
                        fontSize: 13,
                        color: "#64748b",
                      }}
                    >
                      {relationName(
                        ticket.department,
                        "-"
                      )}
                    </div>
                  </div>

                  {/* LOCATION */}
                  <div
                    style={{
                      padding: "18px 0",
                      borderBottom: "1px solid #e8edf3",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 800,
                        color: "#111827",
                        marginBottom: 12,
                      }}
                    >
                      Location
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gap: 12,
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            color: "#94a3b8",
                            marginBottom: 3,
                          }}
                        >
                          Property
                        </div>

                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: "#1e293b",
                          }}
                        >
                          {ticket.property_id
                            ? relationName(
                                ticket.property
                              )
                            : "Tidak ditentukan"}
                        </div>
                      </div>

                      <div>
                        <div
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            color: "#94a3b8",
                            marginBottom: 3,
                          }}
                        >
                          Area
                        </div>

                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: "#1e293b",
                          }}
                        >
                          {ticket.area_id
                            ? relationName(
                                ticket.area
                              )
                            : "Tidak ditentukan"}
                        </div>
                      </div>

                      <div>
                        <div
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            color: "#94a3b8",
                            marginBottom: 3,
                          }}
                        >
                          Location Detail
                        </div>

                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: "#1e293b",
                            overflowWrap: "anywhere",
                          }}
                        >
                          {ticket.location ||
                            "Tidak ditentukan"}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* TICKET */}
                  <div
                    style={{
                      padding: "18px 0",
                      borderBottom: "1px solid #e8edf3",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 800,
                        color: "#111827",
                        marginBottom: 10,
                      }}
                    >
                      Ticket
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gap: 9,
                      }}
                    >
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "minmax(90px, 0.8fr) minmax(0, 1.2fr)",
                          gap: 14,
                          alignItems: "start",
                        }}
                      >
                        <span
                          style={{
                            fontSize: 12,
                            color: "#64748b",
                          }}
                        >
                          Category
                        </span>

                        <strong
                          style={{
                            fontSize: 12,
                            color: "#1e293b",
                            overflowWrap: "anywhere",
                          }}
                        >
                          {relationName(
                            ticket.category,
                            "-"
                          )}
                        </strong>
                      </div>

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "minmax(90px, 0.8fr) minmax(0, 1.2fr)",
                          gap: 14,
                          alignItems: "start",
                        }}
                      >
                        <span
                          style={{
                            fontSize: 12,
                            color: "#64748b",
                          }}
                        >
                          Assigned to
                        </span>

                        <strong
                          style={{
                            fontSize: 12,
                            color: "#1e293b",
                            overflowWrap: "anywhere",
                          }}
                        >
                          {relationName(
                            ticket.assignee,
                            "Unassigned"
                          )}
                        </strong>
                      </div>

                      {ticket.device_name && (
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "minmax(90px, 0.8fr) minmax(0, 1.2fr)",
                            gap: 14,
                            alignItems: "start",
                          }}
                        >
                          <span
                            style={{
                              fontSize: 12,
                              color: "#64748b",
                            }}
                          >
                            Legacy Device
                          </span>

                          <strong
                            style={{
                              fontSize: 12,
                              color: "#1e293b",
                              overflowWrap: "anywhere",
                            }}
                          >
                            {ticket.device_name}
                          </strong>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* WAKTU */}
                  <div
                    style={{
                      padding: "18px 0",
                      borderBottom: "1px solid #e8edf3",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 800,
                        color: "#111827",
                        marginBottom: 10,
                      }}
                    >
                      Waktu
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gap: 9,
                      }}
                    >
                      {[
                        [
                          "Created",
                          localDate(
                            ticket.created_at
                          ),
                        ],
                        [
                          "Updated",
                          localDate(
                            ticket.updated_at
                          ),
                        ],
                        [
                          "First Response",
                          ticket.first_response_at
                            ? localDate(
                                ticket.first_response_at
                              )
                            : "Belum direspons",
                        ],
                        [
                          "Response Time",
                          ticket.first_response_at
                            ? formatDuration(
                                durationMs(
                                  ticket.created_at,
                                  ticket.first_response_at
                                )
                              )
                            : "-",
                        ],
                        [
                          "Resolution Time",
                          ticket.status ===
                          "CANCELLED"
                            ? "-"
                            : formatDuration(
                                durationMs(
                                  ticket.created_at,
                                  ticket.finished_at
                                )
                              ),
                        ],
                      ].map(
                        ([label, value]) => (
                          <div
                            key={label}
                            style={{
                              display: "grid",
                              gridTemplateColumns: "minmax(90px, 0.8fr) minmax(0, 1.2fr)",
                              gap: 14,
                              alignItems: "start",
                            }}
                          >
                            <span
                              style={{
                                fontSize: 12,
                                color: "#64748b",
                              }}
                            >
                              {label}
                            </span>

                            <strong
                              style={{
                                fontSize: 12,
                                color: "#1e293b",
                                overflowWrap: "anywhere",
                              }}
                            >
                              {value}
                            </strong>
                          </div>
                        )
                      )}
                    </div>
                  </div>

                  {/* TARGET WAKTU */}
                  <div
                    style={{
                      padding: "18px 0",
                      borderBottom:
                        ticket.status === "CANCELLED" ||
                        ticket.reopen_count > 0
                          ? "1px solid #e8edf3"
                          : "0",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 800,
                        color: "#111827",
                        marginBottom: 12,
                      }}
                    >
                      Target Waktu
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gap: 12,
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            color: "#94a3b8",
                            marginBottom: 4,
                          }}
                        >
                          Respons
                        </div>

                        <strong
                          style={{
                            display: "block",
                            fontSize: 12,
                            lineHeight: 1.5,
                            color: "#1e293b",
                          }}
                        >
                          {ticket.status ===
                          "CANCELLED"
                            ? "Dibatalkan"
                            : ticket.first_response_at
                              ? `Sesuai target · ${localDate(
                                  ticket.first_response_at
                                )}`
                              : ticket.sla_response_due_at
                                ? `${localDate(
                                    ticket.sla_response_due_at
                                  )} · ${formatDueDistance(
                                    ticket.sla_response_due_at
                                  )}`
                                : "-"}
                        </strong>
                      </div>

                      <div>
                        <div
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            color: "#94a3b8",
                            marginBottom: 4,
                          }}
                        >
                          Selesai
                        </div>

                        <strong
                          style={{
                            display: "block",
                            fontSize: 12,
                            lineHeight: 1.5,
                            color: "#1e293b",
                          }}
                        >
                          {ticket.status ===
                            "CANCELLED" &&
                          ticket.cancelled_at
                            ? `Dibatalkan · ${localDate(
                                ticket.cancelled_at
                              )}`
                            : ticket.finished_at
                              ? `Selesai · ${localDate(
                                  ticket.finished_at
                                )}`
                              : ticket.sla_resolution_due_at
                                ? `${localDate(
                                    ticket.sla_resolution_due_at
                                  )} · ${formatDueDistance(
                                    ticket.sla_resolution_due_at
                                  )}`
                                : "-"}
                        </strong>
                      </div>
                    </div>
                  </div>

                  {/* PEMBATALAN */}
                  {ticket.status === "CANCELLED" && (
                    <div
                      style={{
                        padding: "18px 0",
                        borderBottom:
                          ticket.reopen_count > 0
                            ? "1px solid #e8edf3"
                            : "0",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 800,
                          color: "#111827",
                          marginBottom: 10,
                        }}
                      >
                        Pembatalan
                      </div>

                      <div
                        style={{
                          display: "grid",
                          gap: 9,
                        }}
                      >
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "minmax(90px, 0.8fr) minmax(0, 1.2fr)",
                            gap: 14,
                          }}
                        >
                          <span
                            style={{
                              fontSize: 12,
                              color: "#64748b",
                            }}
                          >
                            Alasan
                          </span>

                          <strong
                            style={{
                              fontSize: 12,
                              color: "#1e293b",
                              overflowWrap: "anywhere",
                            }}
                          >
                            {ticket.cancel_reason ||
                              "-"}
                          </strong>
                        </div>

                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "minmax(90px, 0.8fr) minmax(0, 1.2fr)",
                            gap: 14,
                          }}
                        >
                          <span
                            style={{
                              fontSize: 12,
                              color: "#64748b",
                            }}
                          >
                            Dibatalkan
                          </span>

                          <strong
                            style={{
                              fontSize: 12,
                              color: "#1e293b",
                            }}
                          >
                            {ticket.cancelled_at
                              ? localDate(
                                  ticket.cancelled_at
                                )
                              : "-"}
                          </strong>
                        </div>

                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "minmax(90px, 0.8fr) minmax(0, 1.2fr)",
                            gap: 14,
                          }}
                        >
                          <span
                            style={{
                              fontSize: 12,
                              color: "#64748b",
                            }}
                          >
                            Oleh
                          </span>

                          <strong
                            style={{
                              fontSize: 12,
                              color: "#1e293b",
                            }}
                          >
                            {relationName(
                              ticket.canceller,
                              "-"
                            )}
                          </strong>
                        </div>

                        {ticket.duplicate_of && (
                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns: "minmax(90px, 0.8fr) minmax(0, 1.2fr)",
                              gap: 14,
                            }}
                          >
                            <span
                              style={{
                                fontSize: 12,
                                color: "#64748b",
                              }}
                            >
                              Duplicate Of
                            </span>

                            <strong
                              style={{
                                fontSize: 12,
                                color: "#1e293b",
                              }}
                            >
                              {ticket.duplicate_ticket_number ??
                                "Ticket terkait"}
                            </strong>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* REOPEN */}
                  {ticket.reopen_count > 0 && (
                    <div
                      style={{
                        padding: "18px 0 0",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 800,
                          color: "#111827",
                          marginBottom: 10,
                        }}
                      >
                        Reopen
                      </div>

                      <div
                        style={{
                          display: "grid",
                          gap: 9,
                        }}
                      >
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "minmax(90px, 0.8fr) minmax(0, 1.2fr)",
                            gap: 14,
                          }}
                        >
                          <span
                            style={{
                              fontSize: 12,
                              color: "#64748b",
                            }}
                          >
                            Total Reopen
                          </span>

                          <strong
                            style={{
                              fontSize: 12,
                              color: "#1e293b",
                            }}
                          >
                            {ticket.reopen_count}
                          </strong>
                        </div>

                        {ticket.reopened_at && (
                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns: "minmax(90px, 0.8fr) minmax(0, 1.2fr)",
                              gap: 14,
                            }}
                          >
                            <span
                              style={{
                                fontSize: 12,
                                color: "#64748b",
                              }}
                            >
                              Terakhir
                            </span>

                            <strong
                              style={{
                                fontSize: 12,
                                color: "#1e293b",
                              }}
                            >
                              {localDate(
                                ticket.reopened_at
                              )}
                            </strong>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </section>

              <section className="card">
                <h2 className="section-title">
                  Audit Timeline
                </h2>

                <div className="timeline">
                  {history.length ===
                  0 ? (
                    <div className="muted">
                      Belum ada
                      aktivitas.
                    </div>
                  ) : (
                    history.map(
                      (item) => (
                        <div
                          className="timeline-item"
                          key={
                            item.id
                          }
                        >
                          <div className="timeline-description">
                            <strong>
                              {relationName(
                                item.user,
                                "System"
                              )}
                            </strong>

                            {" "}

                            {historyText(
                              item
                            )}
                          </div>

                          <div
                            className="timeline-time"
                            style={{
                              marginTop:
                                4,
                            }}
                          >
                            {localDate(
                              item.created_at
                            )}
                          </div>
                        </div>
                      )
                    )
                  )}
                </div>
              </section>
            </div>
          </div>
        </>
      ) : null}
    </AppShell>
  );
}