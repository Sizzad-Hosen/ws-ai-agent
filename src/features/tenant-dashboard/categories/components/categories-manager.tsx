"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LoaderCircle, Pencil, Plus, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";

import { FormField } from "@/components/shared/form-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
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
  deleteCategoryAction,
  saveCategoryAction,
  setCategoryActiveAction,
} from "@/features/tenant-dashboard/categories/actions";
import type { CategoryRow } from "@/features/tenant-dashboard/categories/service";
import { buildListHref } from "@/features/tenant-dashboard/query";
import { tenantHref } from "@/features/tenant-dashboard/routes";
import { slugify } from "@/features/tenant-dashboard/slug";

interface CategoriesManagerProps {
  readonly slug: string;
  readonly items: readonly CategoryRow[];
  readonly options: readonly { id: string; name: string }[];
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
  readonly search: string;
}

type Editing =
  | { readonly mode: "create" }
  | { readonly mode: "edit"; readonly row: CategoryRow }
  | null;

export function CategoriesManager({
  slug,
  items,
  options,
  total,
  limit,
  offset,
  search,
}: CategoriesManagerProps) {
  const router = useRouter();
  const [editing, setEditing] = useState<Editing>(null);
  const [deleting, setDeleting] = useState<CategoryRow | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const base = tenantHref(slug, "categories");

  function toggleActive(row: CategoryRow): void {
    setRowError(null);

    startTransition(async () => {
      const outcome = await setCategoryActiveAction(
        slug,
        row.id,
        !row.isActive,
      );

      if (outcome.success) router.refresh();
      else setRowError(outcome.message);
    });
  }

  function confirmDelete(): void {
    if (!deleting) return;
    setDeleteError(null);

    startTransition(async () => {
      const outcome = await deleteCategoryAction(slug, deleting.id);

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
          <form method="get" action={base} className="flex flex-1 gap-2">
            <Input
              name="search"
              defaultValue={search}
              placeholder="Search categories"
              aria-label="Search categories"
              className="max-w-xs"
            />
            <Button type="submit" variant="secondary">
              Search
            </Button>
            {search ? (
              <Button variant="ghost" asChild>
                <Link href={base}>Clear</Link>
              </Button>
            ) : null}
          </form>

          <Button onClick={() => setEditing({ mode: "create" })}>
            <Plus className="size-4" aria-hidden="true" />
            New category
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
                <TH>Name</TH>
                <TH>Slug</TH>
                <TH>Parent</TH>
                <TH>Products</TH>
                <TH>Status</TH>
                <TH className="text-right">Actions</TH>
              </TR>
            </THead>
            <TBody>
              {items.length === 0 ? (
                <TableEmpty
                  colSpan={6}
                  title={search ? "No categories match" : "No categories yet"}
                  description={
                    search
                      ? "Try a different search term."
                      : "Group your products so customers can find them."
                  }
                />
              ) : (
                items.map((row) => (
                  <TR key={row.id}>
                    <TD>
                      <span className="text-foreground font-medium">
                        {row.name}
                      </span>
                      {row.description ? (
                        <span className="text-muted-foreground block truncate text-xs">
                          {row.description}
                        </span>
                      ) : null}
                    </TD>
                    <TD mono className="text-muted-foreground">
                      {row.slug}
                    </TD>
                    <TD>{row.parentName ?? "—"}</TD>
                    <TD className="tabular">{row.productCount}</TD>
                    <TD>
                      <Badge tone={row.isActive ? "success" : "neutral"}>
                        {row.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TD>
                    <TD className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={isPending}
                          onClick={() => toggleActive(row)}
                        >
                          {row.isActive ? "Deactivate" : "Activate"}
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
            buildListHref(base, { search: search || undefined, offset: next })
          }
          noun="categories"
        />
      </Card>

      {editing ? (
        <CategoryFormDialog
          slug={slug}
          options={options}
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
        title="Delete this category?"
        description={
          <>
            <strong>{deleting?.name}</strong> will be removed permanently. This
            cannot be undone.
          </>
        }
        confirmLabel="Delete category"
        isPending={isPending}
        error={deleteError}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </>
  );
}

function CategoryFormDialog({
  slug,
  options,
  editing,
  onClose,
  onSaved,
}: {
  readonly slug: string;
  readonly options: readonly { id: string; name: string }[];
  readonly editing: NonNullable<Editing>;
  readonly onClose: () => void;
  readonly onSaved: () => void;
}) {
  const row = editing.mode === "edit" ? editing.row : null;
  const [name, setName] = useState(row?.name ?? "");
  const [slugValue, setSlugValue] = useState(row?.slug ?? "");
  // A slug the user has typed is theirs; before that it tracks the name.
  const [slugTouched, setSlugTouched] = useState(row !== null);
  const [isActive, setIsActive] = useState(row?.isActive ?? true);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<
    Record<string, string[] | undefined>
  >({});
  const [isPending, startTransition] = useTransition();

  const effectiveSlug = slugTouched ? slugValue : slugify(name);

  function onSubmit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    setError(null);
    setFieldErrors({});

    const parentId = String(form.get("parentId") ?? "");

    startTransition(async () => {
      const outcome = await saveCategoryAction(slug, row?.id ?? null, {
        name: String(form.get("name") ?? ""),
        slug: effectiveSlug,
        description: String(form.get("description") ?? ""),
        parentId: parentId === "" ? null : parentId,
        isActive,
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
      aria-label={row ? `Edit ${row.name}` : "New category"}
    >
      <form
        onSubmit={onSubmit}
        noValidate
        className="bg-card border-border w-full max-w-lg rounded-2xl border p-6 shadow-xl"
      >
        <h2 className="text-lg font-semibold tracking-tight">
          {row ? "Edit category" : "New category"}
        </h2>

        <div className="mt-5 space-y-4">
          <FormField htmlFor="name" label="Name" error={fieldErrors.name?.[0]}>
            <Input
              id="name"
              name="name"
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </FormField>

          <FormField htmlFor="slug" label="Slug" error={fieldErrors.slug?.[0]}>
            <Input
              id="slug"
              name="slug"
              required
              value={effectiveSlug}
              onChange={(event) => {
                setSlugTouched(true);
                setSlugValue(event.target.value);
              }}
            />
          </FormField>

          <FormField htmlFor="parentId" label="Parent category">
            <Select
              id="parentId"
              name="parentId"
              defaultValue={row?.parentId ?? ""}
              options={[
                { value: "", label: "No parent" },
                ...options
                  .filter((option) => option.id !== row?.id)
                  .map((option) => ({ value: option.id, label: option.name })),
              ]}
            />
          </FormField>

          <FormField htmlFor="description" label="Description">
            <Textarea
              id="description"
              name="description"
              rows={3}
              defaultValue={row?.description ?? ""}
            />
          </FormField>

          <span className="flex items-center gap-3 text-sm">
            <Switch
              label="Active"
              defaultChecked={isActive}
              onCheckedChange={setIsActive}
            />
            Active
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
            {row ? "Save changes" : "Create category"}
          </Button>
        </div>
      </form>
    </div>
  );
}
