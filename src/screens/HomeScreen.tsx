import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { BarChart } from "react-native-chart-kit";
import { SafeAreaView } from "react-native-safe-area-context";

import { getUsageStats, hasUsageStatsPermission, UsageStat } from "@/src/native/usageStats";
import {
  DailyTotal,
  getWeeklyTotals,
  saveUsageToRealm,
} from "@/src/services/usageService";
import { formatUsageTime } from "@/src/utils/formatUsage";
import { openUsageSettings } from "@/src/utils/openUsagePermission";

// ─── Constants ────────────────────────────────────────────────────────────────
const SCREEN_WIDTH = Dimensions.get("window").width;

const C = {
  bg: "#F8FAFC", // Light slate background
  card: "#FFFFFF", // Pure white cards
  cardBorder: "#E2E8F0", // Soft slate border
  accent: "#4361EE", // Modern Academic Blue
  accentSoft: "#4361EE15",
  text: "#1E293B", // Dark slate text
  subtext: "#64748B", // Medium slate subtext
  pill: "#F1F5F9", // Lightest slate for backgrounds
  success: "#06D6A0",
  danger: "#EF476F",
};

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function ScreenTimeHome() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [stats, setStats] = useState<UsageStat[]>([]);
  const [weekly, setWeekly] = useState<DailyTotal[]>([]);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [saveError, setSaveError] = useState(false);
  const [sortBy, setSortBy] = useState<'time' | 'opens'>('time');

  // Pulsing animation for permission wall button
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (hasPermission === false) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1.06, duration: 800, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true }),
        ])
      ).start();
    }
  }, [hasPermission, pulse]);

  // ── Data loading ────────────────────────────────────────────────────────────
  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const granted = await hasUsageStatsPermission();
      setHasPermission(granted);
      if (!granted) return;

      const raw = await getUsageStats();
      const sorted = [...raw]
        .sort((a, b) => b.totalTimeInForeground - a.totalTimeInForeground)
        .slice(0, 40);
      setStats(sorted);

      try {
        await saveUsageToRealm(sorted);
        setSavedAt(new Date());
        setSaveError(false);
      } catch (e) {
        console.warn("Realm save error:", e);
        setSaveError(true);
      }

      try {
        const w = await getWeeklyTotals();
        setWeekly(w);
      } catch (e) {
        console.warn("Realm weekly query error:", e);
      }
    } catch (e) {
      console.warn("Usage load error:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load(true);
  };

  // ── Derived data ────────────────────────────────────────────────────────────
  const todayTotalMs = stats.reduce((s, u) => s + u.totalTimeInForeground, 0);
  const todayTotalLabel = formatUsageTime(todayTotalMs);

  const sortedStats = useMemo(() => {
    return [...stats].sort((a, b) => {
      if (sortBy === 'time') {
        return b.totalTimeInForeground - a.totalTimeInForeground;
      }
      return b.openCount - a.openCount;
    });
  }, [stats, sortBy]);

  const maxForegroundMs = useMemo(() => {
    if (stats.length === 0) return 1;
    return Math.max(...stats.map(s => s.totalTimeInForeground), 1);
  }, [stats]);

  const chartLabels = weekly.length >= 2
    ? weekly.map((d) =>
      new Date(d.date + "T00:00:00").toLocaleDateString("en", { weekday: "short" })
    )
    : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const chartData = {
    labels: chartLabels,
    datasets: [{
      data: weekly.length >= 2
        ? weekly.map((d) => parseFloat((d.totalMs / 3_600_000).toFixed(1)))
        : [0, 0, 0, 0, 0, 0, 0],
    }],
  };

  const mostUsed = stats[0];
  const mostOpened = [...stats].sort((a, b) => b.openCount - a.openCount)[0];

  // ── Render Branches ─────────────────────────────────────────────────────────
  if (hasPermission === false) {
    return <PermissionWall pulse={pulse} onGrant={openUsageSettings} onCheck={() => load()} />;
  }

  if (loading) {
    return (
      <SafeAreaView style={s.centered}>
        <ActivityIndicator size="large" color={C.accent} />
        <Text style={[s.subtext, { marginTop: 16 }]}>Reading usage data…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.root}>
      <FlatList
        data={sortedStats}
        keyExtractor={(item) => item.packageName}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={C.accent}
          />
        }
        ListHeaderComponent={
          <>
            <View style={s.headerRow}>
              <View>
                <Text style={s.headerTitle}>Today</Text>
                <Text style={s.headerDate}>
                  {new Date().toLocaleDateString("en", {
                    weekday: "long", month: "long", day: "numeric",
                  })}
                </Text>
              </View>
              <View style={s.totalBadge}>
                <Text style={s.totalBadgeValue}>{todayTotalLabel}</Text>
                <Text style={s.totalBadgeLabel}>total</Text>
              </View>
            </View>

            <View style={s.offlineBadgeRow}>
              <View style={s.offlineBadge}>
                <Text style={s.offlineDot}>●</Text>
                <Text style={s.offlineBadgeText}>Offline · Stored locally on device</Text>
              </View>
            </View>

            <View style={s.section}>
              <SectionTitle title="Weekly Overview" />
              <View style={s.chartCard}>
                <BarChart
                  data={chartData}
                  width={SCREEN_WIDTH - 70}
                  height={160}
                  yAxisSuffix="h"
                  yAxisLabel=""
                  fromZero
                  withInnerLines={false}
                  chartConfig={{
                    backgroundColor: "#FFFFFF",
                    backgroundGradientFrom: "#FFFFFF",
                    backgroundGradientTo: "#FFFFFF",
                    decimalPlaces: 1,
                    color: (opacity) => "rgba(67, 97, 238, " + (opacity || 1) + ")",
                    labelColor: () => C.subtext,
                    propsForBackgroundLines: { stroke: "#F1F5F9" },
                    propsForLabels: { fontSize: 10, fontWeight: "600" },
                  }}
                  flatColor={true}
                  style={{ borderRadius: 8 }}
                />
              </View>
              {weekly.length < 2 && (
                <Text style={[s.subtext, { textAlign: "center", marginTop: 8 }]}>
                  Use the app for 2+ days to see your weekly trend
                </Text>
              )}
            </View>

            <View style={s.section}>
              <SectionTitle title="Daily Insights" />
              <View style={s.insightGrid}>
                <InsightCard
                  label="Most Active"
                  value={mostUsed?.appName ?? "N/A"}
                  subValue={mostUsed ? formatUsageTime(mostUsed.totalTimeInForeground) : ""}
                  icon="🔥"
                />
                <InsightCard
                  label="Most Frequent"
                  value={mostOpened?.appName ?? "N/A"}
                  subValue={mostOpened ? `${mostOpened.openCount} opens` : ""}
                  icon="⚡"
                />
              </View>
            </View>

            <View style={[s.section, { marginBottom: 12 }]}>
              <View style={s.sectionTitleRow}>
                <View>
                  <Text style={s.sectionTitle}>App Usage</Text>
                  <Text style={s.sectionSubtitle}>{stats.length} apps · top 40</Text>
                </View>
                
                <View style={s.sortBar}>
                   <Pressable 
                     onPress={() => setSortBy('time')}
                     style={[s.sortBtn, sortBy === 'time' && s.sortBtnActive]}
                   >
                     <Text style={[s.sortBtnText, sortBy === 'time' && s.sortBtnTextActive]}>Time</Text>
                   </Pressable>
                   <Pressable 
                     onPress={() => setSortBy('opens')}
                     style={[s.sortBtn, sortBy === 'opens' && s.sortBtnActive, { marginLeft: 8 }]}
                   >
                     <Text style={[s.sortBtnText, sortBy === 'opens' && s.sortBtnTextActive]}>Clicks</Text>
                   </Pressable>
                </View>
              </View>
            </View>
          </>
        }
        renderItem={({ item, index }) => (
          <AppRow
            stat={item}
            rank={index + 1}
            maxMs={maxForegroundMs}
          />
        )}
        ListFooterComponent={
          <View style={s.footer}>
            {savedAt && !saveError && (
              <Text style={s.savedText}>
                ✓ Saved to Realm · {savedAt.toLocaleTimeString()}
              </Text>
            )}
            {saveError && (
              <Text style={[s.savedText, { color: C.danger }]}>
                ⚠ Failed to save locally — check storage
              </Text>
            )}
            <Text style={s.footerNote}>All data stored offline on this device</Text>
          </View>
        }
        contentContainerStyle={s.listContent}
      />
    </SafeAreaView>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={s.sectionTitleRow}>
      <Text style={s.sectionTitle}>{title}</Text>
      {subtitle && <Text style={s.subtext}>{subtitle}</Text>}
    </View>
  );
}

