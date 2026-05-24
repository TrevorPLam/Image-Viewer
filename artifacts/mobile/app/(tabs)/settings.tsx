import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useSettings } from "@/context/SettingsContext";
import { useColors } from "@/hooks/useColors";

function SettingRow({ icon, label, subtitle, right, onPress }: {
  icon: string; label: string; subtitle?: string;
  right?: React.ReactNode; onPress?: () => void;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [sty.row, { backgroundColor: colors.card, opacity: pressed && onPress ? 0.7 : 1 }]}
      disabled={!onPress}
    >
      <View style={[sty.rowIcon, { backgroundColor: colors.secondary }]}>
        <Feather name={icon as never} size={16} color={colors.foreground} />
      </View>
      <View style={sty.rowText}>
        <Text style={[sty.rowLabel, { color: colors.foreground }]}>{label}</Text>
        {subtitle && <Text style={[sty.rowSub, { color: colors.mutedForeground }]}>{subtitle}</Text>}
      </View>
      {right ?? (onPress ? <Feather name="chevron-right" size={16} color={colors.mutedForeground} /> : null)}
    </Pressable>
  );
}

function SectionHeader({ title }: { title: string }) {
  const colors = useColors();
  return <Text style={[sty.sectionHeader, { color: colors.mutedForeground }]}>{title}</Text>;
}

const INTERVAL_OPTIONS = [2, 3, 5, 8, 10];
const TRANSITION_OPTIONS: { value: "fade" | "slide" | "zoom"; label: string }[] = [
  { value: "fade", label: "Fade" },
  { value: "slide", label: "Slide" },
  { value: "zoom", label: "Zoom" },
];

