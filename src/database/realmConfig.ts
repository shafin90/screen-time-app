import Realm from "realm";
import { Usage, DailySnapshot } from "./schemas";

let _realm: Realm | null = null;

/**
 * Opens (or returns the cached) Realm instance.
 * All schemas are registered here.
 */
export const getRealm = async (): Promise<Realm> => {
  if (_realm && !_realm.isClosed) return _realm;

  _realm = await Realm.open({
    schema: [Usage, DailySnapshot],
    schemaVersion: 1,
  });

  return _realm;
};

/**
 * Call this on app unmount / cleanup.
 */
export const closeRealm = () => {
  if (_realm && !_realm.isClosed) {
    _realm.close();
    _realm = null;
  }
};
