import type { Metadata } from "next";
import { KeyRound, ShieldCheck, UserRound } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, Field } from "@/components/ui/card";
import { AvatarUpload } from "@/features/profile/components/avatar-upload";
import { PasswordChangeForm } from "@/features/profile/components/password-change-form";
import { ProfileDetailsForm } from "@/features/profile/components/profile-details-form";
import { requireBoAdmin } from "@/server/auth/authorization";
import { repositories } from "@/server/repositories";
import { formatOptionalDate } from "@/utils/format";

export const metadata: Metadata = {
  title: "Your Profile",
};

/**
 * The administrator's own account.
 *
 * Guarded by `requireBoAdmin` rather than a permission: every signed-in
 * administrator has a profile, and gating it would lock the lowest role out of
 * their own name and password.
 *
 * Role and status are shown but not editable. They are granted by someone
 * else, and a profile form that could change them would be a self-service
 * route to a higher role.
 */
export default async function ProfilePage() {
  const session = await requireBoAdmin();

  // The session carries only what the shell needs, so the row is read for the
  // avatar, status and timestamps this screen shows.
  const admin = await repositories.admins.findById(session.id);

  if (!admin) {
    // The session resolved, so the row existed moments ago. Nothing sensible
    // to render if it has gone.
    throw new Error("The signed-in administrator no longer exists.");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Your Profile"
        description="Your name, picture and password. Role and access are set by a platform owner."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Profile picture"
            icon={<UserRound className="size-4" aria-hidden="true" />}
          />
          <CardBody>
            <AvatarUpload name={admin.name} avatarUrl={admin.avatarUrl} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Account"
            icon={<ShieldCheck className="size-4" aria-hidden="true" />}
          />
          <CardBody className="grid gap-5 sm:grid-cols-2">
            <Field label="Role">
              <Badge tone="info" className="capitalize">
                {admin.role.replaceAll("_", " ")}
              </Badge>
            </Field>
            <Field label="Status">
              <Badge
                tone={admin.status === "active" ? "success" : "warning"}
                className="capitalize"
              >
                {admin.status}
              </Badge>
            </Field>
            <Field label="Last signed in">
              {formatOptionalDate(admin.lastSignedInAt)}
            </Field>
            <Field label="Member since">
              {formatOptionalDate(admin.createdAt)}
            </Field>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Your details"
            icon={<UserRound className="size-4" aria-hidden="true" />}
          />
          <CardBody>
            <ProfileDetailsForm
              defaultValues={{ name: admin.name, email: admin.email }}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Password"
            icon={<KeyRound className="size-4" aria-hidden="true" />}
          />
          <CardBody>
            <PasswordChangeForm />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
