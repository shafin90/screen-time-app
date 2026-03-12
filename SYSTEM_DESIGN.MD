# 📱 Screen Time App — System Design

A fully **offline Android mobile app** built with **React Native (Expo Bare Workflow)** that tracks daily app usage and screen time using local on-device storage.

---

## 🏗️ Architecture Overview

The app follows a **bridge-based architecture** to interface with native Android APIs while maintaining a modern React Native UI.

### Component Layers
1.  **User Interface (React Native)**: Built with TypeScript and functional components. Uses `FlatList` for app usage display and `react-native-chart-kit` for visualization.
2.  **Native Module (Kotlin)**: Custom Android module that queries `UsageStatsManager` and `UsageEvents`. It aggregates raw usage data and counts app launches.
3.  **Data Layer (Realm)**: A high-performance local database. Replaces cloud storage to ensure 100% offline functionality and zero data leakage.
4.  **Device ID (AsyncStorage + Expo Crypto)**: Generates a stable, anonymous UUID locally to identify the device profile for storage indexing.

---

## 📊 Data Model

### Realm Schemas

#### `Usage`
Stores usage details for a specific app on a specific day.
- `id` (string, PK): Snapshot unique ID (e.g., `2024-03-12::com.instagram.android`).
- `packageName` (string): The Android package identifier.
- `appName` (string): Human-readable name (e.g., "Instagram").
- `timeInMs` (int): Total foreground duration in milliseconds.
- `openCount` (int): Number of times the app was launched.
- `date` (string): YYYY-MM-DD format for easy filtering.

#### `DailySnapshot`
Stores aggregated daily totals for the weekly overview chart.
- `date` (string, PK): YYYY-MM-DD.
- `totalMs` (int): Combined screen time for all apps that day.
- `updatedAt` (int): Timestamp of the last local sync.

---

## ⚡ Key Workflows

### 1. Usage Collection & Sync
1.  React Native triggers `loadUsage()` on mount or refresh.
2.  The `UsageStatsModule` queries Android's `UsageStatsManager` for the last 24h.
3.  The module aggregates time per package and counts `MOVE_TO_FOREGROUND` events.
4.  Data is bridged back to JS, sorted by time, and displayed.
5.  `saveUsageToRealm()` upserts records into the local Realm file.

### 2. Permission Handling
1.  The app checks for `PACKAGE_USAGE_STATS` permission.
2.  If missing, a **Permission Wall** is shown.
3.  The app guides the user to the specific Android "Usage Access" settings page.

---

## 🎨 UI/UX Design

- **Theme**: Premium Dark Mode (`#0D0F14`).
- **Accent**: Modern Purple (`#6C63FF`).
- **Typography**: System default (Sans-serif).
- **Interactive Elements**: Pulsing animations for permissions and scale-transitions for app list items.
- **Insights**: Highlight cards for the "Most Active" and "Most Frequent" apps.

---

## 🔒 Privacy & Security

- **Local-Only**: Data never leaves the device. There are no cloud endpoints, analytics trackers, or sync servers.
- **Anonymous Identification**: Device IDs are generated using hardware-independent UUIDs and stored only in `AsyncStorage`.
- **Zero Login**: No user accounts or PII (Personally Identifiable Information) collection.