export default function SettingsScreen() {
  const { settings, updateSettings, appLockPin, setAppLockPin, lock } = useSettings();
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const [showPinModal, setShowPinModal] = useState(false);
  const [pinStep, setPinStep] = useState<"enter" | "confirm">("enter");
  const [pinInput, setPinInput] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [pinError, setPinError] = useState("");

  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  const handleToggleLock = async (val: boolean) => {
    if (val && !appLockPin) {
      setShowPinModal(true);
      return;
    }
    await updateSettings({ appLockEnabled: val });
    if (!val) {
      await setAppLockPin(null);
    }
  };

  const handleSetPin = async () => {
    if (pinStep === "enter") {
      if (pinInput.length < 4) { setPinError("PIN must be at least 4 digits"); return; }
      setPinConfirm(pinInput);
      setPinInput("");
      setPinStep("confirm");
      setPinError("");
    } else {
      if (pinInput !== pinConfirm) { setPinError("PINs do not match. Try again."); setPinInput(""); return; }
      await setAppLockPin(pinInput);
      await updateSettings({ appLockEnabled: true });
      setShowPinModal(false);
      setPinInput(""); setPinConfirm(""); setPinStep("enter"); setPinError("");
    }
  };

  const handleRemovePin = () => {
    if (Platform.OS === "web") {
      setAppLockPin(null);
      updateSettings({ appLockEnabled: false });
      return;
    }
    Alert.alert("Remove App Lock", "This will disable the PIN lock.", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: async () => {
        await setAppLockPin(null);
        await updateSettings({ appLockEnabled: false });
      }},
    ]);
  };

  return (
    <View style={[sty.root, { backgroundColor: colors.background }]}>
      <View style={[sty.header, { paddingTop: topInset }]}>
        <Text style={[sty.title, { color: colors.foreground }]}>Settings</Text>
      </View>

      <ScrollView
        contentContainerStyle={[sty.scroll, { paddingBottom: bottomInset + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Security ── */}
        <SectionHeader title="Security" />
        <View style={[sty.section, { borderColor: colors.border }]}>
          <SettingRow
            icon="lock"
            label="App Lock"
            subtitle={settings.appLockEnabled ? "PIN required on launch" : "Disabled"}
            right={
              <Switch
                value={settings.appLockEnabled}
                onValueChange={handleToggleLock}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor="#fff"
              />
            }
          />
          {settings.appLockEnabled && (
            <>
              <SettingRow
                icon="edit-2"
                label="Change PIN"
                subtitle="Update your 4-digit PIN"
                onPress={() => { setPinStep("enter"); setPinInput(""); setShowPinModal(true); }}
              />
              <SettingRow
                icon="smartphone"
                label="Biometric Unlock"
                subtitle="Use Face ID / fingerprint"
                right={
                  <Switch
                    value={true}
                    onValueChange={() => {}}
                    trackColor={{ false: colors.border, true: colors.primary }}
                    thumbColor="#fff"
                  />
                }
              />
              <SettingRow
                icon="lock"
                label="Lock Now"
                subtitle="Lock the app immediately"
                onPress={lock}
              />
            </>
          )}
          {appLockPin && (
            <SettingRow icon="trash-2" label="Remove PIN" subtitle="Disable all lock protection" onPress={handleRemovePin} />
          )}
        </View>

        {/* ── Slideshow ── */}
        <SectionHeader title="Slideshow" />
        <View style={[sty.section, { borderColor: colors.border }]}>
          <View style={sty.row}>
            <View style={[sty.rowIcon, { backgroundColor: colors.secondary }]}>
              <Feather name="play" size={16} color={colors.foreground} />
            </View>
            <View style={sty.rowText}>
              <Text style={[sty.rowLabel, { color: colors.foreground }]}>Slide Interval</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginTop: 8 }}>
                {INTERVAL_OPTIONS.map((v) => (
                  <Pressable
                    key={v}
                    onPress={() => updateSettings({ slideshowInterval: v })}
                    style={[sty.optBtn, { backgroundColor: settings.slideshowInterval === v ? colors.primary : colors.secondary }]}
                  >
                    <Text style={[sty.optLabel, { color: settings.slideshowInterval === v ? "#fff" : colors.mutedForeground }]}>{v}s</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          </View>

          <View style={sty.row}>
            <View style={[sty.rowIcon, { backgroundColor: colors.secondary }]}>
              <Feather name="film" size={16} color={colors.foreground} />
            </View>
            <View style={sty.rowText}>
              <Text style={[sty.rowLabel, { color: colors.foreground }]}>Transition</Text>
              <View style={{ flexDirection: "row", gap: 6, marginTop: 8 }}>
                {TRANSITION_OPTIONS.map(({ value, label }) => (
                  <Pressable
                    key={value}
                    onPress={() => updateSettings({ slideshowTransition: value })}
                    style={[sty.optBtn, { backgroundColor: settings.slideshowTransition === value ? colors.primary : colors.secondary }]}
                  >
                    <Text style={[sty.optLabel, { color: settings.slideshowTransition === value ? "#fff" : colors.mutedForeground }]}>{label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>

          <SettingRow
            icon="shuffle"
            label="Shuffle"
            subtitle="Randomize playback order"
            right={
              <Switch
                value={settings.slideshowShuffle}
                onValueChange={(v) => updateSettings({ slideshowShuffle: v })}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor="#fff"
              />
            }
          />
        </View>

        {/* ── Display ── */}
        <SectionHeader title="Display" />
        <View style={[sty.section, { borderColor: colors.border }]}>
          <View style={sty.row}>
            <View style={[sty.rowIcon, { backgroundColor: colors.secondary }]}>
              <Feather name="moon" size={16} color={colors.foreground} />
            </View>
            <View style={sty.rowText}>
              <Text style={[sty.rowLabel, { color: colors.foreground }]}>Theme</Text>
              <View style={{ flexDirection: "row", gap: 6, marginTop: 8 }}>
                {(["auto", "light", "dark"] as const).map((t) => (
                  <Pressable
                    key={t}
                    onPress={() => updateSettings({ theme: t })}
                    style={[sty.optBtn, { backgroundColor: settings.theme === t ? colors.primary : colors.secondary }]}
                  >
                    <Text style={[sty.optLabel, { color: settings.theme === t ? "#fff" : colors.mutedForeground }]}>
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>
          <View style={sty.row}>
            <View style={[sty.rowIcon, { backgroundColor: colors.secondary }]}>
              <Feather name="grid" size={16} color={colors.foreground} />
            </View>
            <View style={sty.rowText}>
              <Text style={[sty.rowLabel, { color: colors.foreground }]}>Grid Columns</Text>
              <View style={{ flexDirection: "row", gap: 6, marginTop: 8 }}>
                {([2, 3, 4] as const).map((c) => (
                  <Pressable
                    key={c}
                    onPress={() => updateSettings({ gridColumns: c })}
                    style={[sty.optBtn, { backgroundColor: settings.gridColumns === c ? colors.primary : colors.secondary }]}
                  >
                    <Text style={[sty.optLabel, { color: settings.gridColumns === c ? "#fff" : colors.mutedForeground }]}>{c}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>
        </View>

        {/* ── Privacy ── */}
        <SectionHeader title="Privacy" />
        <View style={[sty.section, { borderColor: colors.border }]}>
          <SettingRow icon="eye-off" label="Private Mode" subtitle="Blur thumbnails when switching apps" right={<Switch value={false} onValueChange={() => {}} trackColor={{ false: colors.border, true: colors.primary }} thumbColor="#fff" />} />
          <SettingRow icon="trash" label="Clear Edit History" subtitle="Remove all saved undo states" onPress={() => Alert.alert("Clear History", "This will remove all edit history from storage.", [{ text: "Cancel", style: "cancel" }, { text: "Clear", style: "destructive" }])} />
        </View>

        {/* ── About ── */}
        <SectionHeader title="About" />
        <View style={[sty.section, { borderColor: colors.border }]}>
          <SettingRow icon="info" label="Version" subtitle="1.0.0 (Build 100)" />
          <SettingRow icon="github" label="Open Source" subtitle="Built with Expo & React Native" />
          <SettingRow icon="file-text" label="Privacy Policy" onPress={() => {}} />
          <SettingRow icon="heart" label="Rate the App" onPress={() => {}} />
        </View>
      </ScrollView>

      {/* ── PIN Modal ── */}
      <Modal visible={showPinModal} transparent animationType="fade" onRequestClose={() => { setShowPinModal(false); setPinInput(""); setPinStep("enter"); setPinError(""); }}>
        <View style={sty.pinOverlay}>
          <View style={[sty.pinCard, { backgroundColor: colors.card }]}>
            <Text style={[sty.pinTitle, { color: colors.foreground }]}>
              {pinStep === "enter" ? "Set PIN" : "Confirm PIN"}
            </Text>
            <Text style={[sty.pinSub, { color: colors.mutedForeground }]}>
              {pinStep === "enter" ? "Enter a 4–6 digit PIN" : "Re-enter your PIN to confirm"}
            </Text>
            <TextInput
              style={[sty.pinInput, { color: colors.foreground, borderColor: pinError ? "#ff453a" : colors.border }]}
              value={pinInput}
              onChangeText={(t) => { setPinInput(t.replace(/\D/g, "").slice(0, 6)); setPinError(""); }}
              keyboardType="number-pad"
              secureTextEntry
              placeholder="••••"
              placeholderTextColor={colors.mutedForeground}
              autoFocus
              maxLength={6}
            />
            {pinError ? <Text style={sty.pinError}>{pinError}</Text> : null}
            <View style={sty.pinBtns}>
              <Pressable onPress={() => { setShowPinModal(false); setPinInput(""); setPinStep("enter"); setPinError(""); }} style={sty.pinCancelBtn}>
                <Text style={[sty.pinCancelLabel, { color: colors.mutedForeground }]}>Cancel</Text>
              </Pressable>
              <Pressable onPress={handleSetPin} style={[sty.pinConfirmBtn, { backgroundColor: colors.primary, opacity: pinInput.length >= 4 ? 1 : 0.4 }]}>
                <Text style={sty.pinConfirmLabel}>{pinStep === "enter" ? "Next" : "Set PIN"}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const sty = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 8 },
  title: { fontSize: 28, fontFamily: "Inter_700Bold", letterSpacing: -0.5, paddingVertical: 6 },
  scroll: { paddingHorizontal: 16 },
  sectionHeader: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 1, textTransform: "uppercase", marginTop: 24, marginBottom: 8, paddingHorizontal: 4 },
  section: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden", gap: 0 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  rowIcon: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  rowText: { flex: 1 },
  rowLabel: { fontSize: 15, fontFamily: "Inter_500Medium" },
  rowSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  optBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  optLabel: { fontSize: 13, fontFamily: "Inter_500Medium" },
  pinOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center" },
  pinCard: { width: 300, borderRadius: 20, padding: 24, gap: 14, alignItems: "center" },
  pinTitle: { fontSize: 20, fontFamily: "Inter_700Bold" },
  pinSub: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center" },
  pinInput: { width: "100%", height: 50, borderWidth: 1.5, borderRadius: 12, fontSize: 22, textAlign: "center", letterSpacing: 8, fontFamily: "Inter_600SemiBold" },
  pinError: { color: "#ff453a", fontSize: 13, fontFamily: "Inter_400Regular" },
  pinBtns: { flexDirection: "row", gap: 12, width: "100%", justifyContent: "flex-end" },
  pinCancelBtn: { paddingHorizontal: 16, paddingVertical: 10 },
  pinCancelLabel: { fontSize: 15, fontFamily: "Inter_500Medium" },
  pinConfirmBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  pinConfirmLabel: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
