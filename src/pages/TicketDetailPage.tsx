import {
  useCallback,
  useEffect,
  useState,
} from "react";

import { AppShell } from "../components/AppShell";
import { AttachmentPreviewGallery } from "../components/attachment-preview-gallery";
import {
  PriorityBadge,
  SlaBadge,
  StatusBadge,
} from "../components/status-badge";
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
  sla_response_due_at: string | null;
  sla_resolution_due_at: string | null;
  category: NamedRelation;
  department: NamedRelation;
  reporter: NamedRelation;
  assignee: NamedRelation;
};

type CommentUser = {
  name?: string;
  role?: string;
};

type CommentRow = {
  id: string;
  comment: string;
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

  return status || "-";
}

function historyText(
  item: HistoryRow
) {
  switch (item.action) {
    case "TICKET_CREATED":
      return "membuat ticket";

    case "COMMENT_ADDED":
      return "menambahkan komentar";

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

    case "RESOLUTION_NOTE_UPDATED":
      return "memperbarui Resolution Note";

    case "CATEGORY_CHANGED":
      return "mengubah category ticket";

    case "DEPARTMENT_CHANGED":
      return "mengubah department ticket";

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
    useState<Ticket | null>(
      null
    );
  const [comments, setComments] =
    useState<CommentRow[]>([]);
  const [history, setHistory] =
    useState<HistoryRow[]>([]);
  const [
    attachments,
    setAttachments,
  ] =
    useState<
      PreviewAttachment[]
    >([]);
  const [itUsers, setItUsers] =
    useState<AdminUser[]>([]);
  const [
    commentAttachments,
    setCommentAttachments,
  ] = useState<Record<string, PreviewAttachment[]>>({});
  const [loading, setLoading] =
    useState(true);
  const [error, setError] =
    useState<string | null>(null);

  const load =
    useCallback(
      async () => {
        setLoading(true);
        setError(null);

        const {
          data:
            ticketData,
          error:
            ticketError,
        } =
          await supabase
            .from("tickets")
            .select(`
              *,
              category:ticket_categories(name),
              department:departments(name),
              reporter:profiles!tickets_created_by_fkey(name,email),
              assignee:profiles!tickets_assigned_to_fkey(name,email)
            `)
            .eq(
              "id",
              ticketId
            )
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

        const [
          commentsResult,
          historyResult,
          attachmentsResult,
          adminResult,
        ] =
          await Promise.all([
            supabase
              .from(
                "ticket_comments"
              )
              .select(`
                id,
                comment,
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
              .from(
                "ticket_history"
              )
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
                  ascending:
                    false,
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
                  id: attachment.id,
                  comment_id: attachment.comment_id,
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

        setTicket(
          ticketData as unknown as Ticket
        );
        setComments(
          (commentsResult.data ??
            []) as unknown as CommentRow[]
        );
        setHistory(
          (historyResult.data ??
            []) as unknown as HistoryRow[]
        );
        const validLinks = links.filter((item) => Boolean(item.url));
        setAttachments(
          validLinks.filter((item) => !item.comment_id)
        );

        const groupedConversationAttachments: Record<
          string,
          PreviewAttachment[]
        > = {};
        for (const item of validLinks) {
          if (!item.comment_id) continue;
          groupedConversationAttachments[item.comment_id] ??= [];
          groupedConversationAttachments[item.comment_id].push(item);
        }
        setCommentAttachments(groupedConversationAttachments);
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
        }

        setLoading(false);
      },
      [isIT, ticketId]
    );

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <AppShell profile={profile}>
      {loading && !ticket ? (
        <div className="card muted">
          Memuat detail ticket...
        </div>
      ) : error &&
        !ticket ? (
        <div className="alert alert-error">
          {error}
        </div>
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
                {
                  ticket.ticket_number
                }
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
                flexWrap:
                  "wrap",
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
                value={getSlaState(ticket)}
              />
            </div>
          </div>

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
                    lineHeight:
                      1.65,
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
                    display:
                      "grid",
                    gap: 10,
                    marginBottom:
                      16,
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
                              <span>
                                <strong>
                                  {user?.name ??
                                    "User"}
                                </strong>
                                {" · "}
                                {user?.role === "ADMIN" ||
                                user?.role === "IT"
                                  ? "IT"
                                  : relationName(
                                      ticket.department,
                                      "Staff"
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
                              {comment.comment}
                            </div>

                            {(commentAttachments[comment.id]?.length ?? 0) > 0 && (
                              <div className="conversation-attachment-gallery">
                                <AttachmentPreviewGallery
                                  attachments={commentAttachments[comment.id]}
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
                  isIT={isIT}
                  canReopen={
                    isIT ||
                    ticket.created_by === profile.id
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

                <dl className="kv">
                  <dt>
                    Category
                  </dt>
                  <dd>
                    {relationName(
                      ticket.category
                    )}
                  </dd>

                  <dt>
                    Department
                  </dt>
                  <dd>
                    {relationName(
                      ticket.department
                    )}
                  </dd>

                  <dt>
                    Location
                  </dt>
                  <dd>
                    {ticket.location ||
                      "-"}
                  </dd>

                  <dt>Device</dt>
                  <dd>
                    {ticket.device_name ||
                      "-"}
                  </dd>

                  <dt>
                    Reported by
                  </dt>
                  <dd>
                    {relationName(
                      ticket.reporter
                    )}
                  </dd>

                  <dt>
                    Assigned to
                  </dt>
                  <dd>
                    {relationName(
                      ticket.assignee,
                      "Unassigned"
                    )}
                  </dd>

                  <dt>Created</dt>
                  <dd>
                    {localDate(
                      ticket.created_at
                    )}
                  </dd>

                  <dt>Updated</dt>
                  <dd>
                    {localDate(
                      ticket.updated_at
                    )}
                  </dd>

                  <dt>
                    First Response
                  </dt>
                  <dd>
                    {ticket.first_response_at
                      ? localDate(
                          ticket.first_response_at
                        )
                      : "Belum direspons"}
                  </dd>

                  <dt>
                    Response Time
                  </dt>
                  <dd>
                    {ticket.first_response_at
                      ? formatDuration(
                          durationMs(
                            ticket.created_at,
                            ticket.first_response_at
                          )
                        )
                      : "-"}
                  </dd>

                  <dt>
                    Resolution Time
                  </dt>
                  <dd>
                    {formatDuration(
                      durationMs(
                        ticket.created_at,
                        ticket.finished_at
                      )
                    )}
                  </dd>

                  <dt>
                    Response SLA
                  </dt>
                  <dd>
                    {ticket.first_response_at
                      ? `Met · ${localDate(ticket.first_response_at)}`
                      : ticket.sla_response_due_at
                        ? `${localDate(ticket.sla_response_due_at)} · ${formatDueDistance(
                            ticket.sla_response_due_at
                          )}`
                        : "-"}
                  </dd>

                  <dt>
                    Resolution SLA
                  </dt>
                  <dd>
                    {ticket.finished_at
                      ? `Complete · ${localDate(ticket.finished_at)}`
                      : ticket.sla_resolution_due_at
                        ? `${localDate(ticket.sla_resolution_due_at)} · ${formatDueDistance(
                            ticket.sla_resolution_due_at
                          )}`
                        : "-"}
                  </dd>

                  <dt>
                    Reopen Count
                  </dt>
                  <dd>
                    {ticket.reopen_count || 0}
                    {ticket.reopened_at
                      ? ` · terakhir ${localDate(ticket.reopened_at)}`
                      : ""}
                  </dd>
                </dl>
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
