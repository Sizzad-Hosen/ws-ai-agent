"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LoaderCircle, Pencil, Plus, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";

import { FormField } from "@/components/shared/form-field";
import { QuerySelect } from "@/components/shared/query-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { Select } from "@/components/ui/select";
import {
  TBody,
  TD,
  TH,
  THead,
  TR,
  Table,
  TableEmpty,
  TableScroller,
} from "@/components/ui/table";
import {
  deleteCustomerAction,
  saveCustomerAction,
  setCustomerStatusAction,
} from "@/features/tenant-dashboard/customers/actions";
import type { CustomerRow } from "@/features/tenant-dashboard/customers/service";
import { buildListHref } from "@/features/tenant-dashboard/query";
import {
  tenantHref,
  tenantRecordHref,
} from "@/features/tenant-dashboard/routes";
import {
  CUSTOMER_STATUSES,
  CUSTOMER_STATUS_LABELS,
  CUSTOMER_STATUS_TONES,
  statusFilterOptions,
} from "@/features/tenant-dashboard/status";

interface CustomersManagerProps {
  readonly slug: string;
  readonly items: readonly CustomerRow[];
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
  readonly search: string;
  readonly status: string;
}

type Editing =
  | { readonly mode: "create" }
  | { readonly mode: "edit"; readonly row: CustomerRow }
  | null;

export function CustomersManager({
  slug,
  items,
  total,
  limit,
  offset,
  search,
  status,
}: CustomersManagerProps) {
  const router = useRouter();
  const [editing, setEditing] = useState<Editing>(null);
  const [deleting, setDeleting] = useState<CustomerRow | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const base = tenantHref(slug, "customers");

  function toggleBlocked(row: CustomerRow): void {
    setRowError(null);

    startTransition(async () => {
      const outcome = await setCustomerStatusAction(
        slug,
        row.id,
        row.status === "BLOCKED" ? "ACTIVE" : "BLOCKED",
      );

      if (outcome.success) router.refresh();
      else setRowError(outcome.message);
    });
  }

  function confirmDelete(): void {
    if (!deleting) return;
    setDeleteError(null);

    startTransition(async () => {
      const outcome = await deleteCustomerAction(slug, deleting.id);

      if (outcome.success) {
        setDeleting(null);
        router.refresh();
      } else {
        setDeleteError(outcome.message);
      }
    });
  }

  return (
    <>
      <Card className="overflow-hidden">
        <div className="border-border flex flex-wrap items-center gap-3 border-b p-4">
          {/* Search submits on enter, so it works without JavaScript. The
              status filter travels as a hidden field rather than being lost. */}
          <form method="get" action={base} className="flex flex-1 gap-2">
            <Input
              name="search"
              defaultValue={search}
              placeholder="Search name, email or phone"
              aria-label="Search customers"
              className="max-w-xs"
            />
            {status ? (
              <input type="hidden" name="status" value={status} />
            ) : null}
            <Button type="submit" variant="secondary">
              Search
            </Button>
            {search || status ? (
              <Button variant="ghost" asChild>
                <Link href={base}>Clear</Link>
              </Button>
            ) : null}
          </form>

          <div className="w-40">
            <QuerySelect
              name="status"
              value={status}
              label="Filter by customer status"
              options={statusFilterOptions(
                CUSTOMER_STATUSES,
                CUSTOMER_STATUS_LABELS,
                "Status: All",
              )}
            />
          </div>

          <Button onClick={() => setEditing({ mode: "create" })}>
            <Plus className="size-4" aria-hidden="true" />
            New customer
          </Button>
        </div>

        {rowError ? (
          <p className="text-destructive px-4 pt-3 text-sm" role="alert">
            {rowError}
          </p>
        ) : null}

        <TableScroller>
          <Table>
            <THead>
              <TR className="hover:bg-table-header">
                <TH>Customer</TH>
                <TH>Phone</TH>
                <TH numeric>Orders</TH>
                <TH numeric>Addresses</TH>
                <TH>Status</TH>
                <TH className="text-right">Actions</TH>
              </TR>
            </THead>
            <TBody>
              {items.length === 0 ? (
                <TableEmpty
                  colSpan={6}
                  title={
                    search || status ? "No customers match" : "No customers yet"
                  }
                  description={
                    search || status
                      ? "Try a different search or filter."
                      : "Add the people you sell to, then place orders against them."
                  }
                />
              ) : (
                items.map((row) => (
                  <TR key={row.id}>
                    <TD>
                      <Link
                        href={tenantRecordHref(slug, "customers", row.id)}
                        className="text-foreground font-medium hover:underline"
                      >
                        {row.name}
                      </Link>
                      <span className="text-muted-foreground block truncate text-xs">
                        {row.email ?? "No email"}
                      </span>
                    </TD>
                    <TD mono className="text-muted-foreground">
                      {row.phone ?? "—"}
                    </TD>
                    <TD numeric>{row.orderCount}</TD>
                    <TD numeric>{row.addressCount}</TD>
                    <TD>
                      <Badge tone={CUSTOMER_STATUS_TONES[row.status]}>
                        {CUSTOMER_STATUS_LABELS[row.status]}
                      </Badge>
                    </TD>
                    <TD className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={isPending}
                          onClick={() => toggleBlocked(row)}
                        >
                          {row.status === "BLOCKED" ? "Unblock" : "Block"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditing({ mode: "edit", row })}
                          aria-label={`Edit ${row.name}`}
                        >
                          <Pencil className="size-3.5" aria-hidden="true" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          onClick={() => {
                            setDeleteError(null);
                            setDeleting(row);
                          }}
                          aria-label={`Delete ${row.name}`}
                        >
                          <Trash2 className="size-3.5" aria-hidden="true" />
                        </Button>
                      </div>
                    </TD>
                  </TR>
                ))
              )}
            </TBody>
          </Table>
        </TableScroller>

        <Pagination
          total={total}
          limit={limit}
          offset={offset}
          buildHref={(next) =>
            buildListHref(base, {
              search: search || undefined,
              status: status || undefined,
              offset: next,
            })
          }
          noun="customers"
        />
      </Card>

      {editing ? (
        <CustomerFormDialog
          slug={slug}
          editing={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            router.refresh();
          }}
        />
      ) : null}

      <ConfirmDialog
        open={deleting !== null}
        title="Delete this customer?"
        description={
          <>
            <strong>{deleting?.name}</strong> and their saved addresses will be
            removed permanently. This cannot be undone.
          </>
        }
        confirmLabel="Delete customer"
        isPending={isPending}
        error={deleteError}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </>
  );
}

