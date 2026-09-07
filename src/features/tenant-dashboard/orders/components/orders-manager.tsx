"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";

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
  deleteOrderAction,
  setOrderStatusAction,
} from "@/features/tenant-dashboard/orders/actions";
import type { OrderRow } from "@/features/tenant-dashboard/orders/service";
import { buildListHref } from "@/features/tenant-dashboard/query";
import {
  tenantHref,
  tenantRecordHref,
} from "@/features/tenant-dashboard/routes";
import {
  ORDER_STATUSES,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_TONES,
  statusFilterOptions,
} from "@/features/tenant-dashboard/status";
import { formatDate, formatMoney } from "@/utils/format";

interface OrdersManagerProps {
  readonly slug: string;
  readonly items: readonly OrderRow[];
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
  readonly search: string;
  readonly status: string;
  readonly currency: string;
}

export function OrdersManager({
  slug,
  items,
  total,
  limit,
  offset,
  search,
  status,
  currency,
}: OrdersManagerProps) {
  const router = useRouter();
  const [deleting, setDeleting] = useState<OrderRow | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const base = tenantHref(slug, "orders");

  function changeStatus(row: OrderRow, next: string): void {
    setRowError(null);

    startTransition(async () => {
      const outcome = await setOrderStatusAction(slug, row.id, next);

      if (outcome.success) router.refresh();
      else setRowError(outcome.message);
    });
  }

  function confirmDelete(): void {
    if (!deleting) return;
    setDeleteError(null);

    startTransition(async () => {
      const outcome = await deleteOrderAction(slug, deleting.id);

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
              placeholder="Search order number or customer"
              aria-label="Search orders"
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

          <div className="w-44">
            <QuerySelect
              name="status"
              value={status}
              label="Filter by order status"
              options={statusFilterOptions(
                ORDER_STATUSES,
                ORDER_STATUS_LABELS,
                "Status: All",
              )}
            />
          </div>

          <Button asChild>
            <Link href={`${base}/new`}>
              <Plus className="size-4" aria-hidden="true" />
              New order
            </Link>
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
                <TH>Order</TH>
                <TH>Customer</TH>
                <TH numeric>Lines</TH>
                <TH numeric>Total</TH>
                <TH>Placed</TH>
                <TH>Status</TH>
                <TH className="text-right">Actions</TH>
              </TR>
            </THead>
            <TBody>
              {items.length === 0 ? (
                <TableEmpty
                  colSpan={7}
                  title={search || status ? "No orders match" : "No orders yet"}
                  description={
                    search || status
                      ? "Try a different search or filter."
                      : "Record an order against a customer to see it here."
                  }
                />
              ) : (
                items.map((row) => (
                  <TR key={row.id}>
                    <TD>
                      <Link
                        href={tenantRecordHref(slug, "orders", row.id)}
                        className="text-foreground font-medium hover:underline"
                      >
                        {row.orderNumber}
                      </Link>
                    </TD>
                    <TD>{row.customerName ?? "Walk-in"}</TD>
                    <TD numeric>{row.itemCount}</TD>
                    <TD numeric>
                      {formatMoney(row.total, currency) ?? row.total}
                    </TD>
                    <TD className="text-muted-foreground">
                      {formatDate(row.placedAt)}
                    </TD>
                    <TD>
                      <Badge tone={ORDER_STATUS_TONES[row.status]}>
                        {ORDER_STATUS_LABELS[row.status]}
                      </Badge>
                    </TD>
                    <TD className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-36">
                          {/* Status is the one field changed often enough to
                              deserve editing from the list itself. */}
                          <Select
                            size="sm"
                            aria-label={`Status of ${row.orderNumber}`}
                            value={row.status}
                            disabled={isPending}
                            onChange={(event) =>
                              changeStatus(row, event.target.value)
                            }
                            options={ORDER_STATUSES.map((value) => ({
                              value,
                              label: ORDER_STATUS_LABELS[value],
                            }))}
                          />
                        </div>
                        <Button variant="ghost" size="sm" asChild>
                          <Link
                            href={`${tenantRecordHref(slug, "orders", row.id)}/edit`}
                            aria-label={`Edit ${row.orderNumber}`}
                          >
                            <Pencil className="size-3.5" aria-hidden="true" />
                          </Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          onClick={() => {
                            setDeleteError(null);
                            setDeleting(row);
                          }}
                          aria-label={`Delete ${row.orderNumber}`}
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
          noun="orders"
        />
      </Card>

      <ConfirmDialog
        open={deleting !== null}
        title="Delete this order?"
        description={
          <>
            <strong>{deleting?.orderNumber}</strong> and its lines will be
            removed permanently. This cannot be undone.
          </>
        }
        confirmLabel="Delete order"
        isPending={isPending}
        error={deleteError}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </>
  );
}
