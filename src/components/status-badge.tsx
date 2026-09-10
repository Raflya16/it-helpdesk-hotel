type BadgeProps = {
  value: string;
};

/* ======================================================
   PRIORITY BADGE
====================================================== */

export function PriorityBadge({
  value,
}: BadgeProps) {
  const priority =
    String(value || "MEDIUM")
      .trim()
      .toUpperCase();

  let label = priority;
  let className =
    "priority-medium";

  switch (priority) {
    case "LOW":
      label = "LOW";
      className =
        "priority-low";
      break;

    case "MEDIUM":
      label = "MEDIUM";
      className =
        "priority-medium";
      break;

    case "HIGH":
      label = "HIGH";
      className =
        "priority-high";
      break;

    case "CRITICAL":
      label = "CRITICAL";
      className =
        "priority-critical";
      break;

    default:
      label = priority;
      className =
        "priority-medium";
  }

  return (
    <span
      className={`badge ${className}`}
    >
      {label}
    </span>
  );
}

/* ======================================================
   STATUS BADGE
====================================================== */

export function StatusBadge({
  value,
}: BadgeProps) {
  const status =
    String(value || "OPEN")
      .trim()
      .toUpperCase();

  /*
   * Database lama:
   *
   * OPEN
   * ASSIGNED
   * IN_PROGRESS
   * WAITING_USER
   * RESOLVED
   * CLOSED
   *
   * UI baru:
   *
   * WAITING
   * IN PROGRESS
   * DONE
   */

  if (
    status === "OPEN" ||
    status === "ASSIGNED" ||
    status === "WAITING"
  ) {
    return (
      <span className="badge badge-waiting">
        WAITING
      </span>
    );
  }

  if (
    status ===
      "IN_PROGRESS" ||
    status ===
      "WAITING_USER"
  ) {
    return (
      <span className="badge badge-in_progress">
        IN PROGRESS
      </span>
    );
  }

  if (
    status === "RESOLVED" ||
    status === "CLOSED" ||
    status === "FINISH" ||
    status === "DONE"
  ) {
    return (
      <span className="badge badge-done">
        DONE
      </span>
    );
  }

  /*
   * Fallback kalau ada status
   * yang tidak dikenal.
   */
  return (
    <span className="badge badge-waiting">
      {status}
    </span>
  );
}
export function SlaBadge({
  value,
}: BadgeProps) {
  const state = String(value || "ON_TRACK").toUpperCase();

  if (state === "OVERDUE_RESPONSE") {
    return <span className="badge sla-overdue">RESPONS TERLAMBAT</span>;
  }

  if (state === "OVERDUE_RESOLUTION") {
    return <span className="badge sla-overdue">SELESAI TERLAMBAT</span>;
  }

  if (state === "DONE") {
    return <span className="badge sla-done">SELESAI</span>;
  }

  return <span className="badge sla-track">SESUAI TARGET</span>;
}
