import Realm, { UpdateMode } from "realm";
import { getRealm } from "../database/realmConfig";
import { Usage, DailySnapshot } from "../database/schemas";
import { UsageStat } from "../native/usageStats";

// ─── Save / upsert today's usage into Realm ───────────────────────────────────

/**
 * Writes usage stats for today into Realm.
 * Uses `UpdateMode.Modified` so re-running idempotently upserts.
 */
export const saveUsageToRealm = async (stats: UsageStat[]): Promise<void> => {
  const realm = await getRealm();
  const today = new Date().toISOString().slice(0, 10);
  const totalMs = stats.reduce((s, u) => s + u.totalTimeInForeground, 0);

  realm.write(() => {
    // Upsert every app row
    for (const stat of stats) {
      realm.create<Usage>(
        "Usage",
        {
          id:          `${today}::${stat.packageName}`,
          packageName: stat.packageName,
          appName:     stat.appName,
          timeInMs:    stat.totalTimeInForeground,
          openCount:   stat.openCount,
          date:        today,
        },
        UpdateMode.Modified
      );
    }

    // Upsert daily snapshot for the chart
    realm.create<DailySnapshot>(
      "DailySnapshot",
      { date: today, totalMs, updatedAt: Date.now() },
      UpdateMode.Modified
    );
  });
};

// ─── Read today's usage from Realm ────────────────────────────────────────────

export interface StoredUsage {
  packageName: string;
  appName:     string;
  timeInMs:    number;
  openCount:   number;
  date:        string;
}

export const getTodayUsage = async (): Promise<StoredUsage[]> => {
  const realm = await getRealm();
  const today = new Date().toISOString().slice(0, 10);

  const results = realm
    .objects<Usage>("Usage")
    .filtered("date == $0", today)
    .sorted("timeInMs", true); // descending

  // Snapshot out of Realm's live list into a plain array
  return Array.from(results).map((u) => ({
    packageName: u.packageName,
    appName:     u.appName,
    timeInMs:    u.timeInMs,
    openCount:   u.openCount,
    date:        u.date,
  }));
};

// ─── Read last 7 days of daily totals ─────────────────────────────────────────

export interface DailyTotal {
  date:    string;    // YYYY-MM-DD
  totalMs: number;
}

export const getWeeklyTotals = async (): Promise<DailyTotal[]> => {
  const realm = await getRealm();

  const results = realm
    .objects<DailySnapshot>("DailySnapshot")
    .sorted("date", true)   // newest first
    .slice(0, 7);            // last 7 days

  return Array.from(results)
    .map((s) => ({ date: s.date, totalMs: s.totalMs }))
    .reverse(); // oldest → newest for chart
};

// ─── Historical day lookup ─────────────────────────────────────────────────────

export const getUsageForDate = async (date: string): Promise<StoredUsage[]> => {
  const realm = await getRealm();

  const results = realm
    .objects<Usage>("Usage")
    .filtered("date == $0", date)
    .sorted("timeInMs", true);

  return Array.from(results).map((u) => ({
    packageName: u.packageName,
    appName:     u.appName,
    timeInMs:    u.timeInMs,
    openCount:   u.openCount,
    date:        u.date,
  }));
};
