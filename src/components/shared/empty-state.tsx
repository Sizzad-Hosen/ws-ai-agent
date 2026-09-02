import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  readonly icon: LucideIcon;
  readonly title: string;
  readonly description: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
}: EmptyStateProps) {
  return (
    <section className="bg-card rounded-lg border border-dashed p-8 text-center">
      <Icon
        className="text-muted-foreground mx-auto size-8"
        aria-hidden="true"
      />
      <h2 className="mt-3 font-semibold">{title}</h2>
      <p className="text-muted-foreground mx-auto mt-1 max-w-md text-sm">
        {description}
      </p>
    </section>
  );
}
