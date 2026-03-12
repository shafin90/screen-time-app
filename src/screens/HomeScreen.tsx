import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  FlatList,
  Pressable,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { BarChart } from "react-native-chart-kit";

import { getUsageStats, hasUsageStatsPermission, UsageStat } from "@/src/native/usageStats";
import { openUsageSettings } from "@/src/utils/openUsagePermission";
import { formatUsageTime } from "@/src/utils/formatUsage";
import {
  saveUsageToRealm,
  getWeeklyTotals,
  DailyTotal,
} from "@/src/services/usageService";

// ─── Constants ────────────────────────────────────────────────────────────────
const SCREEN_WIDTH = Dimensions.get("window").width;

const C = {
  bg:         "#0D0F14",
  card:       "#161A23",
  cardBorder: "#1E2433",
  accent:     "#6C63FF",
  accentSoft: "#6C63FF22",
  text:       "#E8EAF0",
  subtext:    "#7A7F94",
  pill:       "#1E2433",
  success:    "#4ADE80",
  danger:     "#FF5C5C",
};

const ICON_COLORS = [
  "#FF6B6B", "#FFD93D", "#6BCB77", "#4D96FF",
  "#C77DFF", "#FF9B54", "#06D6A0", "#EF476F",
];
const iconColor = (name: string) =>
  ICON_COLORS[name.charCodeAt(0) % ICON_COLORS.length];
