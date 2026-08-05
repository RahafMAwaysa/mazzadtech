import { createFileRoute } from "@tanstack/react-router";
import { Guard } from "@/components/Guard";
import { Page } from "@/components/AppShell";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/supplier/orders")({
  head: () => ({
    meta: [
      { title: "Supplier orders — Ateeq" },
      { name: "description", content: "Manage confirmed orders and update their delivery status." },
      { property: "og:title", content: "Supplier orders — Ateeq" },
      { property: "og:description", content: "Manage confirmed orders and update their delivery status." },
    ],
  }),
  component: () => <Guard roles={["supplier","admin"]}>{() => <Body />}</Guard>,
});

function Body() {
  const { t } = useI18n();
  return (
    <Page title={t("orders")}>
      <p className="text-sm text-muted-foreground">Coming up next in this build.</p>
    </Page>
  );
}
