import { createFileRoute } from "@tanstack/react-router";
import { Guard } from "@/components/Guard";
import { Page } from "@/components/AppShell";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/admin/suppliers")({
  head: () => ({
    meta: [
      { title: "Suppliers — Ateeq" },
      { name: "description", content: "Verify suppliers and manage their platform status." },
      { property: "og:title", content: "Suppliers — Ateeq" },
      { property: "og:description", content: "Verify suppliers and manage their platform status." },
    ],
  }),
  component: () => <Guard roles={["admin"]}>{() => <Body />}</Guard>,
});

function Body() {
  const { t } = useI18n();
  return (
    <Page title={t("suppliers")}>
      <p className="text-sm text-muted-foreground">Coming up next in this build.</p>
    </Page>
  );
}
