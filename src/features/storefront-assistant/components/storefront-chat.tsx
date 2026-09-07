"use client";

import {
  Bot,
  Check,
  LoaderCircle,
  MessageCircle,
  MoreVertical,
  Send,
  X,
} from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";

import { cn } from "@/lib/utils";

import {
  resetAssistantDraftAction,
  sendAssistantMessageAction,
} from "@/features/storefront-assistant/actions";
import type {
  AssistantTurn,
  ProductCard,
} from "@/features/storefront-assistant/agent";

interface StorefrontChatProps {
  readonly slug: string;
  readonly businessName: string;
  readonly greeting: string;
  readonly openingQuestions: readonly string[];
}

interface Bubble extends AssistantTurn {
  readonly id: string;
  readonly orderNumber?: string | null;
  readonly cards?: readonly ProductCard[];
}

/**
 * The shop's chat, on the shop's own page.
 *
 * A floating panel rather than a page of its own: a shopper who has to
 * navigate away to ask "is it in stock?" mostly does not ask.
 *
 * The transcript lives here, in the browser, and is sent back with each turn
 * for phrasing context. What the shopper has actually *chosen* does not live
 * here — that is in a signed, HTTP-only cookie the server owns, so editing
 * this component's state cannot change what an order costs. The product cards
 * are the same story: the button sends a variant id, and the server re-reads
 * that row before it quotes anything from it.
 */
