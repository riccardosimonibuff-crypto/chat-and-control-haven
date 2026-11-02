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
