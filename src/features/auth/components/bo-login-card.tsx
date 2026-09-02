import { BotMessageSquare } from "lucide-react";

import { APP_CONFIG } from "@/config/app";

import { LoginForm } from "./login-form";

export function BoLoginCard() {
  return (
    <section className="bg-card mx-auto w-full max-w-[440px] rounded-2xl border p-6 shadow-xl shadow-slate-900/5 sm:p-9">
      <div className="text-center">
        <span className="bg-primary text-primary-foreground mx-auto grid size-12 place-items-center rounded-xl shadow-sm">
          <BotMessageSquare className="size-6" aria-hidden="true" />
        </span>
        <p className="text-primary mt-4 text-sm font-semibold">
          {APP_CONFIG.shortName}
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          Welcome back
        </h1>
        <p className="text-muted-foreground mt-2 text-sm leading-6">
          Sign in to manage the SaaS platform and its tenants.
        </p>
      </div>
      <LoginForm />
      <p className="text-muted-foreground mt-7 text-center text-xs leading-5">
        This portal is restricted to authorized platform administrators.
      </p>
    </section>
  );
}
