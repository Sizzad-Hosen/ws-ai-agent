import { z } from "zod";

export const loginSchema = z.object({
  email: z.email("Enter a valid email address.").trim().toLowerCase(),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters.")
    .max(128, "Password must be 128 characters or fewer."),
  rememberMe: z.boolean(),
});

export type LoginInput = z.infer<typeof loginSchema>;

export type LoginActionResult =
  | { readonly success: true }
  | {
      readonly success: false;
      readonly message: string;
      readonly fieldErrors?: Readonly<
        Partial<Record<keyof LoginInput, readonly string[]>>
      >;
    };
