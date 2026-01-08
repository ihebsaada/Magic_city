import { cn } from "@/lib/utils";

interface BadgeCustomProps {
  children: React.ReactNode;
  variant?: "new" | "sale" | "default";
  className?: string;
}

export const BadgeCustom = ({ children, variant = "default", className }: BadgeCustomProps) => {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-1 text-xs font-medium uppercase tracking-wide transition-all",
        variant === "new" && "bg-accent text-accent-foreground",
        variant === "sale" && "bg-destructive text-destructive-foreground",
        variant === "default" && "bg-muted text-muted-foreground",
        className
      )}
    >
      {children}
    </span>
  );
};
