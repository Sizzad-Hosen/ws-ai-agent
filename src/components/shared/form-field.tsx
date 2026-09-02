import type { ReactNode } from "react";

import { Label } from "@/components/ui/label";

interface FormFieldProps {
  readonly htmlFor: string;
  readonly label: string;
  readonly error?: string;
  readonly children: ReactNode;
}

export function FormField({ htmlFor, label, error, children }: FormFieldProps) {
  const errorId = `${htmlFor}-error`;

  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? (
        <p id={errorId} className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
