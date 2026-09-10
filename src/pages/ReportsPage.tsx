import {
  CalendarDays,
  Eye,
  FileDown,
  LoaderCircle,
} from "lucide-react";
import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  PDFDocument,
  StandardFonts,
  rgb,
} from "pdf-lib";

import { AppShell } from "../components/AppShell";
import { StatusBadge } from "../components/status-badge";
import {
  formatDateTime,
  problemSummary,
  toInputDate,
} from "../lib/format";
import { supabase } from "../lib/supabase";
import {
  averageDuration,
  durationMs,
  formatDuration,
} from "../lib/sla";
import {
  relationName,
  type NamedRelation,
  type Profile,
} from "../lib/types";
import { Link } from "../router/Router";

type FinishedTicket = {
  id: string;
  ticket_number: string;
  description: string;
  priority: string;
  created_at: string;
  first_response_at: string | null;
  finished_at: string | null;
  category: NamedRelation;
  department: NamedRelation;
  reporter: NamedRelation;
  assignee: NamedRelation;
};

function safeText(value: unknown) {
  return String(value ?? "-")
    .replace(
      /[^\x20-\x7E\xA0-\xFF]/g,
      "?"
    )
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(
  value: unknown,
  max: number
) {
  const text = safeText(value);

  if (text.length <= max) {
    return text;
  }

  return `${text
    .slice(0, max - 3)
    .trim()}...`;
}

function validatePeriod(
  from: string,
  to: string
) {
  if (!from || !to) {
    return "Tanggal awal dan tanggal akhir wajib diisi.";
  }

  const fromDate =
    new Date(
      `${from}T00:00:00`
    );

  const toDate =
    new Date(
      `${to}T23:59:59`
    );

  if (fromDate > toDate) {
    return "Tanggal awal tidak boleh melebihi tanggal akhir.";
  }

  const differenceDays =
    Math.ceil(
      (toDate.getTime() -
        fromDate.getTime()) /
        (1000 *
          60 *
          60 *
          24)
    ) + 1;

  if (differenceDays > 366) {
    return "Maksimal periode adalah 1 tahun.";
  }

  return null;
}

async function generatePdf(
  tickets: FinishedTicket[],
  from: string,
  to: string,
  previewWindow: Window | null
) {
  const pdfDoc =
    await PDFDocument.create();

  const regular =
    await pdfDoc.embedFont(
      StandardFonts.Helvetica
    );

  const bold =
    await pdfDoc.embedFont(
      StandardFonts.HelveticaBold
    );

  const pageWidth = 841.89;
  const pageHeight = 595.28;
  const margin = 34;

  const columns = [
    {
      label: "No",
      width: 24,
    },
    {
      label: "Kode Ticket",
      width: 105,
    },
    {
      label: "Category",
      width: 72,
    },
    {
      label: "Kendala",
      width: 176,
    },
    {
      label: "Reporter",
      width: 62,
    },
    {
      label: "Assigned",
      width: 62,
    },
    {
      label: "Priority",
      width: 50,
    },
    {
      label: "Dibuat",
      width: 83,
    },
    {
      label: "Selesai",
      width: 83,
    },
  ];

  const rowHeight = 25;
  const headerHeight = 25;

  function drawPageHeader(
    page: ReturnType<
      typeof pdfDoc.addPage
    >,
    pageNumber: number
  ) {
    page.drawText(
      "HOTEL IT HELPDESK",
      {
        x: margin,
        y:
          pageHeight -
          margin,
        size: 15,
        font: bold,
        color: rgb(
          0.09,
          0.23,
          0.4
        ),
      }
    );

    page.drawText(
      "FINISHED TICKET REPORT",
      {
        x: margin,
        y:
          pageHeight -
          margin -
          20,
        size: 11,
        font: bold,
        color: rgb(
          0.12,
          0.15,
          0.2
        ),
      }
    );

    page.drawText(
      safeText(
        `Periode: ${from} s/d ${to}`
      ),
      {
        x: margin,
        y:
          pageHeight -
          margin -
          37,
        size: 8.5,
        font: regular,
        color: rgb(
          0.4,
          0.44,
          0.5
        ),
      }
    );

    page.drawText(
      safeText(
        `Total ticket selesai: ${tickets.length}`
      ),
      {
        x: margin,
        y:
          pageHeight -
          margin -
          51,
        size: 8.5,
        font: regular,
        color: rgb(
          0.4,
          0.44,
          0.5
        ),
      }
    );

    const averageResponse =
      averageDuration(
        tickets.map((ticket) =>
          durationMs(
            ticket.created_at,
            ticket.first_response_at
          )
        )
      );

    const averageResolution =
      averageDuration(
        tickets.map((ticket) =>
          durationMs(
            ticket.created_at,
            ticket.finished_at
          )
        )
      );

    page.drawText(
      safeText(
        `Avg response: ${formatDuration(
          averageResponse
        )} | Avg resolution: ${formatDuration(
          averageResolution
        )}`
      ),
      {
        x: margin,
        y:
          pageHeight -
          margin -
          65,
        size: 8.5,
        font: regular,
        color: rgb(
          0.4,
          0.44,
          0.5
        ),
      }
    );

    page.drawText(
      `Page ${pageNumber}`,
      {
        x:
          pageWidth -
          margin -
          38,
        y:
          pageHeight -
          margin,
        size: 8,
        font: regular,
        color: rgb(
          0.45,
          0.48,
          0.54
        ),
      }
    );
  }

  function drawTableHeader(
    page: ReturnType<
      typeof pdfDoc.addPage
    >,
    y: number
  ) {
    page.drawRectangle({
      x: margin,
      y:
        y -
        headerHeight +
        5,
      width:
        pageWidth -
        margin * 2,
      height: headerHeight,
      color: rgb(
        0.94,
        0.96,
        0.98
      ),
    });

    let x = margin;

    for (
      const column of
      columns
    ) {
      page.drawText(
        column.label,
        {
          x: x + 4,
          y: y - 12,
          size: 7.5,
          font: bold,
          color: rgb(
            0.25,
            0.29,
            0.35
          ),
        }
      );

      x += column.width;
    }
  }

  let pageNumber = 1;
  let page =
    pdfDoc.addPage([
      pageWidth,
      pageHeight,
    ]);

  drawPageHeader(
    page,
    pageNumber
  );

  let y =
    pageHeight -
    margin -
    92;

  drawTableHeader(
    page,
    y
  );

  y -= headerHeight;

  for (
    let index = 0;
    index < tickets.length;
    index++
  ) {
    if (
      y <
      margin + rowHeight
    ) {
      pageNumber += 1;
      page =
        pdfDoc.addPage([
          pageWidth,
          pageHeight,
        ]);

      drawPageHeader(
        page,
        pageNumber
      );

      y =
        pageHeight -
        margin -
        92;

      drawTableHeader(
        page,
        y
      );

      y -= headerHeight;
    }

    const ticket =
      tickets[index];

    if (
      index % 2 === 1
    ) {
      page.drawRectangle({
        x: margin,
        y:
          y -
          rowHeight +
          6,
        width:
          pageWidth -
          margin * 2,
        height: rowHeight,
        color: rgb(
          0.985,
          0.988,
          0.992
        ),
      });
    }

    const values = [
      String(index + 1),
      truncate(
        ticket.ticket_number,
        19
      ),
      truncate(
        relationName(
          ticket.category
        ),
        13
      ),
      truncate(
        ticket.description,
        36
      ),
      truncate(
        relationName(
          ticket.reporter
        ),
        11
      ),
      truncate(
        relationName(
          ticket.assignee
        ),
        11
      ),
      truncate(
        ticket.priority,
        9
      ),
      truncate(
        formatDateTime(
          ticket.created_at
        ),
        16
      ),
      truncate(
        formatDateTime(
          ticket.finished_at
        ),
        16
      ),
    ];

    let x = margin;

    values.forEach(
      (
        value,
        columnIndex
      ) => {
        page.drawText(
          safeText(value),
          {
            x: x + 4,
            y: y - 10,
            size: 7,
            font:
              columnIndex ===
              1
                ? bold
                : regular,
            color: rgb(
              0.18,
              0.21,
              0.26
            ),
          }
        );

        x +=
          columns[
            columnIndex
          ].width;
      }
    );

    page.drawLine({
      start: {
        x: margin,
        y:
          y -
          rowHeight +
          5,
      },
      end: {
        x:
          pageWidth -
          margin,
        y:
          y -
          rowHeight +
          5,
      },
      thickness: 0.5,
      color: rgb(
        0.9,
        0.92,
        0.94
      ),
    });

    y -= rowHeight;
  }

  const bytes =
    await pdfDoc.save();

  const pdfBuffer =
    new ArrayBuffer(
      bytes.byteLength
    );

  new Uint8Array(
    pdfBuffer
  ).set(bytes);

  const blob =
    new Blob(
      [pdfBuffer],
      {
        type: "application/pdf",
      }
    );

  const url =
    URL.createObjectURL(blob);

  if (previewWindow) {
    previewWindow.location.href =
      url;
  } else {
    const link =
      document.createElement(
        "a"
      );

    link.href = url;
    link.download =
      `finished-ticket-report_${from}_${to}.pdf`;

    document.body.appendChild(
      link
    );

    link.click();
    link.remove();
  }

  window.setTimeout(
    () =>
      URL.revokeObjectURL(
        url
      ),
    60_000
  );
}

export function ReportsPage({
  profile,
}: {
  profile: Profile;
}) {
  const today =
    useMemo(
      () => new Date(),
      []
    );

  const startOfMonth =
    useMemo(
      () =>
        new Date(
          today.getFullYear(),
          today.getMonth(),
          1
        ),
      [today]
    );

  const [from, setFrom] =
    useState(
      toInputDate(
        startOfMonth
      )
    );

  const [to, setTo] =
    useState(
      toInputDate(today)
    );

  const [tickets, setTickets] =
    useState<FinishedTicket[]>(
      []
    );

  const [loading, setLoading] =
    useState(true);

  const [exporting, setExporting] =
    useState(false);

  const [error, setError] =
    useState<string | null>(
      null
    );

  useEffect(() => {
    const validationError =
      validatePeriod(
        from,
        to
      );

    if (validationError) {
      setError(
        validationError
      );
      setTickets([]);
      setLoading(false);
      return;
    }

    let active = true;

    const timeout =
      window.setTimeout(
        async () => {
          setLoading(true);
          setError(null);

          const {
            data,
            error:
              queryError,
          } =
            await supabase
              .from(
                "tickets"
              )
              .select(`
                *,
                department:departments(name),
                category:ticket_categories(name),
                reporter:profiles!tickets_created_by_fkey(name),
                assignee:profiles!tickets_assigned_to_fkey(name)
              `)
              .in(
                "status",
                [
                  "RESOLVED",
                  "CLOSED",
                ]
              )
              .not(
                "finished_at",
                "is",
                null
              )
              .gte(
                "finished_at",
                `${from}T00:00:00+07:00`
              )
              .lte(
                "finished_at",
                `${to}T23:59:59.999+07:00`
              )
              .order(
                "finished_at",
                {
                  ascending:
                    false,
                }
              )
              .limit(500);

          if (!active) {
            return;
          }

          if (queryError) {
            setTickets([]);
            setError(
              queryError.message
            );
          } else {
            setTickets(
              (data ??
                []) as unknown as FinishedTicket[]
            );
          }

          setLoading(false);
        },
        250
      );

    return () => {
      active = false;
      window.clearTimeout(
        timeout
      );
    };
  }, [from, to]);

  const averageResponseTime =
    averageDuration(
      tickets.map((ticket) =>
        durationMs(
          ticket.created_at,
          ticket.first_response_at
        )
      )
    );

  const averageResolutionTime =
    averageDuration(
      tickets.map((ticket) =>
        durationMs(
          ticket.created_at,
          ticket.finished_at
        )
      )
    );

  function setLastDays(
    days: number
  ) {
    const end =
      new Date();
    const start =
      new Date();

    start.setDate(
      end.getDate() -
        (days - 1)
    );

    setFrom(
      toInputDate(start)
    );
    setTo(
      toInputDate(end)
    );
    setError(null);
  }

  function setThisMonth() {
    const end =
      new Date();
    const start =
      new Date(
        end.getFullYear(),
        end.getMonth(),
        1
      );

    setFrom(
      toInputDate(start)
    );
    setTo(
      toInputDate(end)
    );
    setError(null);
  }

  async function submit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const validationError =
      validatePeriod(
        from,
        to
      );

    if (validationError) {
      setError(
        validationError
      );
      return;
    }

    if (
      tickets.length === 0
    ) {
      setError(
        "Tidak ada ticket DONE pada periode yang dipilih."
      );
      return;
    }

    setExporting(true);
    setError(null);

    const previewWindow =
      window.open(
        "",
        "_blank"
      );

    try {
      await generatePdf(
        tickets,
        from,
        to,
        previewWindow
      );
    } catch (pdfError) {
      previewWindow?.close();

      setError(
        pdfError instanceof
        Error
          ? pdfError.message
          : "Gagal membuat PDF."
      );
    } finally {
      setExporting(false);
    }
  }

  return (
    <AppShell profile={profile}>
      <div className="topbar">
        <div>
          <h1 className="page-title">
            Laporan
          </h1>

          <p className="page-subtitle">
            Lihat history problem yang
            telah selesai dan export
            laporan berdasarkan periode
            tertentu.
          </p>
        </div>
      </div>

      <section className="report-metrics-grid">
        <div className="report-metric-card">
          <span>Ticket DONE</span>
          <strong>
            {loading ? "..." : tickets.length}
          </strong>
        </div>

        <div className="report-metric-card">
          <span>Average Response</span>
          <strong>
            {loading
              ? "..."
              : formatDuration(
                  averageResponseTime
                )}
          </strong>
        </div>

        <div className="report-metric-card">
          <span>Average Resolution</span>
          <strong>
            {loading
              ? "..."
              : formatDuration(
                  averageResolutionTime
                )}
          </strong>
        </div>
      </section>

      <div
        style={{
          display: "grid",
          gap: 18,
          width: "100%",
        }}
      >
        <form
          className="card"
          onSubmit={submit}
          style={{
            width: "100%",
          }}
        >
          {error && (
            <div className="alert alert-error">
              {error}
            </div>
          )}

          <div
            style={{
              display: "grid",
              gap: 18,
            }}
          >
            <div>
              <h2 className="section-title">
                Finished Ticket Report
              </h2>

              <p
                className="muted"
                style={{
                  margin:
                    "5px 0 0",
                  lineHeight: 1.6,
                }}
              >
                Pilih periode berdasarkan
                tanggal ticket selesai.
                History ticket DONE akan
                langsung muncul di bawah.
              </p>
            </div>

            <div className="form-grid">
              <div>
                <label
                  className="label"
                  htmlFor="report-from"
                >
                  Dari Tanggal *
                </label>

                <input
                  id="report-from"
                  className="input"
                  type="date"
                  value={from}
                  onChange={(
                    event
                  ) =>
                    setFrom(
                      event.target
                        .value
                    )
                  }
                  required
                />
              </div>

              <div>
                <label
                  className="label"
                  htmlFor="report-to"
                >
                  Sampai Tanggal *
                </label>

                <input
                  id="report-to"
                  className="input"
                  type="date"
                  value={to}
                  onChange={(
                    event
                  ) =>
                    setTo(
                      event.target
                        .value
                    )
                  }
                  required
                />
              </div>
            </div>

            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap:
                  "wrap",
              }}
            >
              <button
                className="btn btn-secondary"
                type="button"
                onClick={() =>
                  setLastDays(
                    7
                  )
                }
              >
                7 Hari
              </button>

              <button
                className="btn btn-secondary"
                type="button"
                onClick={() =>
                  setLastDays(
                    30
                  )
                }
              >
                30 Hari
              </button>

              <button
                className="btn btn-secondary"
                type="button"
                onClick={
                  setThisMonth
                }
              >
                <CalendarDays
                  size={16}
                />
                Bulan Ini
              </button>
            </div>

            <div
              style={{
                display: "flex",
                alignItems:
                  "center",
                justifyContent:
                  "space-between",
                gap: 12,
                flexWrap:
                  "wrap",
              }}
            >
              <div className="muted">
                {loading
                  ? "Memuat history..."
                  : `${tickets.length} ticket DONE ditemukan`}
              </div>

              <button
                className="btn btn-primary"
                type="submit"
                disabled={
                  loading ||
                  exporting ||
                  tickets.length ===
                    0
                }
              >
                <FileDown
                  size={17}
                />
                {exporting
                  ? "Generating..."
                  : "Export PDF"}
              </button>
            </div>
          </div>
        </form>

        <section
          className="card"
          style={{
            width: "100%",
          }}
        >
          <div
            style={{
              marginBottom: 16,
            }}
          >
            <h2 className="section-title">
              History Problem
            </h2>

            <p
              className="muted"
              style={{
                margin:
                  "5px 0 0",
              }}
            >
              Ticket DONE dari {from} sampai {to}.
            </p>
          </div>

          {loading ? (
            <div
              className="muted"
              style={{
                minHeight:
                  160,
                display:
                  "flex",
                alignItems:
                  "center",
                justifyContent:
                  "center",
                gap: 9,
              }}
            >
              <LoaderCircle
                size={18}
              />
              Memuat history
              ticket...
            </div>
          ) : tickets.length ===
            0 ? (
            <div
              className="muted"
              style={{
                minHeight:
                  160,
                display:
                  "flex",
                alignItems:
                  "center",
                justifyContent:
                  "center",
                textAlign:
                  "center",
              }}
            >
              Tidak ada problem yang
              selesai pada periode ini.
            </div>
          ) : (
            <div className="table-wrap">
              <table className="ticket-list-table report-ticket-table responsive-data-table">
                <thead>
                  <tr>
                    <th>No</th>
                    <th>
                      Kode Ticket
                    </th>
                    <th>
                      Category
                    </th>
                    <th>
                      Kendala
                    </th>
                    <th>
                      Reporter
                    </th>
                    <th>
                      Assigned To
                    </th>
                    <th>
                      Tanggal Selesai
                    </th>
                    <th>
                      Status
                    </th>
                    <th className="ticket-action-heading">
                      Aksi
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {tickets.map(
                    (
                      ticket,
                      index
                    ) => (
                      <tr
                        key={
                          ticket.id
                        }
                      >
                        <td className="ticket-row-number" data-label="No">
                          {index +
                            1}
                        </td>

                        <td data-label="Ticket">
                          <span className="ticket-code">
                            {
                              ticket.ticket_number
                            }
                          </span>
                        </td>

                        <td data-label="Category">
                          {relationName(
                            ticket.category
                          )}
                        </td>

                        <td data-label="Kendala">
                          <div
                            className="ticket-problem"
                            title={
                              ticket.description
                            }
                          >
                            {problemSummary(
                              ticket.description,
                              75
                            )}
                          </div>
                        </td>

                        <td data-label="Reporter">
                          {relationName(
                            ticket.reporter
                          )}
                        </td>

                        <td data-label="Assigned To">
                          {relationName(
                            ticket.assignee,
                            "Unassigned"
                          )}
                        </td>

                        <td data-label="Selesai">
                          <span className="ticket-date">
                            {formatDateTime(
                              ticket.finished_at
                            )}
                          </span>
                        </td>

                        <td data-label="Status">
                          <StatusBadge
                            value="CLOSED"
                          />
                        </td>

                        <td data-label="Aksi">
                          <Link
                            to={`/tickets/${ticket.id}`}
                            className="ticket-view-button"
                            title="Lihat detail ticket"
                            aria-label={`Lihat ticket ${ticket.ticket_number}`}
                          >
                            <Eye
                              size={
                                17
                              }
                            />
                          </Link>
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
