export type UserRole = "EMPLOYEE" | "IT" | "ADMIN";

export type TicketStatus =
  | "OPEN"
  | "ASSIGNED"
  | "IN_PROGRESS"
  | "WAITING_USER"
  | "RESOLVED"
  | "CLOSED";

export type TicketPriority =
  | "LOW"
  | "MEDIUM"
  | "HIGH"
  | "CRITICAL";

export interface Profile {
  id: string;
  name: string;
  email: string | null;
  role: UserRole;
  department_id: string | null;
  position: string | null;
  employee_id: string | null;
  is_active: boolean;
}

export type NamedRelation =
  | { name?: string }
  | { name?: string }[]
  | null;

export function relationName(
  value: NamedRelation,
  fallback = "-"
) {
  if (!value) return fallback;
  if (Array.isArray(value)) {
    return value[0]?.name ?? fallback;
  }
  return value.name ?? fallback;
}
