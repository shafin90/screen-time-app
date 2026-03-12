import AsyncStorage from "@react-native-async-storage/async-storage";
import { randomUUID } from "expo-crypto";

const DEVICE_ID_KEY = "@screen_time_device_id";

/**
 * Returns a stable, anonymous device identifier stored locally in AsyncStorage.
 * Fully offline — no network or auth needed.
 */
export const getDeviceId = async (): Promise<string> => {
  try {
    const stored = await AsyncStorage.getItem(DEVICE_ID_KEY);
    if (stored) return stored;

    const newId = randomUUID();
    await AsyncStorage.setItem(DEVICE_ID_KEY, newId);
    return newId;
  } catch {
    return randomUUID(); // ephemeral fallback
  }
};