function AppRow({
  stat, rank, maxMs,
}: { stat: UsageStat; rank: number; maxMs: number }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const pct = Math.max(0, Math.min(1, stat.totalTimeInForeground / maxMs));
  const time = formatUsageTime(stat.totalTimeInForeground);

  const onPress = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.96, duration: 70, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 70, useNativeDriver: true }),
    ]).start();
  };

  return (
    <Pressable onPress={onPress}>
      <Animated.View style={[s.appRow, { transform: [{ scale: scaleAnim }] }]}>
        <Text style={s.rankText}>{rank}</Text>
        <View style={s.appInfo}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={s.appName} numberOfLines={1}>{stat.appName}</Text>
            {stat.openCount > 0 && (
              <View style={[s.openBadge, { backgroundColor: C.accentSoft }]}>
                <Text style={[s.openBadgeText, { color: C.accent }]}>{stat.openCount}x</Text>
              </View>
            )}
          </View>
          <Text style={s.appPkg} numberOfLines={1}>{stat.packageName}</Text>
          <View style={s.barTrack}>
            <View style={[s.barFill, { width: (pct * 100) + "%", backgroundColor: C.accent }]} />
          </View>
        </View>
        <Text style={[s.timeText, { color: C.text }]}>{time}</Text>
      </Animated.View>
    </Pressable>
  );
}