export function StorefrontChat({
  slug,
  businessName,
  greeting,
  openingQuestions,
}: StorefrontChatProps) {
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [quickReplies, setQuickReplies] =
    useState<readonly string[]>(openingQuestions);
  const [bubbles, setBubbles] = useState<readonly Bubble[]>([
    { id: "greeting", role: "assistant", text: greeting },
  ]);
  const [isPending, startTransition] = useTransition();

  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // A counter rather than a timestamp: React's purity rules rightly object to
  // reading the clock here, and a bubble only needs an id that is unique
  // within this transcript.
  const nextId = useRef(0);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [bubbles, isPending]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  function send(text: string, selectVariantId?: string): void {
    const message = text.trim();

    if (message === "" || isPending) return;

    nextId.current += 1;
    setMenuOpen(false);

    const outgoing: Bubble = {
      id: `c-${nextId.current}`,
      role: "customer",
      text: message,
    };

    // The history sent to the server is the transcript *before* this message,
    // which the action takes separately — the same split the server expects,
    // so a turn is never counted twice.
    const history = bubbles
      .filter((bubble) => bubble.id !== "greeting")
      .map(({ role, text: content }) => ({ role, text: content }));

    setBubbles((current) => [...current, outgoing]);
    setDraft("");
    setQuickReplies([]);

    startTransition(async () => {
      const outcome = await sendAssistantMessageAction({
        slug,
        message,
        history,
        selectVariantId: selectVariantId ?? null,
      });

      setBubbles((current) => [
        ...current,
        {
          id: `a-${nextId.current}`,
          role: "assistant",
          text: outcome.reply,
          orderNumber: outcome.orderNumber,
          cards: outcome.cards,
        },
      ]);
      setQuickReplies(outcome.quickReplies);
    });
  }

  function startOver(): void {
    setMenuOpen(false);
    setBubbles([{ id: "greeting", role: "assistant", text: greeting }]);
    setQuickReplies(openingQuestions);
    setDraft("");

    // The half-finished order goes too. Clearing only the transcript left a
    // shopper looking at a fresh chat while the server still read every
    // message as the answer to a question they could no longer see.
    startTransition(async () => {
      await resetAssistantDraftAction(slug);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-controls="storefront-chat-panel"
        className="bg-ps-brand-deep fixed right-5 bottom-5 z-40 inline-flex h-14 items-center gap-2 rounded-full px-5 text-[15px] font-medium text-white shadow-lg transition-transform hover:scale-[1.02] focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        {open ? (
          <X className="size-5" aria-hidden="true" />
        ) : (
          <MessageCircle className="size-5" aria-hidden="true" />
        )}
        {open ? "Close" : "Chat with us"}
      </button>

      <section
        id="storefront-chat-panel"
        hidden={!open}
        aria-label={`Chat with ${businessName}`}
        className="border-ps-edge bg-ps-panel fixed right-5 bottom-24 z-40 flex h-[min(34rem,calc(100vh-9rem))] w-[min(24rem,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-2xl border shadow-2xl"
      >
        <header className="border-ps-edge flex items-center gap-3 border-b px-4 py-3">
          <span
            className="bg-ps-brand-wash grid size-10 shrink-0 place-items-center rounded-full"
            aria-hidden="true"
          >
            <Bot className="text-ps-brand-deep size-5" />
          </span>

          <span className="min-w-0 flex-1">
            <span className="text-ps-ink block truncate text-sm font-semibold">
              {businessName} Assistant
            </span>
            <span className="text-ps-brand-deep flex items-center gap-1.5 text-xs">
              <span
                className="bg-ps-brand size-1.5 rounded-full"
                aria-hidden="true"
              />
              Online
            </span>
          </span>

          <span className="relative shrink-0">
            <button
              type="button"
              onClick={() => setMenuOpen((current) => !current)}
              aria-expanded={menuOpen}
              aria-label="Chat options"
              className="text-ps-ink-subtle hover:bg-ps-page grid size-8 place-items-center rounded-full transition-colors"
            >
              <MoreVertical className="size-4" aria-hidden="true" />
            </button>

            {menuOpen ? (
              <span className="border-ps-edge bg-ps-panel absolute right-0 z-10 mt-1 flex w-40 flex-col overflow-hidden rounded-xl border py-1 shadow-lg">
                <button
                  type="button"
                  onClick={startOver}
                  className="text-ps-ink hover:bg-ps-page px-3 py-2 text-left text-sm"
                >
                  Start over
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    setOpen(false);
                  }}
                  className="text-ps-ink hover:bg-ps-page px-3 py-2 text-left text-sm"
                >
                  Close chat
                </button>
              </span>
            ) : null}
          </span>
        </header>

        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
          <p className="text-ps-ink-subtle text-center text-xs">Today</p>

          {bubbles.map((bubble) => (
            <div
              key={bubble.id}
              className={cn(
                "flex",
                bubble.role === "customer" ? "justify-end" : "justify-start",
              )}
            >
              <div
                className={cn(
                  "max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm leading-6",
                  bubble.role === "customer"
                    ? "bg-ps-panel-soft text-ps-ink rounded-br-sm"
                    : "bg-ps-brand rounded-bl-sm text-white",
                )}
              >
                <p className="whitespace-pre-wrap">{bubble.text}</p>

                {bubble.orderNumber ? (
                  <p className="mt-2 flex items-center gap-1.5 rounded-lg bg-white/15 px-2.5 py-1.5 text-xs font-medium">
                    <Check className="size-3.5 shrink-0" aria-hidden="true" />
                    Order {bubble.orderNumber}
                  </p>
                ) : null}

                {bubble.cards?.length ? (
                  <ul className="mt-2.5 space-y-2">
                    {bubble.cards.map((card) => (
                      <li
                        key={card.variantId}
                        className="rounded-xl bg-white/15 p-3"
                      >
                        <p className="text-sm font-semibold">
                          {card.productName}
                        </p>
                        <p className="text-xs text-white/85">
                          {card.stockLabel === ""
                            ? card.price
                            : `${card.price} · ${card.stockLabel}`}
                        </p>
                        <button
                          type="button"
                          disabled={isPending || card.available === 0}
                          onClick={() =>
                            send(
                              `${card.actionLabel}: ${card.productName}`,
                              card.variantId,
                            )
                          }
                          className="text-ps-brand-deep mt-2.5 h-9 w-full rounded-lg bg-white text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
                        >
                          {card.actionLabel}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>
          ))}

          {isPending ? (
            <p
              className="text-ps-ink-subtle flex items-center gap-2 text-xs"
              role="status"
            >
              <LoaderCircle
                className="size-3.5 animate-spin"
                aria-hidden="true"
              />
              Typing…
            </p>
          ) : null}

          <div ref={endRef} />
        </div>

        {quickReplies.length > 0 ? (
          <div className="flex flex-wrap gap-2 px-4 pb-3">
            {quickReplies.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                disabled={isPending}
                onClick={() => send(suggestion)}
                className="border-ps-edge text-ps-ink hover:bg-ps-page rounded-full border px-3 py-1.5 text-xs transition-colors disabled:opacity-50"
              >
                {suggestion}
              </button>
            ))}
          </div>
        ) : null}

        <form
          onSubmit={(event) => {
            event.preventDefault();
            send(draft);
          }}
          className="border-ps-edge flex items-center gap-2 border-t px-3 py-3"
        >
          <label className="sr-only" htmlFor="storefront-chat-input">
            Your message
          </label>
          <input
            id="storefront-chat-input"
            ref={inputRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            maxLength={1000}
            autoComplete="off"
            placeholder="Type your message…"
            className="border-ps-edge bg-ps-page text-ps-ink placeholder:text-ps-ink-subtle h-10 flex-1 rounded-full border px-4 text-sm focus-visible:outline-2 focus-visible:outline-offset-2"
          />
          <button
            type="submit"
            disabled={isPending || draft.trim() === ""}
            aria-label="Send message"
            className="bg-ps-brand-deep grid size-10 shrink-0 place-items-center rounded-full text-white transition-opacity disabled:opacity-40"
          >
            <Send className="size-4" aria-hidden="true" />
          </button>
        </form>
      </section>
    </>
  );
}
