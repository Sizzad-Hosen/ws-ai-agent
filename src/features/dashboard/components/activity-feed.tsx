import type { ActivityEntry } from "@/features/dashboard/types";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/utils/format";

const RING_TONES: Readonly<Record<ActivityEntry["tone"], string>> = {
  success: "border-success",
  info: "border-info",
  warning: "border-warning",
  neutral: "border-border-strong",
};

interface ActivityFeedProps {
  readonly entries: readonly ActivityEntry[];
  readonly now: Date;
}

export function ActivityFeed({ entries, now }: ActivityFeedProps) {
  if (entries.length === 0) {
    return (
      <p className="text-muted-foreground py-8 text-center text-sm">
        No platform activity recorded in this period.
      </p>
    );
  }

  return (
    <ol className="space-y-5">
      {entries.map((entry) => (
        <li key={entry.id} className="flex gap-3">
          <span
            className={cn(
              "mt-0.5 size-4 shrink-0 rounded-full border-2 bg-transparent",
              RING_TONES[entry.tone],
            )}
            aria-hidden="true"
          />
          <div className="min-w-0">
            <p className="text-foreground text-sm">
              {renderDescription(entry)}
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              {formatRelativeTime(entry.occurredAt, now)} · {entry.source}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Emphasises the entity named in the entry, as the mockup does. */
function renderDescription(entry: ActivityEntry) {
  if (!entry.subject) {
    return entry.description;
  }

  const index = entry.description.indexOf(entry.subject);

  if (index === -1) {
    return entry.description;
  }

  return (
    <>
      {entry.description.slice(0, index)}
      <strong className="font-semibold">{entry.subject}</strong>
      {entry.description.slice(index + entry.subject.length)}
    </>
  );
}
