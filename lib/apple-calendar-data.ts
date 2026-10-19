import { XMLParser } from "fast-xml-parser";
import ICAL from "ical.js";

export type AppleBusyTime = {
  id: string;
  start: string;
  end: string;
};

export type AppleCalendarCollection = {
  name: string;
  url: string;
};

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  removeNSPrefix: true,
  parseTagValue: false,
  trimValues: true,
});

export function arrayOf<T>(value: T | T[] | null | undefined): T[] {
  if (value === null || value === undefined || value === "") return [];
  return Array.isArray(value) ? value : [value];
}

export function textValue(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "#text" in value && typeof (value as { "#text": unknown })["#text"] === "string") {
    return (value as { "#text": string })["#text"];
  }
  return null;
}

export function successfulProperties(response: unknown): Record<string, unknown>[] {
  if (!response || typeof response !== "object") return [];
  const propstats = arrayOf((response as { propstat?: unknown }).propstat);
  return propstats.flatMap((propstat) => {
    if (!propstat || typeof propstat !== "object") return [];
    const item = propstat as { status?: unknown; prop?: unknown };
    const status = textValue(item.status);
    return status?.includes(" 200 ") && item.prop && typeof item.prop === "object"
      ? [item.prop as Record<string, unknown>]
      : [];
  });
}

export function multistatusResponses(xml: string): unknown[] {
  const parsed = xmlParser.parse(xml) as { multistatus?: { response?: unknown } | string };
  if (!parsed.multistatus || typeof parsed.multistatus !== "object") return [];
  return arrayOf(parsed.multistatus.response);
}

export function isAllowedAppleCalDavUrl(value: string) {
  let url: URL;
  try { url = new URL(value); }
  catch { return false; }
  const hostname = url.hostname.toLowerCase();
  return url.protocol === "https:"
    && !url.username
    && !url.password
    && /^(?:caldav|p\d+-caldav)\.icloud\.com$/.test(hostname);
}

export function selectAppleCalendarCollections(calendars: AppleCalendarCollection[], requiredNames: readonly string[]) {
  if (!requiredNames.length) return calendars;
  const normalizedNames = new Map(requiredNames.map((name) => [name.trim().toLowerCase(), name]));
  const selected = calendars.filter((calendar) => normalizedNames.has(calendar.name.trim().toLowerCase()));
  const selectedNames = new Set(selected.map((calendar) => calendar.name.trim().toLowerCase()));
  const missing = [...normalizedNames].filter(([normalized]) => !selectedNames.has(normalized)).map(([, original]) => original);
  if (missing.length) throw new Error(`Required Apple calendars were not found: ${missing.join(", ")}`);
  return selected;
}

function londonLocal(value: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  const part = Object.fromEntries(parts.map((item) => [item.type, item.value]));
  return `${part.year}-${part.month}-${part.day}T${part.hour}:${part.minute}:${part.second}`;
}

export function parseExpandedCalendarData(data: string, rangeStart: Date, rangeEnd: Date) {
  const parsed = ICAL.parse(data) as unknown;
  const rawCalendars = Array.isArray(parsed) && typeof parsed[0] === "string" ? [parsed] : parsed as unknown[];
  const busy: AppleBusyTime[] = [];

  for (const rawCalendar of rawCalendars) {
    const calendar = new ICAL.Component(rawCalendar as never);
    for (const timezoneComponent of calendar.getAllSubcomponents("vtimezone")) {
      const tzid = timezoneComponent.getFirstPropertyValue("tzid");
      if (typeof tzid === "string") ICAL.TimezoneService.register(new ICAL.Timezone({ component: timezoneComponent, tzid }));
    }
    for (const component of calendar.getAllSubcomponents("vevent")) {
      const status = String(component.getFirstPropertyValue("status") ?? "").toUpperCase();
      const transparency = String(component.getFirstPropertyValue("transp") ?? "").toUpperCase();
      if (status === "CANCELLED" || transparency === "TRANSPARENT") continue;
      if (component.hasProperty("rrule") || component.hasProperty("rdate") || component.hasProperty("exdate")) {
        throw new Error("Apple Calendar did not expand a recurring event");
      }
      const event = new ICAL.Event(component);
      const start = event.startDate.toJSDate();
      const end = event.endDate.toJSDate();
      if (!(start < rangeEnd && end > rangeStart)) continue;
      const recurrenceId = component.getFirstPropertyValue("recurrence-id");
      busy.push({
        id: `${event.uid}:${recurrenceId ? String(recurrenceId) : start.toISOString()}`,
        start: londonLocal(start),
        end: londonLocal(end),
      });
    }
  }
  return busy;
}
