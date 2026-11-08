import { classifyEmail, sortEvents, type CalEvent, type Email } from "./google-data";

type Account = { id: string; email: string; access_token_ciphertext: string; refresh_token_ciphertext: string; expires_at: string; reconnect_required: boolean };

async function admin() {
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin;
}

async function accessToken(acc: Account): Promise<string> {
  const secret = process.env["GOOGLE_TOKEN_ENCRYPTION_SECRET"];
  if (!secret) throw new Error("Configurazione cifratura mancante.");
  const { decryptToken, encryptToken } = await import("./token-crypto.server");
  if (new Date(acc.expires_at).getTime() > Date.now() + 60_000) return decryptToken(acc.access_token_ciphertext, secret);
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env["GOOGLE_MULTI_CLIENT_ID"] ?? "",
      client_secret: process.env["GOOGLE_MULTI_CLIENT_SECRET"] ?? "",
      grant_type: "refresh_token",
      refresh_token: await decryptToken(acc.refresh_token_ciphertext, secret),
    }),
  });
  const tok = await res.json().catch(() => ({}));
  const db = await admin();
  if (!res.ok || !tok.access_token) {
    if (tok.error === "invalid_grant") await db.from("google_accounts").update({ reconnect_required: true }).eq("id", acc.id);
    throw new Error(`${acc.email}: accesso scaduto, ricollega l'account.`);
  }
  await db.from("google_accounts").update({
    access_token_ciphertext: await encryptToken(tok.access_token, secret),
    expires_at: new Date(Date.now() + Number(tok.expires_in ?? 3600) * 1000).toISOString(),
  }).eq("id", acc.id);
  return tok.access_token;
}

async function gget(token: string, url: string) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    console.error(`Google [${res.status}] ${url}: ${await res.text()}`);
    throw new Error(`Google ha risposto ${res.status}`);
  }
  return res.json();
}

async function accounts(userId: string): Promise<Account[]> {
  const { data, error } = await (await admin()).from("google_accounts")
    .select("id,email,access_token_ciphertext,refresh_token_ciphertext,expires_at,reconnect_required")
    .eq("user_id", userId).eq("reconnect_required", false);
  if (error) throw new Error(error.message);
  return data ?? [];
}

function todayRange() {
  const tz = "Europe/Rome";
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());
  const off = new Intl.DateTimeFormat("en", { timeZone: tz, timeZoneName: "longOffset" })
    .formatToParts(new Date()).find((p) => p.type === "timeZoneName")?.value.replace("GMT", "") || "+00:00";
  return { timeMin: `${day}T00:00:00${off}`, timeMax: `${day}T23:59:59${off}`, tz };
}

export async function getTodayEvents(userId: string): Promise<{ events: CalEvent[]; errors: string[] }> {
  const { timeMin, timeMax, tz } = todayRange();
  const errors: string[] = [];
  const all = await Promise.all((await accounts(userId)).map(async (acc) => {
    try {
      const token = await accessToken(acc);
      const list = await gget(token, "https://www.googleapis.com/calendar/v3/users/me/calendarList?minAccessRole=reader");
      const cals: any[] = (list.items ?? []).filter((c: any) => c.selected !== false);
      const per = await Promise.all(cals.map(async (c) => {
        const q = new URLSearchParams({ timeMin, timeMax, singleEvents: "true", orderBy: "startTime", timeZone: tz, maxResults: "50" });
        const d = await gget(token, `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(c.id)}/events?${q}`).catch(() => ({ items: [] }));
        return (d.items ?? []).filter((e: any) => e.status !== "cancelled").map((e: any): CalEvent => ({
          id: `${acc.id}:${c.id}:${e.id}`,
          title: e.summary ?? "(senza titolo)",
          start: e.start?.dateTime ?? e.start?.date,
          end: e.end?.dateTime ?? e.end?.date,
          allDay: !e.start?.dateTime,
          location: e.location,
          account: acc.email,
          calendar: c.summaryOverride ?? c.summary ?? "",
        }));
      }));
      return per.flat();
    } catch (e) {
      errors.push(e instanceof Error ? e.message : `${acc.email}: errore`);
      return [];
    }
  }));
  return { events: sortEvents(all.flat()), errors };
}

const decode = (s: string) => s.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");

