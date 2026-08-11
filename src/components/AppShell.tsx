import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
  Home,
  MessagesSquare,
  ClipboardList,
  Package,
  LayoutDashboard,
  Store,
  ShieldCheck,
  LogOut,
  Languages,
  Truck,
  AlertTriangle,
  UserRound,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { signOut, type Role } from "@/lib/session";
import { Button } from "@/components/ui-kit";
import { cn } from "@/lib/utils";

type NavItem = { to: string; label: string; icon: ReactNode };

export function AppShell({
  children,
  role,
  signedIn,
}: {
  children: ReactNode;
  role: Role | null;
  signedIn: boolean;
}) {
  const { t, lang, setLang } = useI18n();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const items: NavItem[] =
    role === "supplier"
      ? [
          { to: "/supplier", label: t("openRequests"), icon: <ClipboardList className="size-5" /> },
          { to: "/supplier/offers", label: t("myOffers"), icon: <Store className="size-5" /> },
          { to: "/supplier/orders", label: t("orders"), icon: <Package className="size-5" /> },
          { to: "/supplier/profile", label: t("profile"), icon: <ShieldCheck className="size-5" /> },
        ]
      : role === "delivery"
        ? [
            { to: "/delivery", label: t("deliveries"), icon: <Truck className="size-5" /> },
            { to: "/delivery/profile", label: t("profile"), icon: <ShieldCheck className="size-5" /> },
          ]
        : role === "admin"
          ? [
              { to: "/admin", label: t("dashboard"), icon: <LayoutDashboard className="size-5" /> },
              { to: "/admin/suppliers", label: t("suppliers"), icon: <ShieldCheck className="size-5" /> },
              { to: "/admin/disputes", label: t("disputes"), icon: <AlertTriangle className="size-5" /> },
              { to: "/admin/orders", label: t("orders"), icon: <Package className="size-5" /> },
            ]
          : [
              { to: "/", label: t("home"), icon: <Home className="size-5" /> },
              { to: "/assistant", label: t("assistant"), icon: <MessagesSquare className="size-5" /> },
              { to: "/requests", label: t("requests"), icon: <ClipboardList className="size-5" /> },
              { to: "/orders", label: t("orders"), icon: <Package className="size-5" /> },
              { to: "/profile", label: t("profile"), icon: <UserRound className="size-5" /> },
            ];

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-lg flex-col bg-background">
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-background/85 px-4 py-3 backdrop-blur">
        <Link to="/" className="flex items-center gap-2">
          <img src="/branding/logo.png" alt={t("appName")} className="size-8 object-contain" />
          <span className="font-display text-base font-semibold">{t("appName")}</span>
        </Link>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLang(lang === "en" ? "ar" : "en")}
            aria-label="Toggle language"
          >
            <Languages className="size-4" />
            {lang === "en" ? "AR" : "EN"}
          </Button>
          {signedIn ? (
            <Button
              variant="ghost"
              size="icon"
              aria-label={t("signOut")}
              onClick={async () => {
                await signOut();
                navigate({ to: "/auth" });
              }}
            >
              <LogOut className="size-4" />
            </Button>
          ) : (
            <Link to="/auth">
              <Button size="sm">{t("signIn")}</Button>
            </Link>
          )}
        </div>
      </header>

      <main className="flex-1 pb-24">{children}</main>

      {signedIn && (
        <nav className="fixed bottom-0 z-20 w-full max-w-lg border-t border-border bg-card/95 backdrop-blur">
          <ul
            className="grid"
            style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
          >
            {items.map((item) => {
              const active =
                item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
              return (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    className={cn(
                      "flex flex-col items-center gap-1 py-2.5 text-[11px] transition-colors",
                      active ? "text-primary" : "text-muted-foreground",
                    )}
                  >
                    {item.icon}
                    <span className="truncate px-1">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </div>
  );
}

export function Page({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div className="space-y-4 px-4 py-5">
      {title && <h1 className="font-display text-xl font-semibold">{title}</h1>}
      {children}
    </div>
  );
}
