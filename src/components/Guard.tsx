import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Button, Spinner } from "@/components/ui-kit";
import { useI18n } from "@/lib/i18n";
import { useSession, type Role } from "@/lib/session";

export function Guard({
  roles,
  children,
}: {
  roles?: Role[];
  children: (ctx: { userId: string; role: Role }) => ReactNode;
}) {
  const { loading, user, role } = useSession();
  const { t } = useI18n();

  if (loading) {
    return (
      <AppShell role={null} signedIn={false}>
        <div className="grid place-items-center py-24 text-muted-foreground">
          <Spinner />
        </div>
      </AppShell>
    );
  }

  if (!user || !role) {
    return (
      <AppShell role={null} signedIn={false}>
        <div className="space-y-4 px-6 py-20 text-center">
          <p className="text-muted-foreground">{t("signInPrompt")}</p>
          <Link to="/auth">
            <Button>{t("signIn")}</Button>
          </Link>
        </div>
      </AppShell>
    );
  }

  if (roles && !roles.includes(role)) {
    return (
      <AppShell role={role} signedIn>
        <div className="px-6 py-20 text-center text-sm text-muted-foreground">
          This area is not available for your account type.
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell role={role} signedIn>
      {children({ userId: user.id, role })}
    </AppShell>
  );
}
