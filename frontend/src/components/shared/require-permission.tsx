import { usePermission, usePermissionAny } from "@/hooks/usePermission";

interface RequirePermissionProps {
  /** Single permission code to check */
  permission?: string;
  /** Multiple codes — user needs at least one (OR logic) */
  any?: string[];
  /** Content to show if user has permission */
  children: React.ReactNode;
  /** Content to show if user lacks permission (default: nothing) */
  fallback?: React.ReactNode;
}

/**
 * Conditionally render content based on granular permissions.
 *
 * Usage:
 *   <RequirePermission permission="treatment:prescribe">
 *     <PrescribeButton />
 *   </RequirePermission>
 *
 *   <RequirePermission any={["pharmacy:dispense", "pharmacy:manage_stock"]}>
 *     <PharmacyPanel />
 *   </RequirePermission>
 *
 *   <RequirePermission permission="staff:manage_permissions" fallback={<AccessDenied />}>
 *     <RBACPage />
 *   </RequirePermission>
 */
export function RequirePermission({ permission, any, children, fallback = null }: RequirePermissionProps) {
  const hasSingle = usePermission(permission ?? "");
  const hasAny = usePermissionAny(any ?? []);

  const allowed = permission ? hasSingle : any ? hasAny : false;

  if (!allowed) return <>{fallback}</>;
  return <>{children}</>;
}