const initials = (name: string) => name.slice(0, 2).toUpperCase();

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function ScreenTimeHome() {
  const [loading,       setLoading]       = useState(true);
  const [refreshing,    setRefreshing]    = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [stats,         setStats]         = useState<UsageStat[]>([]);
  const [weekly,        setWeekly]        = useState<DailyTotal[]>([]);
  const [savedAt,       setSavedAt]       = useState<Date | null>(null);
  const [saveError,     setSaveError]     = useState(false);

  // Pulsing animation for permission wall button
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (hasPermission === false) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1.06, duration: 800, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1,    duration: 800, useNativeDriver: true }),
        ])
      ).start();
    }
  }, [hasPermission]);

  // ── Data loading ────────────────────────────────────────────────────────────
  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      // 1. Check permission
      const granted = await hasUsageStatsPermission();
      setHasPermission(granted);
      if (!granted) return;

      // 2. Fetch live stats from native module
      const raw = await getUsageStats();
      const sorted = [...raw]
        .sort((a, b) => b.totalTimeInForeground - a.totalTimeInForeground)
        .slice(0, 40);
      setStats(sorted);

      // 3. Persist to Realm (offline, no network needed)
      try {
        await saveUsageToRealm(sorted);
        setSavedAt(new Date());
        setSaveError(false);
      } catch (e) {
        console.warn("Realm save error:", e);
        setSaveError(true);
      }

      // 4. Load 7-day history from Realm for the chart
      try {
        const w = await getWeeklyTotals();
        setWeekly(w);
      } catch (e) {
        console.warn("Realm weekly query error:", e);
      }
    } catch (e) {
      console.error("Load error:", e);
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

  // ── Insights ──────────────────────────────────────────────────────────────
  const mostUsed   = stats[0];
  const mostOpened = [...stats].sort((a, b) => b.openCount - a.openCount)[0];

  // ── Permission wall ─────────────────────────────────────────────────────────
  if (hasPermission === false) {
    return <PermissionWall pulse={pulse} onGrant={openUsageSettings} onCheck={() => load()} />;
  }

  // ── Loading state ───────────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={s.centered}>
        <ActivityIndicator size="large" color={C.accent} />
        <Text style={[s.subtext, { marginTop: 16 }]}>Reading usage data…</Text>
      </SafeAreaView>
    );
  }

  // ── Main UI ─────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.root}>
      <FlatList
        data={stats}
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
            {/* ── Header ── */}
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

            {/* ── Offline badge ── */}
            <View style={s.offlineBadgeRow}>
              <View style={s.offlineBadge}>
                <Text style={s.offlineDot}>●</Text>
                <Text style={s.offlineBadgeText}>Offline · Stored locally on device</Text>
              </View>
            </View>

            {/* ── Weekly chart ── */}
            <View style={s.section}>
              <SectionTitle title="Weekly Overview" />
              <View style={s.chartCard}>
                <BarChart
                  data={chartData}
                  width={SCREEN_WIDTH - 48}
                  height={160}
                  yAxisSuffix="h"
                  yAxisLabel=""
                  showValuesOnTopOfBars
                  fromZero
                  withInnerLines={false}
                  chartConfig={{
                    backgroundColor:        C.card,
                    backgroundGradientFrom: C.card,
                    backgroundGradientTo:   C.card,
                    decimalPlaces:          1,
                    color:    (opacity = 1) => `rgba(108, 99, 255, ${opacity})`,
                    labelColor: ()          => C.subtext,
                    propsForBackgroundLines: { stroke: "transparent" },
                    propsForLabels: { fontSize: 10 },
                  }}
                  style={{ borderRadius: 16 }}
                />
              </View>
              {weekly.length < 2 && (
                <Text style={[s.subtext, { textAlign: "center", marginTop: 8 }]}>
                  Use the app for 2+ days to see your weekly trend
                </Text>
              )}
            </View>

            {/* ── Daily Insights ── */}
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

            {/* ── App list heading ── */}
            <View style={s.section}>
              <SectionTitle
                title="App Usage"
                subtitle={`${stats.length} apps · top 40`}
              />
            </View>
          </>
        }
        renderItem={({ item, index }) => (
          <AppRow
            stat={item}
            rank={index + 1}
            maxMs={stats[0]?.totalTimeInForeground ?? 1}
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
  const pct   = Math.max(0, Math.min(1, stat.totalTimeInForeground / maxMs));
  const color = iconColor(stat.appName);
  const time  = formatUsageTime(stat.totalTimeInForeground);

  const onPress = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.96, duration: 70, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1,    duration: 70, useNativeDriver: true }),
    ]).start();
  };

  return (
    <Pressable onPress={onPress}>
      <Animated.View style={[s.appRow, { transform: [{ scale: scaleAnim }] }]}>
        <Text style={s.rankText}>{rank}</Text>

        {/* App icon avatar */}
        <View style={[s.appIcon, { backgroundColor: color + "33" }]}>
          <Text style={[s.appIconText, { color }]}>{initials(stat.appName)}</Text>
        </View>

        {/* Name + progress bar */}
        <View style={s.appInfo}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={s.appName} numberOfLines={1}>{stat.appName}</Text>
            {stat.openCount > 0 && (
               <View style={[s.openBadge, { backgroundColor: color + "1a" }]}>
                 <Text style={[s.openBadgeText, { color }]}>{stat.openCount}x</Text>
               </View>
            )}
          </View>
          <Text style={s.appPkg} numberOfLines={1}>{stat.packageName}</Text>
          <View style={s.barTrack}>
            <View style={[s.barFill, { width: `${pct * 100}%`, backgroundColor: color }]} />
          </View>
        </View>

        <Text style={[s.timeText, { color }]}>{time}</Text>
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
  root:        { flex: 1, backgroundColor: C.bg },
  listContent: { paddingBottom: 48 },
  centered:    {
    flex: 1, backgroundColor: C.bg,
    justifyContent: "center", alignItems: "center", paddingHorizontal: 32,
  },
  subtext: { fontSize: 12, color: C.subtext },

  // Header
  headerRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 24, paddingTop: 24, paddingBottom: 4,
  },
  headerTitle: { fontSize: 30, fontWeight: "800", color: C.text },
  headerDate:  { fontSize: 13, color: C.subtext, marginTop: 2 },
  totalBadge:  {
    backgroundColor: C.accentSoft, paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: 20, borderWidth: 1, borderColor: C.accent + "55",
    alignItems: "center",
  },
  totalBadgeValue: { fontSize: 18, fontWeight: "800", color: C.accent },
  totalBadgeLabel: { fontSize: 10, color: C.accent + "aa", marginTop: 1 },

  // Offline badge
  offlineBadgeRow: { paddingHorizontal: 24, marginTop: 8 },
  offlineBadge: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#4ADE8022", borderRadius: 20, paddingHorizontal: 12,
    paddingVertical: 5, alignSelf: "flex-start",
    borderWidth: 1, borderColor: "#4ADE8044",
  },
  offlineDot:       { fontSize: 8, color: "#4ADE80" },
  offlineBadgeText: { fontSize: 11, color: "#4ADE80", fontWeight: "600" },

  // Sections
  section:       { paddingHorizontal: 24, marginTop: 20 },
  sectionTitleRow: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "baseline", marginBottom: 10,
  },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: C.text },

  // Chart
  chartCard: {
    backgroundColor: C.card, borderRadius: 20,
    borderWidth: 1, borderColor: C.cardBorder,
    overflow: "hidden", paddingTop: 12,
  },

  // App row
  appRow: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: C.card, marginHorizontal: 16, marginBottom: 8,
    borderRadius: 16, padding: 12,
    borderWidth: 1, borderColor: C.cardBorder,
    gap: 10,
  },
  rankText: { fontSize: 11, color: C.subtext, fontWeight: "600", width: 18, textAlign: "center" },
  appIcon: {
    width: 44, height: 44, borderRadius: 12,
    justifyContent: "center", alignItems: "center",
  },
  appIconText: { fontSize: 15, fontWeight: "800" },
  appInfo:  { flex: 1, gap: 2 },
  appName:  { fontSize: 14, fontWeight: "700", color: C.text },
  appPkg:   { fontSize: 10, color: C.subtext },
  barTrack: {
    height: 4, backgroundColor: C.pill, borderRadius: 2,
    marginTop: 4, overflow: "hidden",
  },
  barFill: { height: "100%", borderRadius: 2 },
  timeText: {
    fontSize: 13, fontWeight: "700",
    minWidth: 52, textAlign: "right",
  },

  // Footer
  footer:    { paddingHorizontal: 24, paddingTop: 20, alignItems: "center", gap: 4 },
  savedText: { fontSize: 11, color: C.success, textAlign: "center" },
  footerNote:{ fontSize: 10, color: C.subtext, textAlign: "center" },

  // Permission wall
  permEmoji: { fontSize: 56, marginBottom: 16 },
  permTitle: { fontSize: 24, fontWeight: "800", color: C.text, textAlign: "center", marginBottom: 12 },
  permDesc:  { fontSize: 14, color: C.subtext, textAlign: "center", lineHeight: 22, marginBottom: 32 },
  grantBtn: {
    backgroundColor: C.accent, borderRadius: 16,
    paddingVertical: 16, alignItems: "center", width: "100%",
  },
  grantBtnText: { fontSize: 16, fontWeight: "700", color: "#fff" },
  recheckBtn:   { marginTop: 16, padding: 12 },
  recheckText:  { fontSize: 14, color: C.accent },

  // Insight Grid
  insightGrid: { flexDirection: "row", gap: 12, marginTop: 4 },
  insightCard: {
    flex: 1, backgroundColor: C.card, borderRadius: 16, padding: 12,
    borderWidth: 1, borderColor: C.cardBorder, flexDirection: "row",
    alignItems: "center", gap: 12,
  },
  insightIcon:     { fontSize: 24 },
  insightLabel:    { fontSize: 10, fontWeight: "700", color: C.subtext, textTransform: "uppercase", letterSpacing: 0.5 },
  insightValue:    { fontSize: 14, fontWeight: "800", color: C.text, marginTop: 1 },
  insightSubValue: { fontSize: 11, color: C.subtext, marginTop: 1 },

  // App row extras
  openBadge: {
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
  },
  openBadgeText: { fontSize: 10, fontWeight: "800" },
});
