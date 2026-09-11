import Link from "next/link";
import { FunnelX, Search } from "lucide-react";

import { QuerySelect } from "@/components/shared/query-select";
import { ROUTES } from "@/constants/routes";
import { TENANT_STATUS_LABELS } from "@/features/tenants/status";
import type { Plan } from "@/features/plans/types";
import { TENANT_STATUSES, WHATSAPP_CONNECTION_STATUSES } from "@/types/status";
import { WHATSAPP_STATUS_LABELS } from "@/features/tenants/status";

interface TenantFiltersProps {
  readonly search: string;
  readonly status: string;
  readonly planCode: string;
  readonly whatsapp: string;
  readonly plans: readonly Plan[];
  readonly hasFilters: boolean;
}

export function TenantFilters({
  search,
  status,
  planCode,
  whatsapp,
  plans,
  hasFilters,
}: TenantFiltersProps) {
  return (
    <div className="border-border flex flex-wrap items-center gap-3 border-b px-5 py-4">
      {/* Search submits on enter so it works without JavaScript. */}
      <form className="relative min-w-56 flex-1" role="search">
        <Search
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
          aria-hidden="true"
        />
        <label htmlFor="tenant-search" className="sr-only">
          Filter tenants
        </label>
        <input
          id="tenant-search"
          name="search"
          type="search"
          defaultValue={search}
          placeholder="Filter tenants…"
          className="border-input bg-card focus-visible:border-ring h-10 w-full rounded-md border pr-3 pl-9 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
        />
        {status ? <input type="hidden" name="status" value={status} /> : null}
        {planCode ? <input type="hidden" name="plan" value={planCode} /> : null}
        {whatsapp ? (
          <input type="hidden" name="whatsapp" value={whatsapp} />
        ) : null}
      </form>

      <div className="w-44">
        <QuerySelect
          name="status"
          value={status}
          label="Filter by tenant status"
          options={[
            { value: "", label: "Status: All" },
            ...TENANT_STATUSES.map((value) => ({
              value,
              label: TENANT_STATUS_LABELS[value],
            })),
          ]}
        />
      </div>

      <div className="w-40">
        <QuerySelect
          name="plan"
          value={planCode}
          label="Filter by plan"
          options={[
            { value: "", label: "Plan: All" },
            ...plans.map((plan) => ({ value: plan.code, label: plan.name })),
          ]}
        />
      </div>

      <div className="w-48">
        <QuerySelect
          name="whatsapp"
          value={whatsapp}
          label="Filter by WhatsApp connection"
          options={[
            { value: "", label: "WhatsApp: All" },
            ...WHATSAPP_CONNECTION_STATUSES.map((value) => ({
              value,
              label: WHATSAPP_STATUS_LABELS[value],
            })),
          ]}
        />
      </div>

      {hasFilters ? (
        <Link
          href={ROUTES.bo.tenants}
          className="text-muted-foreground hover:text-foreground ml-auto inline-flex items-center gap-2 rounded-md px-2 py-1 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          <FunnelX className="size-4" aria-hidden="true" />
          Clear
        </Link>
      ) : null}
    </div>
  );
}
