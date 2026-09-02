import "server-only";

import { compare, hash } from "bcryptjs";

import type { LoginInput } from "@/features/auth/schemas";
import type { AdminRepository } from "@/server/repositories/contracts/admin-repository";
import type { SessionRepository } from "@/server/repositories/contracts/session-repository";

import {
  createSessionToken,
  getSessionExpiry,
  hashSessionToken,
} from "./session";

const dummyHashPromise = hash("invalid-development-credential", 12);

interface BoAuthServiceDependencies {
  readonly admins: AdminRepository;
  readonly sessions: SessionRepository;
}

export interface SuccessfulLogin {
  readonly token: string;
  readonly expiresAt: Date;
}

export class BoAuthService {
  constructor(private readonly dependencies: BoAuthServiceDependencies) {}

  async login(input: LoginInput): Promise<SuccessfulLogin | null> {
    const credentials = await this.dependencies.admins.findCredentialsByEmail(
      input.email,
    );
    const passwordHash = credentials?.passwordHash ?? (await dummyHashPromise);
    const passwordMatches = await compare(input.password, passwordHash);

    if (!credentials || !credentials.isActive || !passwordMatches) {
      return null;
    }

    const token = createSessionToken();
    const expiresAt = getSessionExpiry(input.rememberMe);

    await this.dependencies.sessions.create({
      adminId: credentials.id,
      tokenHash: hashSessionToken(token),
      expiresAt,
    });
    await this.dependencies.admins.markSignedIn(credentials.id, new Date());

    return { token, expiresAt };
  }
}
