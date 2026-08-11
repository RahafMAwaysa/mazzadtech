import { createFileRoute, Link } from "@tanstack/react-router";
import { MessageSquareHeart, Gavel, Sparkles, ShieldCheck, Headphones, BadgeCheck } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button, Card } from "@/components/ui-kit";
import { useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/session";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MazzadTech — AI reverse auction for electronics" },
      {
        name: "description",
        content:
          "Describe the device you need in your own words and let verified suppliers compete with their best offers on laptops, phones, cameras and more.",
      },
      { property: "og:title", content: "MazzadTech — AI reverse auction for electronics" },
      {
        property: "og:description",
        content: "Describe the device you need in your own words and let verified suppliers compete with their best offers on laptops, phones, cameras and more.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const { t } = useI18n();
  const { role, user } = useSession();

  const steps = [
    { icon: MessageSquareHeart, title: t("step1"), body: t("step1d") },
    { icon: Gavel, title: t("step2"), body: t("step2d") },
    { icon: Sparkles, title: t("step3"), body: t("step3d") },
  ];

  return (
    <AppShell role={role} signedIn={!!user}>
      <section className="hero-gradient px-5 pb-10 pt-10 text-primary-foreground">
        <p className="text-xs font-medium opacity-80">{t("tagline")}</p>
        <h1 className="mt-3 text-3xl font-semibold leading-tight">{t("heroTitle")}</h1>
        <p className="mt-3 text-sm leading-relaxed opacity-90">{t("heroSub")}</p>
        <Link to={user ? "/assistant" : "/auth"} className="mt-6 block">
          <Button variant="hero" size="lg" className="w-full">
            <Sparkles className="size-4" />
            {t("start")}
          </Button>
        </Link>
      </section>

      <section className="space-y-3 px-4 py-6">
        <h2 className="text-sm font-semibold text-muted-foreground">{t("howItWorks")}</h2>
        {steps.map((step, i) => (
          <Card key={step.title} className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
              <step.icon className="size-4" />
            </span>
            <div>
              <p className="text-sm font-semibold">
                {i + 1}. {step.title}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{step.body}</p>
            </div>
          </Card>
        ))}
      </section>

      <section className="space-y-3 px-4 pb-8">
        <h2 className="text-sm font-semibold text-muted-foreground">{t("trust")}</h2>
        <div className="grid grid-cols-2 gap-3">
          <Card className="space-y-2">
            <BadgeCheck className="size-5 text-success" />
            <p className="text-xs font-medium">{t("verified")}</p>
          </Card>
          <Card className="space-y-2">
            <ShieldCheck className="size-5 text-primary" />
            <p className="text-xs font-medium">{t("securePayment")}</p>
          </Card>
        </div>
        <Card className="flex items-start gap-3">
          <Headphones className="size-5 shrink-0 text-primary" />
          <div>
            <p className="text-sm font-semibold">{t("support")}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t("supportText")}</p>
            <a
              href="mailto:backwalaa@gmail.com"
              className="mt-2 inline-block text-xs font-medium text-primary underline-offset-4 hover:underline"
            >
              backwalaa@gmail.com
            </a>
          </div>
        </Card>
      </section>
    </AppShell>
  );
}
