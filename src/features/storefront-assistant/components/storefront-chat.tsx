"use client";

import { LoaderCircle, MessageCircle, Send, X } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";

import { cn } from "@/lib/utils";

import { sendAssistantMessageAction } from "@/features/storefront-assistant/actions";
import type { AssistantTurn } from "@/features/storefront-assistant/agent";

interface StorefrontChatProps {
  readonly slug: string;
  readonly businessName: string;
  readonly greeting: string;
  readonly openingQuestions: readonly string[];
}

interface Bubble extends AssistantTurn {
  readonly id: string;
  readonly orderNumber?: string | null;
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
 * this component's state cannot change what an order costs.
 */
export function StorefrontChat({
  slug,
  businessName,
  greeting,
  openingQuestions,
}: StorefrontChatProps) {
  const [open, setOpen] = useState(false);
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

  function send(text: string): void {
    const message = text.trim();

    if (message === "" || isPending) return;

    nextId.current += 1;

    const outgoing: Bubble = {
      id: `c-${nextId.current}`,
      role: "customer",
      text: message,
    };

    // The history sent to the server is the transcript *before* this message,
    // which the action takes as the message itself — the same split the server
    // expects, so a turn is never counted twice.
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
      });

      setBubbles((current) => [
        ...current,
        {
          id: `a-${nextId.current}`,
          role: "assistant",
          text: outcome.reply,
          orderNumber: outcome.orderNumber,
        },
      ]);
      setQuickReplies(outcome.quickReplies);
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
        className="border-ps-edge bg-ps-panel fixed right-5 bottom-24 z-40 flex h-[min(32rem,calc(100vh-9rem))] w-[min(24rem,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-2xl border shadow-2xl"
      >
        <header className="border-ps-edge bg-ps-page border-b px-4 py-3">
          <p className="text-ps-ink text-sm font-semibold">{businessName}</p>
          <p className="text-ps-ink-subtle text-xs">
            Ask in বাংলা or English — I can take your order here.
          </p>
        </header>

        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {bubbles.map((bubble) => (
            <div
              key={bubble.id}
              className={cn(
                "flex",
                bubble.role === "customer" ? "justify-end" : "justify-start",
              )}
            >
              <p
                className={cn(
                  "max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-6 whitespace-pre-wrap",
                  bubble.role === "customer"
                    ? "bg-ps-brand-deep rounded-br-sm text-white"
                    : "bg-ps-page text-ps-ink border-ps-edge rounded-bl-sm border",
                  bubble.orderNumber ? "ring-2 ring-emerald-500/40" : null,
                )}
              >
                {bubble.text}
              </p>
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