function CustomerFormDialog({
  slug,
  editing,
  onClose,
  onSaved,
}: {
  readonly slug: string;
  readonly editing: NonNullable<Editing>;
  readonly onClose: () => void;
  readonly onSaved: () => void;
}) {
  const row = editing.mode === "edit" ? editing.row : null;
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<
    Record<string, string[] | undefined>
  >({});
  const [isPending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    setError(null);
    setFieldErrors({});

    startTransition(async () => {
      const outcome = await saveCustomerAction(slug, row?.id ?? null, {
        name: String(form.get("name") ?? ""),
        email: String(form.get("email") ?? ""),
        phone: String(form.get("phone") ?? ""),
        status: String(form.get("status") ?? "ACTIVE"),
      });

      if (outcome.success) {
        onSaved();
      } else {
        setError(outcome.message);
        setFieldErrors(outcome.fieldErrors ?? {});
      }
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={row ? `Edit ${row.name}` : "New customer"}
    >
      <form
        onSubmit={onSubmit}
        noValidate
        className="bg-card border-border max-h-full w-full max-w-lg overflow-y-auto rounded-2xl border p-6 shadow-xl"
      >
        <h2 className="text-lg font-semibold tracking-tight">
          {row ? "Edit customer" : "New customer"}
        </h2>

        <div className="mt-5 space-y-4">
          <FormField htmlFor="name" label="Name" error={fieldErrors.name?.[0]}>
            <Input
              id="name"
              name="name"
              required
              defaultValue={row?.name ?? ""}
            />
          </FormField>

          <FormField
            htmlFor="email"
            label="Email (optional)"
            error={fieldErrors.email?.[0]}
          >
            <Input
              id="email"
              name="email"
              type="email"
              defaultValue={row?.email ?? ""}
            />
          </FormField>

          <FormField
            htmlFor="phone"
            label="Phone (optional)"
            error={fieldErrors.phone?.[0]}
          >
            <Input id="phone" name="phone" defaultValue={row?.phone ?? ""} />
          </FormField>

          <FormField htmlFor="status" label="Status">
            <Select
              id="status"
              name="status"
              defaultValue={row?.status ?? "ACTIVE"}
              options={CUSTOMER_STATUSES.map((value) => ({
                value,
                label: CUSTOMER_STATUS_LABELS[value],
              }))}
            />
          </FormField>
        </div>

        {error ? (
          <p className="text-destructive mt-4 text-sm" role="alert">
            {error}
          </p>
        ) : null}

        <div className="mt-6 flex justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? (
              <LoaderCircle
                className="size-4 animate-spin"
                aria-hidden="true"
              />
            ) : null}
            {row ? "Save changes" : "Create customer"}
          </Button>
        </div>
      </form>
    </div>
  );
}
