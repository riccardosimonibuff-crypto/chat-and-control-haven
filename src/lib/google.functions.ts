import { createServerFn } from "@tanstack/react-start";
import { getAccountEmail, getRecentEmails, getTodayEvents } from "./google.server";

export const getGoogleStatus = createServerFn({ method: "GET" }).handler(async () => {
  try {
    return { connected: true as const, email: await getAccountEmail() };
  } catch {
    return { connected: false as const, email: null };
  }
});

export const fetchTodayEvents = createServerFn({ method: "GET" }).handler(async () => {
  try { return { ok: true as const, events: await getTodayEvents() }; }
  catch (e) { return { ok: false as const, error: e instanceof Error ? e.message : "Errore", events: [] }; }
});

export const fetchRecentEmails = createServerFn({ method: "GET" }).handler(async () => {
  try { return { ok: true as const, emails: await getRecentEmails() }; }
  catch (e) { return { ok: false as const, error: e instanceof Error ? e.message : "Errore", emails: [] }; }
});
