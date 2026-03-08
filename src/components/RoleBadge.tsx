interface RoleBadgeProps {
  role: "admin" | "modder" | "member";
}

const roleConfig = {
  admin: {
    label: "ADMIN",
    classes: "bg-destructive/15 text-destructive border-destructive/30",
  },
  modder: {
    label: "MODDER",
    classes: "bg-primary/15 text-primary border-primary/30",
  },
  member: {
    label: "MEMBER",
    classes: "bg-muted text-muted-foreground border-border",
  },
};

export function RoleBadge({ role }: RoleBadgeProps) {
  const config = roleConfig[role];
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold tracking-wider ${config.classes}`}
    >
      {config.label}
    </span>
  );
}
