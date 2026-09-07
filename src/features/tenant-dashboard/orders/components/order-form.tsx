"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LoaderCircle, Plus, Trash2 } from "lucide-react";
import { useMemo, useState, useTransition } from "react";

import { FormField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { fromCents, toCents } from "@/features/tenant-dashboard/money";
import { saveOrderAction } from "@/features/tenant-dashboard/orders/actions";
import type { CustomerOption } from "@/features/tenant-dashboard/customers/service";
import type { VariantOption } from "@/features/tenant-dashboard/products/service";
import {
  tenantHref,
  tenantRecordHref,
} from "@/features/tenant-dashboard/routes";
import {
  ORDER_STATUSES,
  ORDER_STATUS_LABELS,
} from "@/features/tenant-dashboard/status";
import { formatMoney } from "@/utils/format";

export interface OrderFormValues {
  readonly id: string | null;
  readonly customerId: string | null;
  readonly shippingAddressId: string | null;
  readonly status: string;
  readonly discount: string;
  readonly shippingFee: string;
  readonly tax: string;
  readonly items: readonly {
    readonly productVariantId: string;
    readonly quantity: number;
  }[];
}

interface OrderFormProps {
  readonly slug: string;
  readonly customers: readonly CustomerOption[];
  readonly variants: readonly VariantOption[];
  readonly currency: string;
  readonly initial: OrderFormValues;
}

interface LineState {
  /** Local only: React needs a stable key across re-orders and removals. */
  readonly key: string;
  productVariantId: string;
  quantity: string;
}

/**
 * The create and edit screen for an order.
 *
 * A page rather than a dialog: an order is a customer, an address, and a list
 * of lines, and a modal that scrolls is a worse version of a form.
 *
 * The totals shown here are a preview. The server prices the order again from
 * the variants themselves and sends back what it stored, because a number the
 * browser computed is a number the browser could have chosen.
 */
export function OrderForm({
  slug,
  customers,
  variants,
  currency,
  initial,
}: OrderFormProps) {
  const router = useRouter();
  const [customerId, setCustomerId] = useState(initial.customerId ?? "");
  const [shippingAddressId, setShippingAddressId] = useState(
    initial.shippingAddressId ?? "",
  );
  const [lines, setLines] = useState<LineState[]>(() =>
    initial.items.length > 0
      ? initial.items.map((item, index) => ({
          key: `line-${index}`,
          productVariantId: item.productVariantId,
          quantity: String(item.quantity),
        }))
      : [{ key: "line-0", productVariantId: "", quantity: "1" }],
  );
  const [status, setStatus] = useState(initial.status);
  const [discount, setDiscount] = useState(initial.discount);
  const [shippingFee, setShippingFee] = useState(initial.shippingFee);
  const [tax, setTax] = useState(initial.tax);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<
    Record<string, string[] | undefined>
  >({});
  const [isPending, startTransition] = useTransition();

  const priceById = useMemo(
    () => new Map(variants.map((variant) => [variant.id, variant.price])),
    [variants],
  );

  const selectedCustomer = customers.find(
    (customer) => customer.id === customerId,
  );

  const subtotalCents = lines.reduce((sum, line) => {
    const price = priceById.get(line.productVariantId);
    const quantity = Number(line.quantity);

    return price && Number.isFinite(quantity) && quantity > 0
      ? sum + toCents(price) * Math.trunc(quantity)
      : sum;
  }, 0);

  const totalCents =
    subtotalCents - toCents(discount) + toCents(shippingFee) + toCents(tax);

  function updateLine(key: string, patch: Partial<LineState>): void {
    setLines((current) =>
      current.map((line) => (line.key === key ? { ...line, ...patch } : line)),
    );
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setError(null);
    setFieldErrors({});

    startTransition(async () => {
      const outcome = await saveOrderAction(slug, initial.id, {
        customerId: customerId === "" ? null : customerId,
        shippingAddressId: shippingAddressId === "" ? null : shippingAddressId,
        status,
        discount,
        shippingFee,
        tax,
        items: lines
          .filter((line) => line.productVariantId !== "")
          .map((line) => ({
            productVariantId: line.productVariantId,
            quantity: line.quantity,
          })),
      });

      if (outcome.success && outcome.id) {
        router.push(tenantRecordHref(slug, "orders", outcome.id));
        router.refresh();
      } else {
        setError(outcome.message);
        setFieldErrors(outcome.fieldErrors ?? {});
      }
    });
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      <Card>
        <CardHeader
          title="Customer and delivery"
          description="Leave the customer blank for a walk-in sale."
        />
        <CardBody className="grid gap-4 sm:grid-cols-3">
          <FormField htmlFor="customerId" label="Customer">
            <Select
              id="customerId"
              value={customerId}
              onChange={(event) => {
                setCustomerId(event.target.value);
                // The old address belongs to the old customer; keeping it
                // would be rejected by the server anyway.
                setShippingAddressId("");
              }}
              options={[
                { value: "", label: "Walk-in (no customer)" },
                ...customers.map((customer) => ({
                  value: customer.id,
                  label: customer.phone
                    ? `${customer.name} — ${customer.phone}`
                    : customer.name,
                })),
              ]}
            />
          </FormField>

          <FormField htmlFor="shippingAddressId" label="Delivery address">
            <Select
              id="shippingAddressId"
              value={shippingAddressId}
              disabled={!selectedCustomer}
              onChange={(event) => setShippingAddressId(event.target.value)}
              options={[
                {
                  value: "",
                  label: selectedCustomer
                    ? "No address"
                    : "Choose a customer first",
                },
                ...(selectedCustomer?.addresses ?? []).map((address) => ({
                  value: address.id,
                  label: address.isDefault
                    ? `${address.summary} (default)`
                    : address.summary,
                })),
              ]}
            />
          </FormField>

          <FormField htmlFor="status" label="Status">
            <Select
              id="status"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              options={ORDER_STATUSES.map((value) => ({
                value,
                label: ORDER_STATUS_LABELS[value],
              }))}
            />
          </FormField>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Lines"
          description="Prices come from the variant, so they cannot be edited here."
          actions={
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() =>
                setLines((current) => [
                  ...current,
                  {
                    key: `line-${Date.now()}`,
                    productVariantId: "",
                    quantity: "1",
                  },
                ])
              }
            >
              <Plus className="size-4" aria-hidden="true" />
              Add line
            </Button>
          }
        />
        <CardBody className="space-y-3">
          {variants.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No sellable variants yet. Add a product with a variant in{" "}
              <Link
                href={tenantHref(slug, "products")}
                className="underline underline-offset-2"
              >
                Products
              </Link>{" "}
              first.
            </p>
          ) : null}

          {lines.map((line, index) => {
            const price = priceById.get(line.productVariantId);
            const quantity = Number(line.quantity);
            const lineCents =
              price && Number.isFinite(quantity) && quantity > 0
                ? toCents(price) * Math.trunc(quantity)
                : 0;

            return (
              <div
                key={line.key}
                className="grid items-end gap-3 sm:grid-cols-[1fr_7rem_7rem_auto]"
              >
                <FormField
                  htmlFor={`variant-${line.key}`}
                  label={index === 0 ? "Product variant" : ""}
                >
                  <Select
                    id={`variant-${line.key}`}
                    aria-label={`Product variant for line ${index + 1}`}
                    value={line.productVariantId}
                    onChange={(event) =>
                      updateLine(line.key, {
                        productVariantId: event.target.value,
                      })
                    }
                    options={[
                      { value: "", label: "Choose a variant" },
                      ...variants.map((variant) => ({
                        value: variant.id,
                        label: `${variant.productName} — ${variant.sku} (${variant.available} in stock)`,
                      })),
                    ]}
                  />
                </FormField>

                <FormField
                  htmlFor={`quantity-${line.key}`}
                  label={index === 0 ? "Quantity" : ""}
                >
                  <Input
                    id={`quantity-${line.key}`}
                    aria-label={`Quantity for line ${index + 1}`}
                    inputMode="numeric"
                    value={line.quantity}
                    onChange={(event) =>
                      updateLine(line.key, { quantity: event.target.value })
                    }
                  />
                </FormField>

                <div className="text-foreground tabular pb-3 text-sm">
                  {formatMoney(fromCents(lineCents), currency)}
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive mb-2"
                  disabled={lines.length === 1}
                  onClick={() =>
                    setLines((current) =>
                      current.filter((candidate) => candidate.key !== line.key),
                    )
                  }
                  aria-label={`Remove line ${index + 1}`}
                >
                  <Trash2 className="size-3.5" aria-hidden="true" />
                </Button>
              </div>
            );
          })}

          {fieldErrors.items?.[0] ? (
            <p className="text-destructive text-sm" role="alert">
              {fieldErrors.items[0]}
            </p>
          ) : null}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Charges" />
        <CardBody className="grid gap-4 sm:grid-cols-3">
          <FormField
            htmlFor="discount"
            label="Discount"
            error={fieldErrors.discount?.[0]}
          >
            <Input
              id="discount"
              inputMode="decimal"
              value={discount}
              onChange={(event) => setDiscount(event.target.value)}
            />
          </FormField>

          <FormField
            htmlFor="shippingFee"
            label="Shipping"
            error={fieldErrors.shippingFee?.[0]}
          >
            <Input
              id="shippingFee"
              inputMode="decimal"
              value={shippingFee}
              onChange={(event) => setShippingFee(event.target.value)}
            />
          </FormField>

          <FormField htmlFor="tax" label="Tax" error={fieldErrors.tax?.[0]}>
            <Input
              id="tax"
              inputMode="decimal"
              value={tax}
              onChange={(event) => setTax(event.target.value)}
            />
          </FormField>

          <dl className="text-sm sm:col-span-3">
            <div className="flex justify-between py-1">
              <dt className="text-muted-foreground">Subtotal</dt>
              <dd className="tabular">
                {formatMoney(fromCents(subtotalCents), currency)}
              </dd>
            </div>
            <div className="border-border flex justify-between border-t py-1 font-medium">
              <dt>Total</dt>
              <dd className="tabular">
                {formatMoney(fromCents(totalCents), currency)}
              </dd>
            </div>
          </dl>
        </CardBody>
      </Card>

      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" asChild>
          <Link
            href={
              initial.id
                ? tenantRecordHref(slug, "orders", initial.id)
                : tenantHref(slug, "orders")
            }
          >
            Cancel
          </Link>
        </Button>
        <Button type="submit" disabled={isPending || variants.length === 0}>
          {isPending ? (
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          ) : null}
          {initial.id ? "Save changes" : "Create order"}
        </Button>
      </div>
    </form>
  );
}
