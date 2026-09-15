"use client";

import { LoaderCircle, Send } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  previewCatalogueAction,
  type PreviewMatch,
} from "@/features/tenant-whatsapp/actions/wizard-actions";
import type { Locale } from "@/lib/i18n/translate";
import { translate } from "@/lib/i18n/translate";

/**
 * The first screen: try it before connecting anything.
 *
 * A shop owner types what a customer would type and sees their own products
 * come back. Nobody finishes a twenty-click Meta setup on faith, and this is
 * the screen that earns the next four.
 *
 * What it is not: the agent. Nothing in this repository calls a language model
 * yet, so this searches the tenant's catalogue and shows what it found. That
 * is the same data the agent will be grounded on, and it is honest about what
 * it is — a canned "Yes! We have that!" would be a demo, not a preview.
 *
 * Strings are translated on the client with the locale the server resolved,
 * because `Translator` is a function and functions do not cross the boundary.
 */

interface Turn {
  readonly question: string;
  readonly matches: readonly PreviewMatch[];
}

interface StepOnePreviewProps {
  readonly slug: string;
  readonly locale: Locale;
}

export function StepOnePreview({ slug, locale }: StepOnePreviewProps) {
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);

  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<readonly Turn[]>([]);
  const [busy, setBusy] = useState(false);

  async function onAsk(): Promise<void> {
    const asked = question.trim();
    if (asked === "" || busy) return;

    setBusy(true);
    setQuestion("");

    const result = await previewCatalogueAction({ slug, query: asked });

    setTurns((previous) => [
      ...previous,
      { question: asked, matches: result.ok ? result.data : [] },
    ]);
    setBusy(false);
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold">{t("wizard.step1.title")}</h3>
        <p className="text-muted-foreground mt-1 max-w-prose text-sm leading-6">
          {t("wizard.step1.body")}
        </p>
      </div>

      {/* Sized so the panel does not jump as answers arrive. */}
      <div className="bg-muted/40 min-h-56 space-y-3 rounded-xl p-4">
        {turns.length === 0 ? (
          <p className="text-muted-foreground py-8 text-center text-sm">
            {t("wizard.step1.placeholder")}
          </p>
        ) : null}

        {turns.map((turn, index) => (
          <div key={index} className="space-y-2">
            <p className="bg-primary text-primary-foreground ml-auto w-fit max-w-[80%] rounded-2xl rounded-br-sm px-3 py-2 text-sm">
              {turn.question}
            </p>

            <div className="bg-card w-fit max-w-[90%] rounded-2xl rounded-bl-sm px-3 py-2 text-sm shadow-sm">
              {turn.matches.length === 0 ? (
                <p className="text-muted-foreground">
                  Nothing in your catalogue matches that yet.
                </p>
              ) : (
                <ul className="space-y-1">
                  {turn.matches.map((match) => (
                    <li key={match.name} className="flex flex-wrap gap-x-2">
                      <span className="font-medium">{match.name}</span>
                      <span className="text-muted-foreground">
                        {match.price}
                      </span>
                      {!match.inStock ? (
                        <span className="text-destructive text-xs">
                          out of stock
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ))}
      </div>

      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void onAsk();
        }}
      >
        <Input
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder={t("wizard.step1.placeholder")}
          aria-label={t("wizard.step1.placeholder")}
          maxLength={120}
        />
        <Button type="submit" disabled={busy || question.trim() === ""}>
          {busy ? (
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Send className="size-4" aria-hidden="true" />
          )}
        </Button>
      </form>
    </div>
  );
}
