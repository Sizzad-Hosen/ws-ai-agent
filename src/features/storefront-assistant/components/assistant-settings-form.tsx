"use client";

import { useRouter } from "next/navigation";
import { LoaderCircle, Plus, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";

import { FormField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { saveAssistantAction } from "@/features/storefront-assistant/dashboard-actions";
import type {
  AssistantSettings,
  FaqEntry,
} from "@/features/storefront-assistant/settings";

interface AssistantSettingsFormProps {
  readonly slug: string;
  readonly settings: AssistantSettings;
  readonly faq: readonly FaqEntry[];
}

interface FaqRow extends FaqEntry {
  /** Local only: React needs a key that survives reordering and removal. */
  readonly key: string;
}

/**
 * Everything the shop owner decides about their storefront assistant.
 *
 * The FAQ is the assistant's knowledge base: what it retrieves from when a
 * customer asks about delivery, returns or payment. An empty FAQ is honest
 * rather than broken — the assistant says it will check with the shop instead
 * of inventing a returns policy on the shop's behalf.
 */
export function AssistantSettingsForm({
  slug,
  settings,
  faq,
}: AssistantSettingsFormProps) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(settings.enabled);
  const [rows, setRows] = useState<readonly FaqRow[]>(() =>
    faq.map((entry, index) => ({ ...entry, key: `faq-${index}` })),
  );
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<
    Record<string, string[] | undefined>
  >({});
  const [isPending, startTransition] = useTransition();

  function updateRow(key: string, patch: Partial<FaqEntry>): void {
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    );
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    setMessage(null);
    setError(null);
    setFieldErrors({});

    startTransition(async () => {
      const outcome = await saveAssistantAction(slug, {
        settings: {
          enabled,
          greeting: String(form.get("greeting") ?? ""),
          greetingBangla: String(form.get("greetingBangla") ?? ""),
          instructions: String(form.get("instructions") ?? ""),
          currency: String(form.get("currency") ?? ""),
          homeCity: String(form.get("homeCity") ?? ""),
          deliveryInsideCity: String(form.get("deliveryInsideCity") ?? ""),
          deliveryOutsideCity: String(form.get("deliveryOutsideCity") ?? ""),
        },
        // Blank rows are dropped rather than rejected: an owner who added a
        // row and changed their mind should not have to delete it to save.
        faq: rows
          .filter(
            (row) => row.question.trim() !== "" || row.answer.trim() !== "",
          )
          .map(({ question, answer, answerBangla }) => ({
            question,
            answer,
            answerBangla,
          })),
      });

      if (outcome.success) {
        setMessage(outcome.message);
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
          title="Storefront chat"
          description="The assistant answers on your public site, in Bangla or English, and can take orders."
        />
        <CardBody className="space-y-5">
          <span className="flex items-center gap-3 text-sm">
            <Switch
              label="Assistant enabled"
              defaultChecked={enabled}
              onCheckedChange={setEnabled}
            />
            Show the chat on my storefront
          </span>

          <FormField
            htmlFor="greeting"
            label="Opening message (English)"
            error={fieldErrors["settings.greeting"]?.[0]}
          >
            <Textarea
              id="greeting"
              name="greeting"
              rows={2}
              placeholder="Leave blank to use a standard welcome."
              defaultValue={settings.greeting}
            />
          </FormField>

          <FormField
            htmlFor="greetingBangla"
            label="Opening message (Bangla)"
            error={fieldErrors["settings.greetingBangla"]?.[0]}
          >
            <Textarea
              id="greetingBangla"
              name="greetingBangla"
              rows={2}
              defaultValue={settings.greetingBangla}
            />
          </FormField>

          <FormField
            htmlFor="instructions"
            label="House rules for the assistant"
            error={fieldErrors["settings.instructions"]?.[0]}
          >
            <Textarea
              id="instructions"
              name="instructions"
              rows={3}
              placeholder="E.g. we do not deliver outside the city on Fridays."
              defaultValue={settings.instructions}
            />
          </FormField>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Prices and delivery"
          description="Used in the chat, on your storefront, and on every order the assistant takes."
        />
        <CardBody className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <FormField
            htmlFor="currency"
            label="Currency"
            error={fieldErrors["settings.currency"]?.[0]}
          >
            <Input
              id="currency"
              name="currency"
              required
              maxLength={3}
              placeholder="BDT"
              defaultValue={settings.currency}
            />
          </FormField>

          <FormField
            htmlFor="homeCity"
            label="Home city"
            error={fieldErrors["settings.homeCity"]?.[0]}
          >
            <Input
              id="homeCity"
              name="homeCity"
              placeholder="Dhaka"
              defaultValue={settings.homeCity}
            />
          </FormField>

          <FormField
            htmlFor="deliveryInsideCity"
            label="Delivery in city"
            error={fieldErrors["settings.deliveryInsideCity"]?.[0]}
          >
            <Input
              id="deliveryInsideCity"
              name="deliveryInsideCity"
              required
              inputMode="decimal"
              defaultValue={settings.deliveryInsideCity}
            />
          </FormField>

          <FormField
            htmlFor="deliveryOutsideCity"
            label="Delivery elsewhere"
            error={fieldErrors["settings.deliveryOutsideCity"]?.[0]}
          >
            <Input
              id="deliveryOutsideCity"
              name="deliveryOutsideCity"
              required
              inputMode="decimal"
              defaultValue={settings.deliveryOutsideCity}
            />
          </FormField>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="What the assistant knows"
          description="Questions customers ask and the answers you want given. The assistant will not answer a policy question you have not written down."
          actions={
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() =>
                setRows((current) => [
                  ...current,
                  {
                    key: `faq-${Date.now()}`,
                    question: "",
                    answer: "",
                    answerBangla: "",
                  },
                ])
              }
            >
              <Plus className="size-4" aria-hidden="true" />
              Add answer
            </Button>
          }
        />
        <CardBody className="space-y-5">
          {rows.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Nothing yet. Add your delivery, payment and return answers so the
              assistant can give them.
            </p>
          ) : null}

          {rows.map((row, index) => (
            <div
              key={row.key}
              className="border-border space-y-3 rounded-lg border p-4"
            >
              <div className="flex items-start gap-3">
                <div className="flex-1">
                  <FormField
                    htmlFor={`question-${row.key}`}
                    label="Question"
                    error={fieldErrors[`faq.${index}.question`]?.[0]}
                  >
                    <Input
                      id={`question-${row.key}`}
                      value={row.question}
                      placeholder="How long does delivery take?"
                      onChange={(event) =>
                        updateRow(row.key, { question: event.target.value })
                      }
                    />
                  </FormField>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive mt-8"
                  onClick={() =>
                    setRows((current) =>
                      current.filter((candidate) => candidate.key !== row.key),
                    )
                  }
                  aria-label={`Remove answer ${index + 1}`}
                >
                  <Trash2 className="size-3.5" aria-hidden="true" />
                </Button>
              </div>

              <FormField
                htmlFor={`answer-${row.key}`}
                label="Answer"
                error={fieldErrors[`faq.${index}.answer`]?.[0]}
              >
                <Textarea
                  id={`answer-${row.key}`}
                  rows={2}
                  value={row.answer}
                  onChange={(event) =>
                    updateRow(row.key, { answer: event.target.value })
                  }
                />
              </FormField>

              <FormField
                htmlFor={`answer-bn-${row.key}`}
                label="Answer in Bangla (optional)"
                error={fieldErrors[`faq.${index}.answerBangla`]?.[0]}
              >
                <Textarea
                  id={`answer-bn-${row.key}`}
                  rows={2}
                  value={row.answerBangla}
                  onChange={(event) =>
                    updateRow(row.key, { answerBangla: event.target.value })
                  }
                />
              </FormField>
            </div>
          ))}
        </CardBody>
      </Card>

      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="text-sm text-emerald-700" role="status">
          {message}
        </p>
      ) : null}

      <div className="flex justify-end">
        <Button type="submit" disabled={isPending}>
          {isPending ? (
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          ) : null}
          Save assistant settings
        </Button>
      </div>
    </form>
  );
}
