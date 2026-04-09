import { useAuthStore } from "@/stores/auth-store";
import type { UserRole } from "@/types/auth";

interface RequireRoleProps {
  roles: UserRole[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function RequireRole({ roles, children, fallback = null }: RequireRoleProps) {
  const user = useAuthStore((s) => s.user);
  if (!user || !roles.includes(user.role)) return <>{fallback}</>;
  return <>{children}</>;
}
