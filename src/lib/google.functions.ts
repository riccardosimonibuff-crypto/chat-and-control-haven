import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const fetchTodayEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth]).handler(async ({ context }) => {
    const { getTodayEvents } = await import("./google.server");
    return getTodayEvents(context.userId);
  });

export const fetchRecentEmails = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth]).handler(async ({ context }) => {
    const { getRecentEmails } = await import("./google.server");
    return getRecentEmails(context.userId);
  });
