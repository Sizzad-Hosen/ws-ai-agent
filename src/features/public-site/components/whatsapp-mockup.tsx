import { Bot, EllipsisVertical, Mic, Plus } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Static WhatsApp conversation, per DESIGN.md → WhatsApp Conversation Mockups.
 *
 * Agent bubbles are emerald on white text, lead bubbles light gray on charcoal,
 * and each bubble tucks the corner on its own side to 4px. It renders on the
 * server: the hero's largest element should not wait for JavaScript.
 */

export interface MockBubble {
  readonly id: string;
  readonly from: "agent" | "lead";
  readonly text: string;
  readonly card?: {
    readonly title: string;
    readonly price: string;
    readonly action: string;
  };
}

export const LANDING_CONVERSATION: readonly MockBubble[] = [
  {
    id: "lead-pricing",
    from: "lead",
    text: "Hi, I'm looking for a CRM solution for my team of 10. What are your pricing plans?",
  },
  {
    id: "agent-growth",
    from: "agent",
    text: "Hello! 👋 I can help with that. For a team of 10, our Growth Plan is perfect. It includes full WhatsApp automation and CRM integrations.",
    card: {
      title: "Growth Plan",
      price: "$49/user/month",
      action: "View Details",
    },
  },
  {
    id: "lead-onboarding",
    from: "lead",
    text: "That looks good. Can we schedule a quick call to go over onboarding?",
  },
  {
    id: "agent-schedule",
    from: "agent",
    text: "Absolutely. Let's get that scheduled. What day works best for you this week? 🗓️",
  },
];

export function WhatsappMockup({
  bubbles,
  typing = false,
  className,
}: {
  readonly bubbles: readonly MockBubble[];
  readonly typing?: boolean;
  readonly className?: string;
}) {
  return (
    <div
      className={cn(
        "bg-ps-panel border-ps-edge shadow-float rounded-card flex flex-col overflow-hidden border",
        className,
      )}
    >
      <div className="border-ps-edge flex items-center gap-3 border-b px-5 py-4">
        <span
          className="bg-ps-brand-wash text-ps-brand-deep grid size-10 shrink-0 place-items-center rounded-full"
          aria-hidden="true"
        >
          <Bot className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-ps-ink truncate text-sm font-semibold">
            SellPilot Assistant
          </p>
          <p className="text-ps-brand flex items-center gap-1.5 text-xs">
            <span
              className="bg-ps-brand size-1.5 rounded-full"
              aria-hidden="true"
            />
            Online
          </p>
        </div>
        <EllipsisVertical
          className="text-ps-ink-subtle size-4 shrink-0"
          aria-hidden="true"
        />
      </div>

      <div className="flex-1 space-y-3 px-5 py-4">
        <p className="text-ps-ink-subtle text-center text-xs">Today</p>

        {bubbles.map((bubble) => (
          <ChatBubble key={bubble.id} bubble={bubble} />
        ))}

        {typing ? <TypingIndicator /> : null}
      </div>

      <div className="border-ps-edge flex items-center gap-3 border-t px-5 py-4">
        <Plus
          className="text-ps-ink-subtle size-5 shrink-0"
          aria-hidden="true"
        />
        <span className="bg-ps-panel-soft text-ps-ink-subtle flex-1 rounded-full px-4 py-2 text-sm">
          Type a message...
        </span>
        <span
          className="bg-ps-brand grid size-9 shrink-0 place-items-center rounded-full text-white"
          aria-hidden="true"
        >
          <Mic className="size-4" />
        </span>
      </div>
    </div>
  );
}

function ChatBubble({ bubble }: { readonly bubble: MockBubble }) {
  const agent = bubble.from === "agent";

  return (
    <div className={cn("flex", agent ? "justify-start" : "justify-end")}>
      <div
        className={cn(
          "max-w-[85%] px-4 py-2.5 text-[15px] leading-relaxed",
          // "Tucked" corner on the speaker's side, per the design language.
          agent
            ? "bg-ps-brand rounded-t-3xl rounded-br-3xl rounded-bl text-white"
            : "bg-ps-panel-soft text-ps-ink rounded-t-3xl rounded-br rounded-bl-3xl",
        )}
      >
        <p className="text-pretty">{bubble.text}</p>

        {bubble.card ? (
          <span className="mt-3 block rounded-xl bg-white/15 p-3">
            <span className="block text-sm font-semibold">
              {bubble.card.title}
            </span>
            <span className="block text-xs text-white/90">
              {bubble.card.price}
            </span>
            <span className="text-ps-brand-deep mt-2 block rounded-lg bg-white/95 py-1.5 text-center text-xs font-semibold">
              {bubble.card.action}
            </span>
          </span>
        ) : null}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <span
        className="bg-ps-panel-soft flex items-center gap-1 rounded-full px-4 py-3"
        role="status"
        aria-label="Assistant is typing"
      >
        {[0, 1, 2].map((index) => (
          <span
            key={index}
            className="bg-ps-ink-subtle size-1.5 animate-bounce rounded-full"
            style={{ animationDelay: `${index * 0.15}s` }}
          />
        ))}
      </span>
    </div>
  );
}
