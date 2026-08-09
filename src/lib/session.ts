import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { ensureAccount } from "@/lib/account.functions";

export type Role = "customer" | "supplier" | "delivery" | "admin";

export type SessionState = {
  loading: boolean;
  session: Session | null;
  user: User | null;
  role: Role | null;
  suspended: boolean;
  suspensionReason: string | null;
};

const PENDING_SIGNUP_KEY = "mzt_pending_signup";

export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>({
    loading: true,
    session: null,
    user: null,
    role: null,
    suspended: false,
    suspensionReason: null,
  });

  useEffect(() => {
    let active = true;

    const loadRole = async (session: Session | null) => {
      if (!session) {
        if (active) setState({ loading: false, session: null, user: null, role: null, suspended: false, suspensionReason: null });
        return;
      }

      let { data: roleRows } = await supabase.from("user_roles").select("role").eq("user_id", session.user.id);

      // First time we ever see this account (fresh OAuth/phone-OTP/email
      // signup): apply any role/company choice captured before an OAuth
      // redirect, then bootstrap the profile + role row server-side.
      if (!roleRows || roleRows.length === 0) {
        try {
          const pendingRaw = localStorage.getItem(PENDING_SIGNUP_KEY);
          if (pendingRaw) {
            await supabase.auth.updateUser({ data: JSON.parse(pendingRaw) });
            localStorage.removeItem(PENDING_SIGNUP_KEY);
          }
        } catch {
          // best-effort — ensureAccount below still falls back to "customer"
        }
        try {
          await ensureAccount();
        } catch {
          // ignore — the query below just won't find a role yet
        }
        const retry = await supabase.from("user_roles").select("role").eq("user_id", session.user.id);
        roleRows = retry.data;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("suspended, suspension_reason")
        .eq("id", session.user.id)
        .maybeSingle();
      if (!active) return;
      const roles = (roleRows ?? []).map((r) => r.role as Role);
      const role: Role = roles.includes("admin")
        ? "admin"
        : roles.includes("supplier")
          ? "supplier"
          : roles.includes("delivery")
            ? "delivery"
            : "customer";
      setState({
        loading: false,
        session,
        user: session.user,
        role,
        suspended: profile?.suspended ?? false,
        suspensionReason: profile?.suspension_reason ?? null,
      });
    };

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setState((s) => ({ ...s, session, user: session?.user ?? null }));
      void loadRole(session);
    });

    void supabase.auth.getSession().then(({ data }) => loadRole(data.session));

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return state;
}

export async function signOut() {
  await supabase.auth.signOut();
}
