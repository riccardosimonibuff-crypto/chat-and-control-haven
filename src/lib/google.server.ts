const GW = "https://connector-gateway.lovable.dev";

async function gw(connector: "google_mail" | "google_calendar", keyVar: string, path: string) {
  const lovable = process.env["LOVABLE_API_KEY"];
  const key = process.env[keyVar];
  if (!lovable || !key) throw new Error("Account Google non collegato.");
  const res = await fetch(`${GW}/${connector}${path}`, {
    headers: { Authorization: `Bearer ${lovable}`, "X-Connection-Api-Key": key },
  });
  if (!res.ok) {
    const body = await res.text();
    console.error(`Google ${connector} [${res.status}]: ${body}`);
    throw new Error(`Google ha risposto ${res.status}`);
  }
  return res.json();
}

const mail = (p: string) => gw("google_mail", "GOOGLE_MAIL_API_KEY", `/gmail/v1${p}`);
const cal = (p: string) => gw("google_calendar", "GOOGLE_CALENDAR_API_KEY", `/calendar/v3${p}`);

export async function getAccountEmail(): Promise<string> {
  return (await mail("/users/me/profile")).emailAddress;
}

export type CalEvent = { id: string; title: string; start: string; end: string; allDay: boolean; location?: string };

export async function getTodayEvents(): Promise<CalEvent[]> {
  const tz = "Europe/Rome";
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date()); // YYYY-MM-DD
  // Rome offset for today
  const off = new Intl.DateTimeFormat("en", { timeZone: tz, timeZoneName: "longOffset" })
    .formatToParts(new Date()).find((p) => p.type === "timeZoneName")?.value.replace("GMT", "") || "+00:00";
  const q = new URLSearchParams({
    timeMin: `${day}T00:00:00${off}`,
    timeMax: `${day}T23:59:59${off}`,
    singleEvents: "true",
    orderBy: "startTime",
    timeZone: tz,
    maxResults: "50",
  });
  const data = await cal(`/calendars/primary/events?${q}`);
  return (data.items ?? []).map((e: any) => ({
    id: e.id,
    title: e.summary ?? "(senza titolo)",
    start: e.start?.dateTime ?? e.start?.date,
    end: e.end?.dateTime ?? e.end?.date,
    allDay: !e.start?.dateTime,
    location: e.location,
  }));
}

export type Email = { id: string; from: string; subject: string; date: string; snippet: string };

export async function getRecentEmails(): Promise<Email[]> {
  const list = await mail("/users/me/messages?maxResults=5&labelIds=INBOX");
  const ids: string[] = (list.messages ?? []).map((m: any) => m.id);
  const msgs = await Promise.all(
    ids.map((id) =>
      mail(`/users/me/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`),
    ),
  );
  return msgs.map((m: any) => {
    const h = (n: string) => m.payload?.headers?.find((x: any) => x.name === n)?.value ?? "";
    const txt = document_decode(m.snippet ?? "");
    return { id: m.id, from: h("From"), subject: h("Subject") || "(nessun oggetto)", date: h("Date"), snippet: txt };
  });
}

function document_decode(s: string) {
  return s.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}
