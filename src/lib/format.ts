export function formatDateTime(
  value: string | null
) {
  if (!value) return "-";

  return new Date(value).toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function localDate(value: string) {
  return new Date(value).toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function problemSummary(
  value: string,
  max = 55
) {
  const clean = String(value || "").trim();
  if (!clean) return "-";
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max).trim()}...`;
}

export function toInputDate(date: Date) {
  const year = date.getFullYear();
  const month = String(
    date.getMonth() + 1
  ).padStart(2, "0");
  const day = String(
    date.getDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}
