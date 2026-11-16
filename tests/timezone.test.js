import { test, describe } from "node:test";
import assert from "node:assert";

import { nyParts, nyDecimalHour, sessionClock } from "../src/engine/tz.js";
import { getCurrentSession, getNextKillZone } from "../src/engine/kill-zones.js";
import { getMacroWindow, isSilverBulletWindow } from "../src/engine/time.js";
import { shouldAvoidTrade } from "../src/engine/news.js";

const ts = (iso) => new Date(iso).getTime();

// US DST 2026: 8 Mar – 1 Nov. US DST 2027 starts 14 Mar.

describe("tz helpers", () => {
  test("winter: New York is EST (UTC-5), minutes kept", () => {
    const p = nyParts(ts("2026-11-16T04:24:39Z"));
    assert.strictEqual(p.zoneName, "EST");
    assert.strictEqual(p.hour, 23);
    assert.strictEqual(p.minute, 24);
    assert.strictEqual(p.weekday, "sunday");
  });

  test("summer: New York is EDT (UTC-4)", () => {
    const p = nyParts(ts("2026-07-15T13:30:00Z"));
    assert.strictEqual(p.zoneName, "EDT");
    assert.strictEqual(p.hour, 9);
    assert.strictEqual(p.minute, 30);
  });

  test("sessionClock shows minutes in every zone", () => {
    const c = sessionClock(ts("2026-11-16T04:24:39Z"));
    assert.strictEqual(c.est, "23:24 EST");
    assert.strictEqual(c.ist, "09:54 IST");
    assert.strictEqual(c.london, "04:24 GMT");
    assert.strictEqual(c.utc, "2026-11-16T04:24:39.000Z");
  });

  test("sessionClock labels summer time EDT", () => {
    const c = sessionClock(ts("2026-07-15T13:30:00Z"));
    assert.strictEqual(c.est, "09:30 EDT");
    assert.strictEqual(c.ist, "19:00 IST");
  });

  test("explicit fixed offset is still honoured", () => {
    assert.strictEqual(nyDecimalHour(ts("2026-07-15T13:45:00Z"), -5), 8.75);
  });
});

describe("Kill zones across DST", () => {
  test("summer 9:45 EDT is NY AM KZ (fixed -5 said 8:45, gap)", () => {
    const s = getCurrentSession(ts("2026-07-15T13:45:00Z"));
    assert.strictEqual(s.activeKillZone?.key, "ny_am");
    assert.strictEqual(s.canTrade, true);
    assert.strictEqual(s.estHour, "9.75");
  });

  test("summer 2:30 EDT is London KZ (fixed -5 said 1:30, pre-London)", () => {
    const s = getCurrentSession(ts("2026-07-15T06:30:00Z"));
    assert.strictEqual(s.activeKillZone?.key, "london");
  });

  test("winter 2:30 EST is London KZ", () => {
    const s = getCurrentSession(ts("2026-11-16T07:30:00Z"));
    assert.strictEqual(s.activeKillZone?.key, "london");
  });

  test("winter 23:24 EST is Asian session, no trade", () => {
    const s = getCurrentSession(ts("2026-11-16T04:24:39Z"));
    assert.strictEqual(s.canTrade, false);
    assert.strictEqual(s.avoidZone?.key, "asian");
  });

  test("DST change 14 Mar 2027: same NY wall time, different UTC", () => {
    const before = getCurrentSession(ts("2027-03-12T14:45:00Z")); // 9:45 EST
    const after = getCurrentSession(ts("2027-03-15T13:45:00Z")); // 9:45 EDT
    assert.strictEqual(before.activeKillZone?.key, "ny_am");
    assert.strictEqual(after.activeKillZone?.key, "ny_am");
  });

  test("passing -5 explicitly reproduces the old behaviour", () => {
    const s = getCurrentSession(ts("2026-07-15T13:45:00Z"), -5);
    assert.strictEqual(s.activeKillZone, null);
  });
});

describe("Next kill zone", () => {
  test("from 23:24:39 EST, London is next in 2h 35m", () => {
    const r = getNextKillZone(ts("2026-11-16T04:24:39Z"));
    assert.strictEqual(r.nextKillZone.key, "london");
    assert.strictEqual(r.nextKillZone.countdown, "2h 35m");
    assert.strictEqual(r.nextKillZone.hoursUntil, "2.6");
    assert.strictEqual(r.currentEST, "23.41");
  });

  test("summer: from 8:00 EDT, NY AM is next in 1h 30m", () => {
    const r = getNextKillZone(ts("2026-07-15T12:00:00Z"));
    assert.strictEqual(r.nextKillZone.key, "ny_am");
    assert.strictEqual(r.nextKillZone.countdown, "1h 30m");
  });
});

describe("Time windows across DST", () => {
  test("summer 9:55 EDT is inside NY open macro", () => {
    const m = getMacroWindow(ts("2026-07-15T13:55:00Z"));
    assert.strictEqual(m.inMacro, true);
    assert.strictEqual(m.activeMacro.start, "09:50");
  });

  test("summer 10:30 EDT is inside Silver Bullet", () => {
    assert.strictEqual(isSilverBulletWindow(ts("2026-07-15T14:30:00Z")).inWindow, true);
  });

  test("winter 10:30 EST is inside Silver Bullet", () => {
    assert.strictEqual(isSilverBulletWindow(ts("2026-11-16T15:30:00Z")).inWindow, true);
  });
});

describe("News filter uses New York day and hour", () => {
  test("summer Friday 15:30 EDT blocks new positions", () => {
    const r = shouldAvoidTrade("EURUSD", ts("2026-07-17T19:30:00Z"));
    assert.strictEqual(r.avoid, true);
    assert.match(r.reason, /FRIDAY CLOSE/);
  });

  test("Friday 21:00 EST in NY is Friday even when it is Saturday in IST", () => {
    const r = shouldAvoidTrade("EURUSD", ts("2026-11-21T02:00:00Z"));
    assert.strictEqual(r.avoid, true);
    assert.match(r.reason, /FRIDAY CLOSE/);
  });

  test("Friday 14:00 EST is not blocked by the Friday rule", () => {
    const r = shouldAvoidTrade("EURUSD", ts("2026-11-20T19:00:00Z"));
    assert.strictEqual(r.avoid, false);
  });
});
