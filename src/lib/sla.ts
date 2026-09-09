export type SlaState =
  | "OVERDUE_RESPONSE"
  | "OVERDUE_RESOLUTION"
  | "ON_TRACK"
  | "DONE";

export function durationMs(
  start: string | null,
  end: string | null
) {
  if (!start || !end) return null;

  const startMs = new Date(start).getTime();
  const endMs = new Date(end).getTime();

  if (
    Number.isNaN(startMs) ||
    Number.isNaN(endMs) ||
    endMs < startMs
  ) {
    return null;
  }

  return endMs - startMs;
}

export function formatDuration(
  milliseconds: number | null
) {
  if (milliseconds === null || milliseconds < 0) {
    return "-";
  }

  const totalMinutes = Math.max(
    0,
    Math.round(milliseconds / 60000)
  );

  if (totalMinutes < 60) return `${totalMinutes} menit`;

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours < 24) {
    return minutes > 0
      ? `${hours} jam ${minutes} menit`
      : `${hours} jam`;
  }

  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;

  return remainingHours > 0
    ? `${days} hari ${remainingHours} jam`
    : `${days} hari`;
}

export function averageDuration(
  values: Array<number | null>
) {
  const valid = values.filter(
    (value): value is number =>
      typeof value === "number" &&
      Number.isFinite(value) &&
      value >= 0
  );

  if (valid.length === 0) return null;

  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

export function isDoneStatus(status: string) {
  const value = String(status || "").toUpperCase();
  return value === "RESOLVED" || value === "CLOSED";
}

export function getSlaState(ticket: {
  status: string;
  first_response_at?: string | null;
  finished_at?: string | null;
  sla_response_due_at?: string | null;
  sla_resolution_due_at?: string | null;
}, now = Date.now()): SlaState {
  if (isDoneStatus(ticket.status) || ticket.finished_at) {
    return "DONE";
  }

  const resolutionDue = ticket.sla_resolution_due_at
    ? new Date(ticket.sla_resolution_due_at).getTime()
    : Number.NaN;

  if (
    !ticket.finished_at &&
    Number.isFinite(resolutionDue) &&
    resolutionDue < now
  ) {
    return "OVERDUE_RESOLUTION";
  }

  const responseDue = ticket.sla_response_due_at
    ? new Date(ticket.sla_response_due_at).getTime()
    : Number.NaN;

  if (
    !ticket.first_response_at &&
    Number.isFinite(responseDue) &&
    responseDue < now
  ) {
    return "OVERDUE_RESPONSE";
  }

  return "ON_TRACK";
}

export function formatDueDistance(
  dueAt: string | null | undefined,
  now = Date.now()
) {
  if (!dueAt) return "-";
  const due = new Date(dueAt).getTime();
  if (!Number.isFinite(due)) return "-";

  const delta = due - now;
  const label = formatDuration(Math.abs(delta));
  return delta < 0 ? `${label} overdue` : `${label} tersisa`;
}
