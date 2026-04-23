import { useAuthStore } from "@/stores/auth-store";
import type { UserRole } from "@/types/auth";

/**
 * Check if current user has a specific permission.
 * SUPER_ADMIN and CLINIC_ADMIN have all permissions by default.
 *
 * Usage:
 *   const canPrescribe = usePermission("treatment:prescribe");
 *   const canManageStaff = usePermission("staff:manage_permissions");
 *   const canAny = usePermissionAny(["pharmacy:dispense", "pharmacy:manage_stock"]);
 */

const ADMIN_ROLES: UserRole[] = ["SUPER_ADMIN", "CLINIC_ADMIN"];

export function usePermission(permissionCode: string): boolean {
  const user = useAuthStore((s) => s.user);
  if (!user) return false;
  if (ADMIN_ROLES.includes(user.role)) return true;
  if (user.permissions?.includes("*")) return true;
  return user.permissions?.includes(permissionCode) ?? false;
}

export function usePermissionAny(codes: string[]): boolean {
  const user = useAuthStore((s) => s.user);
  if (!user) return false;
  if (ADMIN_ROLES.includes(user.role)) return true;
  if (user.permissions?.includes("*")) return true;
  return codes.some((code) => user.permissions?.includes(code));
}

export function usePermissionAll(codes: string[]): boolean {
  const user = useAuthStore((s) => s.user);
  if (!user) return false;
  if (ADMIN_ROLES.includes(user.role)) return true;
  if (user.permissions?.includes("*")) return true;
  return codes.every((code) => user.permissions?.includes(code));
}

/**
 * Get all permissions for current user.
 */
export function usePermissions(): string[] {
  const user = useAuthStore((s) => s.user);
  if (!user) return [];
  if (ADMIN_ROLES.includes(user.role)) return ["*"];
  return user.permissions ?? [];
}
