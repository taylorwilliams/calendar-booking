import test from "node:test";
import assert from "node:assert/strict";
import { isAllowedAppleCalDavUrl, parseExpandedCalendarData, selectAppleCalendarCollections } from "../../lib/apple-calendar-data.ts";

test("only permits HTTPS Apple CalDAV hosts for credentialed requests", () => {
  assert.equal(isAllowedAppleCalDavUrl("https://caldav.icloud.com/"), true);
  assert.equal(isAllowedAppleCalDavUrl("https://p123-caldav.icloud.com/456/calendars/"), true);
  assert.equal(isAllowedAppleCalDavUrl("http://caldav.icloud.com/"), false);
  assert.equal(isAllowedAppleCalDavUrl("https://caldav.icloud.com.evil.example/"), false);
  assert.equal(isAllowedAppleCalDavUrl("https://attacker-p123-caldav.icloud.com/"), false);
  assert.equal(isAllowedAppleCalDavUrl("https://not-an-apple-host.icloud.com/"), false);
  assert.equal(isAllowedAppleCalDavUrl("https://u:p" + "@caldav.icloud.com/"), false);
});

test("selects only configured Apple calendars and fails closed when one is missing", () => {
  const calendars = [
    { name: "Personal", url: "https://p123-caldav.icloud.com/personal/" },
    { name: "Family", url: "https://p123-caldav.icloud.com/shared/" },
    { name: "Birthdays", url: "https://p123-caldav.icloud.com/birthdays/" },
  ];
  assert.deepEqual(
    selectAppleCalendarCollections(calendars, ["Personal", "Family"]),
    calendars.slice(0, 2),
  );
  assert.throws(
    () => selectAppleCalendarCollections(calendars, ["Personal", "Missing calendar"]),
    /Missing calendar/,
  );
});

test("expanded calendar data returns opaque events without exposing their content", () => {
  const calendar = `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:busy-1\r\nDTSTART:20261019T090000Z\r\nDTEND:20261019T100000Z\r\nSUMMARY:Private appointment\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nUID:free-1\r\nDTSTART:20261019T110000Z\r\nDTEND:20261019T120000Z\r\nTRANSP:TRANSPARENT\r\nSUMMARY:Visible but free\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nUID:cancelled-1\r\nDTSTART:20261019T130000Z\r\nDTEND:20261019T140000Z\r\nSTATUS:CANCELLED\r\nEND:VEVENT\r\nEND:VCALENDAR`;
  const busy = parseExpandedCalendarData(calendar, new Date("2026-10-19T00:00:00Z"), new Date("2026-10-20T00:00:00Z"));
  assert.deepEqual(busy, [{ id: "busy-1:2026-10-19T09:00:00.000Z", start: "2026-10-19T10:00:00", end: "2026-10-19T11:00:00" }]);
  assert.equal(JSON.stringify(busy).includes("Private appointment"), false);
});

test("refuses unexpanded recurrence data rather than risking a double booking", () => {
  const calendar = `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:recurring-1\r\nDTSTART:20261019T090000Z\r\nDTEND:20261019T100000Z\r\nRRULE:FREQ=WEEKLY\r\nEND:VEVENT\r\nEND:VCALENDAR`;
  assert.throws(
    () => parseExpandedCalendarData(calendar, new Date("2026-10-19T00:00:00Z"), new Date("2026-11-20T00:00:00Z")),
    /did not expand/,
  );
});
