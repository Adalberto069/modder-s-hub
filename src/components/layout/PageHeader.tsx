import { ReactNode } from "react";

interface PageHeaderProps {
  eyebrow: string;
  title: ReactNode;
  description?: string;
  actions?: ReactNode;
}

export function PageHeader({ eyebrow, title, description, actions }: PageHeaderProps) {
  return (
    <header className="page-header">
      <div className="min-w-0 max-w-3xl">
        <p className="mb-3 text-xs font-semibold text-neon-cyan">{eyebrow}</p>
        <h1 className="text-3xl font-extrabold leading-tight text-foreground sm:text-5xl">{title}</h1>
        {description && <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-3">{actions}</div>}
    </header>
  );
}