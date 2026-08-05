import { createFileRoute } from "@tanstack/react-router";
import { Guard } from "@/components/Guard";
import { Page } from "@/components/AppShell";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [
      { title: "Admin dashboard — Ateeq" },
      { name: "description", content: "Platform overview of customers, suppliers, orders and revenue." },
      { property: "og:title", content: "Admin dashboard — Ateeq" },
      { property: "og:description", content: "Platform overview of customers, suppliers, orders and revenue." },
    ],
  }),
  component: () => <Guard roles={["admin"]}>{() => <Body />}</Guard>,
});

function Body() {
  const { t } = useI18n();
  return (
    <Page title={t("dashboard")}>
      <p className="text-sm text-muted-foreground">Coming up next in this build.</p>
    </Page>
  );
}
