import "dotenv/config";

import { readFile, rm } from "node:fs/promises";
import path from "node:path";

import { compare, hash } from "bcryptjs";

import { env } from "@/config/env";
import { saveAvatar } from "@/features/profile/avatar-storage";
import { prisma } from "@/server/db/prisma";
import { repositories } from "@/server/repositories";

/**
 * Exercises the profile write paths against a real database and a real disk.
 *
 * The unit tests cover what counts as a valid image and a valid password. This
 * covers what the unit tests cannot: that the file lands where the URL says it
 * does, that the row keeps the URL and not the bytes, that the unique index on
 * `admin_users.email` actually reports a conflict, and that a password change
 * revokes other sessions while sparing the one that asked.
 *
 * Every fixture is its own row, created and removed here, so a real
 * administrator is never modified.
 */
function check(actual: unknown, expected: unknown, label: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

/** A 1x1 PNG, as the magic-byte check expects one to begin. */
const PNG_BYTES = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49,
  0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06,
  0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89,
]);

async function main(): Promise<void> {
  const unique = `verify-profile-${Date.now().toString(36)}`;
  const password = "Original-Password-1";

  const fixture = await prisma.adminUser.create({
    data: {
      name: "Verify Profile",
      email: `${unique}@example.test`,
      passwordHash: await hash(password, 12),
      role: "SUPPORT",
      status: "ACTIVE",
    },
    select: { id: true },
  });

  // A second administrator, so the email conflict is a real one.
  const rival = await prisma.adminUser.create({
    data: {
      name: "Verify Rival",
      email: `${unique}-rival@example.test`,
      passwordHash: await hash(password, 12),
      role: "SUPPORT",
      status: "ACTIVE",
    },
    select: { id: true, email: true },
  });

  const writtenFiles: string[] = [];

  try {
    // ---- the picture lands on disk, and the row keeps only its URL --------
    const saved = await saveAvatar(fixture.id, PNG_BYTES);
    if (!saved.ok) throw new Error(`Avatar rejected: ${saved.reason}`);

    const directory = path.resolve(env.AVATAR_UPLOAD_DIR);
    const fileName = path.basename(saved.url);
    const onDisk = path.join(directory, fileName);
    writtenFiles.push(onDisk);

    check(saved.url.startsWith(`${env.AVATAR_URL_BASE}/`), true, "url prefix");
    check(
      Buffer.compare(
        Buffer.from(await readFile(onDisk)),
        Buffer.from(PNG_BYTES),
      ),
      0,
      "the bytes on disk are the bytes uploaded",
    );

    // The generated name must not carry anything the uploader chose.
    check(
      fileName.startsWith(`${fixture.id}-`) && fileName.endsWith(".png"),
      true,
      "stored name is derived from the admin id",
    );

    const previous = await repositories.admins.updateAvatarUrl(
      fixture.id,
      saved.url,
    );
    check(previous, null, "no previous avatar to replace");

    const withAvatar = await repositories.admins.findById(fixture.id);
    check(withAvatar?.avatarUrl, saved.url, "row stores the url");

    // ---- a second upload replaces the first, and reports the old url ------
    const replacement = await saveAvatar(fixture.id, PNG_BYTES);
    if (!replacement.ok) throw new Error("Replacement avatar rejected.");
    writtenFiles.push(path.join(directory, path.basename(replacement.url)));

    check(
      replacement.url === saved.url,
      false,
      "each upload gets its own url, so a cached picture cannot persist",
    );

    const replaced = await repositories.admins.updateAvatarUrl(
      fixture.id,
      replacement.url,
    );
    check(replaced, saved.url, "the replaced url is returned for cleanup");

    // ---- an unsupported file never reaches the disk -----------------------
    const html = new TextEncoder().encode("<script>alert(1)</script>");
    const rejected = await saveAvatar(fixture.id, html);
    check(rejected.ok, false, "HTML is refused");

    // ---- name and email ---------------------------------------------------
    const updated = await repositories.admins.updateProfile(fixture.id, {
      name: "Renamed Admin",
      email: `${unique}-renamed@example.test`,
    });
    check(updated.ok, true, "profile update applied");

    const afterRename = await repositories.admins.findById(fixture.id);
    check(afterRename?.name, "Renamed Admin", "name persisted");
    check(
      afterRename?.email,
      `${unique}-renamed@example.test`,
      "email persisted",
    );
    check(
      afterRename?.role,
      "support",
      "the role is untouched by a profile update",
    );

    // ---- the unique index reports a conflict rather than throwing ---------
    const clash = await repositories.admins.updateProfile(fixture.id, {
      name: "Renamed Admin",
      email: rival.email,
    });
    check(clash, { ok: false, reason: "email-taken" }, "email conflict");

    const afterClash = await repositories.admins.findById(fixture.id);
    check(
      afterClash?.email,
      `${unique}-renamed@example.test`,
      "a refused email change leaves the row alone",
    );

    // ---- password change, and what it does to sessions --------------------
    const keptTokenHash = `${unique}-kept`;
    const otherTokenHash = `${unique}-other`;
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await repositories.sessions.create({
      adminId: fixture.id,
      tokenHash: keptTokenHash,
      expiresAt,
    });
    await repositories.sessions.create({
      adminId: fixture.id,
      tokenHash: otherTokenHash,
      expiresAt,
    });
    // A session belonging to someone else, which must not be touched.
    await repositories.sessions.create({
      adminId: rival.id,
      tokenHash: `${unique}-rival-session`,
      expiresAt,
    });

    const newHash = await hash("Replacement-Password-2", 12);
    await repositories.admins.updatePasswordHash(fixture.id, newHash);

    const credentials = await repositories.admins.findCredentialsById(
      fixture.id,
    );
    if (!credentials) throw new Error("Credentials vanished.");

    check(
      await compare("Replacement-Password-2", credentials.passwordHash),
      true,
      "the new password verifies",
    );
    check(
      await compare(password, credentials.passwordHash),
      false,
      "the old password no longer verifies",
    );

    const revoked = await repositories.sessions.revokeOthersForAdmin(
      fixture.id,
      keptTokenHash,
    );
    check(revoked, 1, "exactly the other session was revoked");

    check(
      (await repositories.sessions.findByTokenHash(keptTokenHash)) !== null,
      true,
      "the session that changed the password survives",
    );
    check(
      await repositories.sessions.findByTokenHash(otherTokenHash),
      null,
      "the other session is dead",
    );
    check(
      (await repositories.sessions.findByTokenHash(
        `${unique}-rival-session`,
      )) !== null,
      true,
      "another administrator's session is untouched",
    );

    console.log(
      `Profile verified: avatar written to ${fileName} and replaced, HTML refused, name and email updated, duplicate email reported, password changed and 1 of 2 sessions revoked while the rival's survived. Fixtures removed.`,
    );
  } finally {
    // Nothing cascades, so sessions go before the administrators they belong to.
    await prisma.adminSession.deleteMany({
      where: { adminUserId: { in: [fixture.id, rival.id] } },
    });
    await prisma.adminUser.deleteMany({
      where: { id: { in: [fixture.id, rival.id] } },
    });

    for (const file of writtenFiles) {
      await rm(file, { force: true });
    }
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
