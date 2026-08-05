import { createFileRoute } from "@tanstack/react-router";
import { Guard } from "@/components/Guard";
import { Page } from "@/components/AppShell";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/admin/orders")({
  head: () => ({
    meta: [
      { title: "All orders — Ateeq" },
      { name: "description", content: "Monitor every order and platform commission." },
      { property: "og:title", content: "All orders — Ateeq" },
      { property: "og:description", content: "Monitor every order and platform commission." },
    ],
  }),
  component: () => <Guard roles={["admin"]}>{() => <Body />}</Guard>,
});

function Body() {
  const { t } = useI18n();
  return (
    <Page title={t("orders")}>
      <p className="text-sm text-muted-foreground">Coming up next in this build.</p>
    </Page>
  );
}
