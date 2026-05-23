export type UserRole = "GLOBAL_ADMIN" | "OWNER" | "AGENT" | "FREE_SALES";

export function canReview(role: UserRole): boolean {
  return role === "GLOBAL_ADMIN" || role === "OWNER";
}

export function canDelete(role: UserRole): boolean {
  return role === "GLOBAL_ADMIN" || role === "OWNER";
}

export function canManageSettings(role: UserRole): boolean {
  return role === "GLOBAL_ADMIN" || role === "OWNER";
}
