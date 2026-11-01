export type CalEvent = { id: string; title: string; start: string; end: string; allDay: boolean; location?: string; account: string; calendar: string };
export type Email = { id: string; from: string; subject: string; date: string; snippet: string; account: string; urgent: boolean; important: boolean };

export function sortEvents(events: CalEvent[]): CalEvent[] {
  return [...events].sort((a, b) => a.start.localeCompare(b.start) || a.account.localeCompare(b.account));
}

export function classifyEmail(subject: string, snippet: string, labels: string[]) {
  const urgent = /\b(urgente|urgent|scadenza|entro oggi|asap|azione richiesta|action required|overdue)\b/i.test(`${subject} ${snippet}`);
  return { urgent, important: urgent || labels.includes("IMPORTANT") || labels.includes("STARRED") };
}