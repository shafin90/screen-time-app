import { Linking, Platform } from "react-native";

/**
 * Opens the "Usage Access" settings screen on Android so the user can
 * grant PACKAGE_USAGE_STATS permission to the app.
 */
export const openUsageSettings = () => {
  if (Platform.OS === "android") {
    Linking.sendIntent("android.settings.USAGE_ACCESS_SETTINGS");
  }
};
