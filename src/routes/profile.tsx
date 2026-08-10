import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Guard } from "@/components/Guard";
import { Page } from "@/components/AppShell";
import { Button, Card, Field, Input, Spinner } from "@/components/ui-kit";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { errorMessage } from "@/lib/utils";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "My profile — MazzadTech" },
      { name: "description", content: "View and edit your account information." },
      { property: "og:title", content: "My profile — MazzadTech" },
      { property: "og:description", content: "View and edit your account information." },
    ],
  }),
  component: () => <Guard roles={["customer"]}>{(ctx) => <ProfileBody userId={ctx.userId} />}</Guard>,
});

function ProfileBody({ userId }: { userId: string }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["my-profile", userId],
    queryFn: async () => {
      const [{ data: profile, error: profileError }, { data: authUser }] = await Promise.all([
        supabase.from("profiles").select("full_name, phone").eq("id", userId).single(),
        supabase.auth.getUser(),
      ]);
      if (profileError) throw profileError;
      return { profile, email: authUser.user?.email ?? null };
    },
  });

  // Prefill the editable fields once the profile loads (only the first time,
  // so we don't stomp on text the person is actively typing).
  useEffect(() => {
    if (!data) return;
    setFullName((prev) => prev || data.profile.full_name || "");
    setPhone((prev) => prev || data.profile.phone || "");
  }, [data]);

  const save = async () => {
    setSaving(true);
    try {
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ full_name: fullName.trim() || null, phone: phone.trim() || null })
        .eq("id", userId);
      if (updateError) throw updateError;
      await qc.invalidateQueries({ queryKey: ["my-profile", userId] });
      toast.success(t("profileSaved"));
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  if (error) {
    return (
      <Page title={t("profile")}>
        <p className="rounded-xl bg-destructive/10 px-3 py-2 text-xs text-destructive">{errorMessage(error)}</p>
      </Page>
    );
  }

  if (isLoading || !data) {
    return (
      <Page title={t("profile")}>
        <div className="grid place-items-center py-16 text-muted-foreground">
          <Spinner />
        </div>
      </Page>
    );
  }

  return (
    <Page title={t("profile")}>
      <Card className="space-y-3">
        <Field label={t("email")}>
          <Input value={data.email ?? ""} disabled />
        </Field>
        <Field label={t("fullName")}>
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </Field>
        <Field label={t("phone")}>
          <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+970 5X XXX XXXX" />
        </Field>
        <Button className="w-full" onClick={save} disabled={saving}>
          {saving ? <Spinner /> : t("saveChanges")}
        </Button>
      </Card>
    </Page>
  );
}
