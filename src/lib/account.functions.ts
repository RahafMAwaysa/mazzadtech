import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Makes sure the signed-in account has a profile row and exactly one role row.
 * Roles are never taken from the client: the value comes from the signup
 * metadata stored on the auth user, and "admin" can never be self-assigned.
 */
export const ensureAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    const { data: userRes } = await supabaseAdmin.auth.admin.getUserById(userId);
    const meta = (userRes?.user?.user_metadata ?? {}) as Record<string, unknown>;
    const fullName = typeof meta['full_name'] === "string" ? meta['full_name'] : null;
    const phone = typeof meta['phone'] === "string" ? meta['phone'] : null;
    const companyName = typeof meta['company_name'] === "string" ? meta['company_name'] : null;
    const wanted = typeof meta['role'] === "string" ? meta['role'] : "customer";
    const role = ["customer", "supplier", "delivery"].includes(wanted) ? wanted : "customer";

    await supabaseAdmin
      .from("profiles")
      .upsert({ id: userId, full_name: fullName, phone }, { onConflict: "id", ignoreDuplicates: true });

    const { data: existing } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    const roles = (existing ?? []).map((r) => r.role as string);
    if (roles.length === 0) {
      await supabaseAdmin.from("user_roles").insert({ user_id: userId, role: role as never });
      roles.push(role);
    }

    if (roles.includes("supplier")) {
      await supabaseAdmin.from("supplier_profiles").upsert(
        { user_id: userId, company_name: companyName ?? "New Supplier", categories: [] },
        { onConflict: "user_id", ignoreDuplicates: true },
      );
    }
    if (roles.includes("delivery")) {
      await supabaseAdmin.from("delivery_companies").upsert(
        { user_id: userId, company_name: companyName ?? "New Delivery Company", phone },
        { onConflict: "user_id", ignoreDuplicates: true },
      );
    }

    return { roles };
  });
