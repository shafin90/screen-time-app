import { NativeModules } from "react-native";

export interface UsageStat {
  packageName: string;
  appName: string;
  totalTimeInForeground: number; // milliseconds
  openCount: number;
}

const { UsageStatsModule } = NativeModules;

/**
 * Returns per-app usage stats for the last 24 hours.
 * Requires PACKAGE_USAGE_STATS permission granted by the user.
 */
export const getUsageStats = async (): Promise<UsageStat[]> => {
  return await UsageStatsModule.getUsageStats();
};

/**
 * Returns true if the app has been granted Usage Access permission.
 */
export const hasUsageStatsPermission = async (): Promise<boolean> => {
  return await UsageStatsModule.hasUsageStatsPermission();
};
