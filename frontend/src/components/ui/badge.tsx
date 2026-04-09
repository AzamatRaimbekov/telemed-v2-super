import { cn } from "@/lib/utils";

type BadgeVariant = "success" | "warning" | "destructive" | "secondary" | "muted" | "primary";

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
  dot?: boolean;
}

const variantStyles: Record<BadgeVariant, string> = {
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  destructive: "bg-destructive/10 text-destructive",
  secondary: "bg-secondary/10 text-secondary",
  muted: "bg-[var(--color-muted)] text-[var(--color-text-secondary)]",
  primary: "bg-primary/10 text-[var(--color-primary-deep)]",
};

export function Badge({ children, variant = "muted", className, dot }: BadgeProps) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium", variantStyles[variant], className)}>
      {dot && <span className={cn("w-1.5 h-1.5 rounded-full", variant === "success" ? "bg-success" : variant === "destructive" ? "bg-destructive" : variant === "warning" ? "bg-warning" : "bg-current")} />}
      {children}
    </span>
  );
}
