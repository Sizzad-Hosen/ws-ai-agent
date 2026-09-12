"use client";

import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { useState, useTransition } from "react";

import { FormField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { saveCategoryAction } from "@/features/tenant-catalogue/actions/category-actions";
import {
  deriveSlug,
  MAX_CATEGORY_SLUG,
} from "@/features/tenant-catalogue/slug";
import type {
  CategoryDetail,
  CategoryOption,
} from "@/features/tenant-workspace/detail-service";

interface CategoryFormProps {
  readonly slug: string;
  /** Null when creating. */
  readonly category: CategoryDetail | null;
  readonly parentOptions: readonly CategoryOption[];
  readonly cancelHref: string;
  readonly listHref: string;
}

export function CategoryForm({
  slug,
  category,
  parentOptions,
  cancelHref,
  listHref,
}: CategoryFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<
    Record<string, string[] | undefined>
  >({});
  const [slugValue, setSlugValue] = useState(category?.slug ?? "");
  // Only while creating: once a category is live its slug is a URL somebody
  // may have saved, so retyping the name must not silently move it.
  const [slugTouched, setSlugTouched] = useState(category !== null);

  function onNameChange(name: string): void {
    if (slugTouched) return;
    setSlugValue(deriveSlug(name, MAX_CATEGORY_SLUG) ?? "");
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    setMessage(null);
    setFieldErrors({});

    startTransition(async () => {
      const result = await saveCategoryAction(slug, category?.id ?? null, {
        name: String(form.get("name") ?? ""),
        slug: String(form.get("slug") ?? ""),
        parentId: String(form.get("parentId") ?? ""),
        isActive: form.get("isActive") !== null,
      });

      if (result.success) {
        router.push(listHref);
        router.refresh();
        return;
      }

      setMessage(result.message);
      setFieldErrors(result.fieldErrors ?? {});
    });
  }

  // A category cannot be its own parent. Deeper loops are refused server-side,
  // where the whole tree can be walked.
  const parents = parentOptions.filter((option) => option.id !== category?.id);

  return (
    <form onSubmit={onSubmit} className="max-w-2xl space-y-5" noValidate>
      <FormField htmlFor="name" label="Name" error={fieldErrors.name?.[0]}>
        <Input
          id="name"
          name="name"
          defaultValue={category?.name ?? ""}
          maxLength={150}
          onChange={(event) => onNameChange(event.target.value)}
          required
        />
      </FormField>

      <FormField
        htmlFor="slug"
        label="Web address"
        error={fieldErrors.slug?.[0]}
      >
        <Input
          id="slug"
          name="slug"
          value={slugValue}
          maxLength={MAX_CATEGORY_SLUG}
          onChange={(event) => {
            setSlugTouched(true);
            setSlugValue(event.target.value);
          }}
          required
        />
        <p className="text-muted-foreground text-xs">
          Lowercase letters, digits and hyphens.
          {category === null
            ? " Filled in from the name until you edit it."
            : " Changing it breaks any saved link to this category."}
        </p>
      </FormField>

      <FormField
        htmlFor="parentId"
        label="Parent category"
        error={fieldErrors.parentId?.[0]}
      >
        <Select
          id="parentId"
          name="parentId"
          defaultValue={category?.parentId ?? ""}
          options={[
            { value: "", label: "Top level" },
            ...parents.map((option) => ({
              value: option.id,
              label: option.name,
            })),
          ]}
        />
      </FormField>

      <Switch
        name="isActive"
        label="Visible to customers"
        defaultChecked={category?.isActive ?? true}
      />

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? (
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          ) : null}
          {category === null ? "Create category" : "Save changes"}
        </Button>

        <Button asChild variant="secondary">
          <a href={cancelHref}>Cancel</a>
        </Button>

        <p aria-live="polite" className="text-xs">
          {message ? <span className="text-destructive">{message}</span> : null}
        </p>
      </div>
    </form>
  );
}
