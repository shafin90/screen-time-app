import Realm from "realm";

// ─── Schema: one row per app per day ─────────────────────────────────────────
export class Usage extends Realm.Object<Usage> {
  id!: string;            // composite key: `${date}::${packageName}`
  packageName!: string;
  appName!: string;
  timeInMs!: number;      // foreground ms
  openCount!: number;     // number of opens
  date!: string;          // YYYY-MM-DD

  static schema: Realm.ObjectSchema = {
    name: "Usage",
    primaryKey: "id",
    properties: {
      id: "string",
      packageName: "string",
      appName: "string",
      timeInMs: "int",
      openCount: "int",
      date: "string",
    },
  };
}

// ─── Schema: daily total for weekly chart ─────────────────────────────────────
export class DailySnapshot extends Realm.Object<DailySnapshot> {
  date!: string;          // YYYY-MM-DD — primary key
  totalMs!: number;       // sum of all app times for that day
  updatedAt!: number;     // epoch ms

  static schema: Realm.ObjectSchema = {
    name: "DailySnapshot",
    primaryKey: "date",
    properties: {
      date: "string",
      totalMs: "int",
      updatedAt: "int",
    },
  };
}