function InsightCard({ label, value, subValue, icon }: { label: string; value: string; subValue: string; icon: string }) {
  return (
    <View style={s.insightCard}>
      <Text style={s.insightIcon}>{icon}</Text>
      <View>
        <Text style={s.insightLabel}>{label}</Text>
        <Text style={s.insightValue} numberOfLines={1}>{value}</Text>
        <Text style={s.insightSubValue}>{subValue}</Text>
      </View>
    </View>
  );
}

function PermissionWall({
  pulse, onGrant, onCheck,
}: { pulse: Animated.Value; onGrant: () => void; onCheck: () => void }) {
  return (
    <SafeAreaView style={s.centered}>
      <Text style={s.permEmoji}>🔐</Text>
      <Text style={s.permTitle}>Usage Access Required</Text>
      <Text style={s.permDesc}>
        This app needs Usage Access permission to read how long you spend on each app.{"\n\n"}
        Tap below, find{" "}
        <Text style={{ color: C.accent, fontWeight: "700" }}>Screen Time App</Text>
        {" "}in the list, and enable it.{"\n\n"}
        All data stays{" "}
        <Text style={{ color: C.success, fontWeight: "700" }}>fully offline</Text>
        {" "}on your device.
      </Text>

      <Animated.View style={{ transform: [{ scale: pulse }], width: "100%" }}>
        <TouchableOpacity style={s.grantBtn} onPress={onGrant} activeOpacity={0.85}>
          <Text style={s.grantBtnText}>Open Usage Access Settings</Text>
        </TouchableOpacity>
      </Animated.View>

      <TouchableOpacity style={s.recheckBtn} onPress={onCheck} activeOpacity={0.7}>
        <Text style={s.recheckText}>I've granted it — Check again</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  listContent: { paddingBottom: 48 },
  centered: {
    flex: 1, backgroundColor: C.bg,
    justifyContent: "center", alignItems: "center", paddingHorizontal: 32,
  },
  subtext: { fontSize: 12, color: C.subtext },
  headerRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 24, paddingTop: 32, paddingBottom: 12,
  },
  headerTitle: { fontSize: 32, fontWeight: "800", color: C.text, letterSpacing: -0.5 },
  headerDate: { fontSize: 14, color: C.subtext, marginTop: 2, fontWeight: "500" },
  totalBadge: {
    backgroundColor: C.accent, paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: 20, shadowColor: C.accent, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
    alignItems: "center",
  },
  totalBadgeValue: { fontSize: 18, fontWeight: "800", color: "#FFFFFF" },
  totalBadgeLabel: { fontSize: 10, color: "rgba(255,255,255,0.7)", marginTop: 1, textTransform: "uppercase" },
  offlineBadgeRow: { paddingHorizontal: 24, marginTop: 0 },
  offlineBadge: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#F1F5F9", borderRadius: 20, paddingHorizontal: 12,
    paddingVertical: 6, alignSelf: "flex-start",
    borderWidth: 1, borderColor: "#E2E8F0",
  },
  offlineDot: { fontSize: 8, color: C.success },
  offlineBadgeText: { fontSize: 11, color: C.subtext, fontWeight: "600" },
  section: { paddingHorizontal: 24, marginTop: 28 },
  sectionTitleRow: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "baseline", marginBottom: 16,
  },
  sectionTitle: { fontSize: 18, fontWeight: "800", color: C.text, letterSpacing: -0.3 },
  sectionSubtitle: { fontSize: 12, color: C.subtext, marginTop: 2 },
  chartCard: {
    backgroundColor: "#FFFFFF", borderRadius: 10,
    paddingVertical: 25,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 15, elevation: 3,
    borderWidth: 1, borderColor: "#F1F5F9",
  },
  appRow: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#FFFFFF", marginHorizontal: 20, marginBottom: 12,
    borderRadius: 20, padding: 14,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, shadowRadius: 10, elevation: 2,
    borderWidth: 1, borderColor: "#F1F5F9",
    gap: 12,
  },
  rankText: { fontSize: 12, color: C.subtext, fontWeight: "700", width: 20, textAlign: "center" },
  appInfo: { flex: 1, gap: 4, marginLeft: 8 },
  appName: { fontSize: 15, fontWeight: "700", color: C.text },
  appPkg: { fontSize: 11, color: C.subtext },
  barTrack: {
    height: 6, backgroundColor: "#F1F5F9", borderRadius: 3,
    marginTop: 4, overflow: "hidden",
  },
  barFill: { height: "100%", borderRadius: 3 },
  timeText: { fontSize: 14, fontWeight: "700", width: 75, textAlign: "right" },
  footer: { paddingHorizontal: 24, paddingTop: 32, paddingBottom: 40, alignItems: "center", gap: 6 },
  savedText: { fontSize: 12, color: C.success, fontWeight: "600" },
  footerNote: { fontSize: 11, color: C.subtext, fontWeight: "500" },
  permEmoji: { fontSize: 64, marginBottom: 20 },
  permTitle: { fontSize: 22, fontWeight: "800", color: C.text, marginBottom: 12 },
  permDesc: { fontSize: 15, color: C.subtext, textAlign: "center", lineHeight: 24, marginBottom: 40, paddingHorizontal: 10 },
  grantBtn: {
    backgroundColor: C.accent, borderRadius: 18,
    paddingVertical: 18, alignItems: "center", width: "100%",
    shadowColor: C.accent, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 8,
  },
  grantBtnText: { fontSize: 17, fontWeight: "700", color: "#FFFFFF" },
  recheckBtn: { marginTop: 24, padding: 12 },
  recheckText: { fontSize: 15, color: C.accent, fontWeight: "600" },
  insightGrid: { flexDirection: "row", gap: 14, marginTop: 4 },
  insightCard: {
    flex: 1, backgroundColor: "#FFFFFF", borderRadius: 20, padding: 16,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, shadowRadius: 10, elevation: 2,
    borderWidth: 1, borderColor: "#F1F5F9",
    alignItems: "flex-start", gap: 8,
  },
  insightIcon: { fontSize: 28, marginBottom: 4 },
  insightLabel: { fontSize: 11, fontWeight: "700", color: C.subtext, textTransform: "uppercase", letterSpacing: 0.6 },
  insightValue: { fontSize: 16, fontWeight: "800", color: C.text, marginTop: 2 },
  insightSubValue: { fontSize: 12, color: C.subtext, marginTop: 2, fontWeight: "500" },
  openBadge: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
  },
  openBadgeText: { fontSize: 11, fontWeight: "800" },
  sortBar: {
    flexDirection: "row",
    backgroundColor: "#F1F5F9",
    padding: 3,
    borderRadius: 10,
  },
  sortBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  sortBtnActive: {
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  sortBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: C.subtext,
  },
  sortBtnTextActive: {
    color: C.accent,
  },
});
