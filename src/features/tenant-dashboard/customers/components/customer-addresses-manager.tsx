"use client";

import { useRouter } from "next/navigation";
import { LoaderCircle, Pencil, Plus, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";

import { FormField } from "@/components/shared/form-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
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
  deleteAddressAction,
  saveAddressAction,
} from "@/features/tenant-dashboard/customers/actions";
import type { AddressRow } from "@/features/tenant-dashboard/customers/service";

interface CustomerAddressesManagerProps {
  readonly slug: string;
  readonly customerId: string;
  readonly addresses: readonly AddressRow[];
}

type Editing =
  | { readonly mode: "create" }
  | { readonly mode: "edit"; readonly row: AddressRow }
  | null;

/**
 * A customer's delivery addresses.
 *
 * Kept on the customer's page rather than in the order form: an order picks a
 * saved address, and typing one afresh per order is how a customer ends up
 * with four spellings of the same street.
 */
export function CustomerAddressesManager({
  slug,
  customerId,
  addresses,
}: CustomerAddressesManagerProps) {
  const router = useRouter();
  const [editing, setEditing] = useState<Editing>(null);
  const [deleting, setDeleting] = useState<AddressRow | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function confirmDelete(): void {
    if (!deleting) return;
    setDeleteError(null);

    startTransition(async () => {
      const outcome = await deleteAddressAction(slug, customerId, deleting.id);

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
        <CardHeader
          title="Addresses"
          description="Where this customer's orders are delivered."
          actions={
            <Button size="sm" onClick={() => setEditing({ mode: "create" })}>
              <Plus className="size-4" aria-hidden="true" />
              Add address
            </Button>
          }
        />

        <TableScroller>
          <Table>
            <THead>
              <TR className="hover:bg-table-header">
                <TH>Recipient</TH>
                <TH>Address</TH>
                <TH>Phone</TH>
                <TH className="text-right">Actions</TH>
              </TR>
            </THead>
            <TBody>
              {addresses.length === 0 ? (
                <TableEmpty
                  colSpan={4}
                  title="No addresses yet"
                  description="Add one so an order can be shipped to this customer."
                />
              ) : (
                addresses.map((row) => (
                  <TR key={row.id}>
                    <TD>
                      <span className="text-foreground font-medium">
                        {row.recipientName}
                      </span>
                      {row.isDefault ? (
                        <Badge tone="info" className="ml-2">
                          Default
                        </Badge>
                      ) : null}
                      {row.label ? (
                        <span className="text-muted-foreground block text-xs">
                          {row.label}
                        </span>
                      ) : null}
                    </TD>
                    <TD>
                      {row.addressLine}
                      <span className="text-muted-foreground block text-xs">
                        {[row.city, row.region, row.postalCode]
                          .filter(Boolean)
                          .join(", ")}
                      </span>
                    </TD>
                    <TD mono className="text-muted-foreground">
                      {row.phone}
                    </TD>
                    <TD className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditing({ mode: "edit", row })}
                          aria-label={`Edit address for ${row.recipientName}`}
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
                          aria-label={`Delete address for ${row.recipientName}`}
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
      </Card>

      {editing ? (
        <AddressFormDialog
          slug={slug}
          customerId={customerId}
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
        title="Delete this address?"
        description={
          <>
            The address for <strong>{deleting?.recipientName}</strong> will be
            removed. Orders already shipped there keep their own copy.
          </>
        }
        confirmLabel="Delete address"
        isPending={isPending}
        error={deleteError}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </>
  );
}

function AddressFormDialog({
  slug,
  customerId,
  editing,
  onClose,
  onSaved,
}: {
  readonly slug: string;
  readonly customerId: string;
  readonly editing: NonNullable<Editing>;
  readonly onClose: () => void;
  readonly onSaved: () => void;
}) {
  const row = editing.mode === "edit" ? editing.row : null;
  const [isDefault, setIsDefault] = useState(row?.isDefault ?? false);
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
      const outcome = await saveAddressAction(
        slug,
        customerId,
        row?.id ?? null,
        {
          label: String(form.get("label") ?? ""),
          recipientName: String(form.get("recipientName") ?? ""),
          phone: String(form.get("phone") ?? ""),
          addressLine: String(form.get("addressLine") ?? ""),
          city: String(form.get("city") ?? ""),
          region: String(form.get("region") ?? ""),
          postalCode: String(form.get("postalCode") ?? ""),
          isDefault,
        },
      );

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
      aria-label={row ? "Edit address" : "New address"}
    >
      <form
        onSubmit={onSubmit}
        noValidate
        className="bg-card border-border max-h-full w-full max-w-lg overflow-y-auto rounded-2xl border p-6 shadow-xl"
      >
        <h2 className="text-lg font-semibold tracking-tight">
          {row ? "Edit address" : "New address"}
        </h2>

        <div className="mt-5 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              htmlFor="recipientName"
              label="Recipient"
              error={fieldErrors.recipientName?.[0]}
            >
              <Input
                id="recipientName"
                name="recipientName"
                required
                defaultValue={row?.recipientName ?? ""}
              />
            </FormField>

            <FormField
              htmlFor="phone"
              label="Phone"
              error={fieldErrors.phone?.[0]}
            >
              <Input
                id="phone"
                name="phone"
                required
                defaultValue={row?.phone ?? ""}
              />
            </FormField>
          </div>

          <FormField
            htmlFor="addressLine"
            label="Address"
            error={fieldErrors.addressLine?.[0]}
          >
            <Input
              id="addressLine"
              name="addressLine"
              required
              defaultValue={row?.addressLine ?? ""}
            />
          </FormField>

          <div className="grid gap-4 sm:grid-cols-3">
            <FormField
              htmlFor="city"
              label="City"
              error={fieldErrors.city?.[0]}
            >
              <Input
                id="city"
                name="city"
                required
                defaultValue={row?.city ?? ""}
              />
            </FormField>

            <FormField htmlFor="region" label="Region (optional)">
              <Input
                id="region"
                name="region"
                defaultValue={row?.region ?? ""}
              />
            </FormField>

            <FormField htmlFor="postalCode" label="Postcode (optional)">
              <Input
                id="postalCode"
                name="postalCode"
                defaultValue={row?.postalCode ?? ""}
              />
            </FormField>
          </div>

          <FormField htmlFor="label" label="Label (optional)">
            <Input
              id="label"
              name="label"
              placeholder="Home, Office"
              defaultValue={row?.label ?? ""}
            />
          </FormField>

          <span className="flex items-center gap-3 text-sm">
            <Switch
              label="Default address"
              defaultChecked={isDefault}
              onCheckedChange={setIsDefault}
            />
            Use as the default address
          </span>
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
            {row ? "Save changes" : "Add address"}
          </Button>
        </div>
      </form>
    </div>
  );
}