export async function getRecentEmails(userId: string, onlyImportant = false): Promise<{ emails: Email[]; errors: string[] }> {
  const errors: string[] = [];
  const all = await Promise.all((await accounts(userId)).map(async (acc) => {
    try {
      const token = await accessToken(acc);
      const list = await gget(token, "https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=10&labelIds=INBOX");
      const msgs = await Promise.all((list.messages ?? []).map((m: any) =>
        gget(token, `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`)));
      return msgs.map((m: any): Email => {
        const h = (n: string) => m.payload?.headers?.find((x: any) => x.name === n)?.value ?? "";
        const subject = h("Subject") || "(nessun oggetto)";
        const snippet = decode(m.snippet ?? "");
        return { id: `${acc.id}:${m.id}`, from: h("From"), subject, date: h("Date"), snippet, account: acc.email, ...classifyEmail(subject, snippet, m.labelIds ?? []) };
      });
    } catch (e) {
      errors.push(e instanceof Error ? e.message : `${acc.email}: errore`);
      return [];
    }
  }));
  let emails = all.flat().sort((a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0));
  if (onlyImportant) emails = emails.filter((e) => e.important);
  return { emails, errors };
}

async function pickAccount(userId: string, email?: string) {
  const list = await accounts(userId);
  if (!list.length) throw new Error("Nessun account Google collegato.");
  const acc = email ? list.find((a) => a.email.toLowerCase() === email.toLowerCase()) : list[0];
  if (!acc) throw new Error(`Account ${email} non collegato.`);
  return acc;
}

async function gsend(token: string, url: string, method: string, body: unknown) {
  const res = await fetch(url, { method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) {
    const t = await res.text();
    console.error(`Google [${res.status}] ${url}: ${t}`);
    if (res.status === 403) throw new Error("Permesso di scrittura mancante: ricollega l'account Google dalla pagina Produttività.");
    throw new Error(`Google ha risposto ${res.status}`);
  }
  return res.json();
}

const when = (v: string) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? { date: v } : { dateTime: v, timeZone: "Europe/Rome" });

export async function createCalendarEvent(userId: string, a: { account?: string; title: string; start: string; end: string; description?: string; location?: string }) {
  const acc = await pickAccount(userId, a.account);
  const ev = await gsend(await accessToken(acc), "https://www.googleapis.com/calendar/v3/calendars/primary/events", "POST",
    { summary: a.title, description: a.description, location: a.location, start: when(a.start), end: when(a.end) });
  return { ok: true, account: acc.email, event_id: `${acc.id}:primary:${ev.id}`, link: ev.htmlLink };
}

export async function updateCalendarEvent(userId: string, a: { event_id: string; title?: string; start?: string; end?: string; description?: string; location?: string }) {
  const parts = a.event_id.split(":");
  if (parts.length < 3) throw new Error("ID evento non valido.");
  const accId = parts[0]!, evId = parts[parts.length - 1]!, calId = parts.slice(1, -1).join(":");
  const acc = (await accounts(userId)).find((x) => x.id === accId);
  if (!acc) throw new Error("Account dell'evento non trovato.");
  const patch: Record<string, unknown> = {};
  if (a.title) patch["summary"] = a.title;
  if (a.description) patch["description"] = a.description;
  if (a.location) patch["location"] = a.location;
  if (a.start) patch["start"] = when(a.start);
  if (a.end) patch["end"] = when(a.end);
  await gsend(await accessToken(acc), `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events/${encodeURIComponent(evId)}`, "PATCH", patch);
  return { ok: true, account: acc.email };
}

const b64 = (s: string) => btoa(Array.from(new TextEncoder().encode(s), (b) => String.fromCharCode(b)).join(""));
const hdr = (v: string) => (/^[\x00-\x7F]*$/.test(v) ? v : `=?UTF-8?B?${b64(v)}?=`);

export async function createEmailDraft(userId: string, a: { account?: string; to: string; subject: string; body: string }) {
  if (/[\r\n]/.test(a.to + a.subject)) throw new Error("Intestazioni non valide.");
  const acc = await pickAccount(userId, a.account);
  const raw = b64([`To: ${a.to}`, `Subject: ${hdr(a.subject)}`, "MIME-Version: 1.0", 'Content-Type: text/plain; charset="UTF-8"', "", a.body].join("\r\n"))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const d = await gsend(await accessToken(acc), "https://gmail.googleapis.com/gmail/v1/users/me/drafts", "POST", { message: { raw } });
  return { ok: true, account: acc.email, draft_id: d.id };
}
