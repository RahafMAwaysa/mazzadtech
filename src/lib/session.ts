import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type Role = "customer" | "supplier" | "delivery" | "admin";

export type SessionState = {
  loading: boolean;
  session: Session | null;
  user: User | null;
  role: Role | null;
};

export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>({
    loading: true,
    session: null,
    user: null,
    role: null,
  });

  useEffect(() => {
    let active = true;

    const loadRole = async (session: Session | null) => {
      if (!session) {
        if (active) setState({ loading: false, session: null, user: null, role: null });
        return;
      }
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id);
      if (!active) return;
      const roles = (data ?? []).map((r) => r.role as Role);
      const role: Role = roles.includes("admin")
        ? "admin"
        : roles.includes("supplier")
          ? "supplier"
          : roles.includes("delivery")
            ? "delivery"
            : "customer";
      setState({ loading: false, session, user: session.user, role });
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
