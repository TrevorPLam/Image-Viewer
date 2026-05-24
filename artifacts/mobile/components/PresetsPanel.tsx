import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { DEFAULT_ADJUSTMENTS, PhotoAdjustments } from "@/context/PhotosContext";

const PRESETS_KEY = "@photos_presets_v1";

interface Preset {
  id: string;
  name: string;
  adjustments: Partial<PhotoAdjustments>;
  builtIn?: boolean;
}

const BUILT_IN_PRESETS: Preset[] = [
  {
    id: "bi_vivid", name: "Vivid", builtIn: true,
    adjustments: { saturation: 25, vibrance: 20, contrast: 10, clarity: 15, dehaze: 8 },
  },
  {
    id: "bi_matte", name: "Matte", builtIn: true,
    adjustments: { blacks: 18, whites: -8, contrast: -20, shadows: 12, brightness: 5 },
  },
  {
    id: "bi_bw", name: "B&W", builtIn: true,
    adjustments: { saturation: -100, contrast: 10, clarity: 10 },
  },
  {
    id: "bi_fade", name: "Fade", builtIn: true,
    adjustments: { blacks: 22, whites: -12, contrast: -15, brightness: 8 },
  },
  {
    id: "bi_cool", name: "Cool", builtIn: true,
    adjustments: { warmth: -35, tint: -10, vibrance: 8 },
  },
  {
    id: "bi_warm", name: "Warm", builtIn: true,
    adjustments: { warmth: 45, vibrance: 10 },
  },
  {
    id: "bi_cinema", name: "Cinema", builtIn: true,
    adjustments: { toneMapping: 25, contrast: 18, shadows: -15, tint: 8, vignette: 35, blacks: -8 },
  },
  {
    id: "bi_portrait", name: "Portrait", builtIn: true,
    adjustments: { vibrance: 12, clarity: -8, sharpness: 25, brightness: 4, shadows: 10 },
  },
  {
    id: "bi_landscape", name: "Landscape", builtIn: true,
    adjustments: { dehaze: 20, saturation: 12, clarity: 18, shadows: 15, vibrance: 15 },
  },
  {
    id: "bi_moody", name: "Moody", builtIn: true,
    adjustments: { contrast: 22, shadows: -25, blacks: -12, vignette: 45, clarity: 12 },
  },
  {
    id: "bi_golden", name: "Golden", builtIn: true,
    adjustments: { warmth: 30, highlights: -15, shadows: 10, vibrance: 8, contrast: 5 },
  },
  {
    id: "bi_haze", name: "Haze", builtIn: true,
    adjustments: { brightness: 8, contrast: -10, whites: -5, blacks: 12, vibrance: -5, warmth: 10 },
  },
];

interface Props {
  visible: boolean;
  onClose: () => void;
  current: PhotoAdjustments;
  onApply: (adjustments: Partial<PhotoAdjustments>) => void;
}

export default function PresetsPanel({ visible, onClose, current, onApply }: Props) {
  const [userPresets, setUserPresets] = useState<Preset[]>([]);
  const [saving, setSaving] = useState(false);
  const [newName, setNewName] = useState("");

  useEffect(() => {
    if (visible) loadUserPresets();
  }, [visible]);

  const loadUserPresets = async () => {
    try {
      const raw = await AsyncStorage.getItem(PRESETS_KEY);
      if (raw) setUserPresets(JSON.parse(raw));
    } catch {}
  };

  const saveUserPreset = async (name: string) => {
    const preset: Preset = {
      id: Date.now().toString(),
      name: name.trim(),
      adjustments: { ...current },
    };
    const next = [...userPresets, preset];
    setUserPresets(next);
    await AsyncStorage.setItem(PRESETS_KEY, JSON.stringify(next));
    setNewName("");
    setSaving(false);
  };

  const deleteUserPreset = (id: string) => {
    const doDelete = async () => {
      const next = userPresets.filter((p) => p.id !== id);
      setUserPresets(next);
      await AsyncStorage.setItem(PRESETS_KEY, JSON.stringify(next));
    };
    if (Platform.OS === "web") { doDelete(); return; }
    Alert.alert("Delete Preset", "Remove this preset?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: doDelete },
    ]);
  };

  const applyPreset = (preset: Preset) => {
    const merged: PhotoAdjustments = {
      ...DEFAULT_ADJUSTMENTS,
      ...preset.adjustments,
    };
    onApply(merged);
    onClose();
  };

  const allPresets = [...BUILT_IN_PRESETS, ...userPresets];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <View style={styles.header}>
          <Text style={styles.title}>Presets</Text>
          <Pressable onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeLabel}>Done</Text>
          </Pressable>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.presetsRow}
        >
          {allPresets.map((preset) => (
            <Pressable
              key={preset.id}
              onPress={() => applyPreset(preset)}
              onLongPress={() => !preset.builtIn && deleteUserPreset(preset.id)}
              style={({ pressed }) => [styles.presetCard, { opacity: pressed ? 0.7 : 1 }]}
            >
              <View style={[styles.presetSwatch, preset.builtIn ? styles.presetSwatchBuiltIn : styles.presetSwatchUser]} />
              <Text style={styles.presetName} numberOfLines={1}>{preset.name}</Text>
              {!preset.builtIn && (
                <Text style={styles.customBadge}>Custom</Text>
              )}
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.saveSection}>
          {saving ? (
            <View style={styles.saveRow}>
              <TextInput
                style={styles.nameInput}
                placeholder="Preset name…"
                placeholderTextColor="rgba(255,255,255,0.3)"
                value={newName}
                onChangeText={setNewName}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={() => newName.trim() && saveUserPreset(newName)}
              />
              <Pressable
                onPress={() => newName.trim() && saveUserPreset(newName)}
                style={[styles.saveConfirm, { opacity: newName.trim() ? 1 : 0.4 }]}
              >
                <Text style={styles.saveConfirmLabel}>Save</Text>
              </Pressable>
              <Pressable onPress={() => { setSaving(false); setNewName(""); }} style={styles.cancelBtn}>
                <Text style={styles.cancelLabel}>Cancel</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable onPress={() => setSaving(true)} style={styles.saveCurrent}>
              <Text style={styles.saveCurrentLabel}>+ Save Current Settings as Preset</Text>
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#1c1c1e",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
    gap: 0,
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 4,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  title: {
    color: "#fff",
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
  },
  closeBtn: { padding: 4 },
  closeLabel: {
    color: "#0a84ff",
    fontSize: 16,
    fontFamily: "Inter_500Medium",
  },
  presetsRow: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 10,
    flexDirection: "row",
  },
  presetCard: {
    width: 76,
    alignItems: "center",
    gap: 6,
  },
  presetSwatch: {
    width: 76,
    height: 76,
    borderRadius: 12,
  },
  presetSwatchBuiltIn: {
    backgroundColor: "rgba(255,255,255,0.1)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  presetSwatchUser: {
    backgroundColor: "rgba(10,132,255,0.2)",
    borderWidth: 1,
    borderColor: "rgba(10,132,255,0.4)",
  },
  presetName: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    textAlign: "center",
  },
  customBadge: {
    color: "#0a84ff",
    fontSize: 10,
    fontFamily: "Inter_400Regular",
  },
  saveSection: {
    paddingHorizontal: 20,
    paddingTop: 4,
  },
  saveRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  nameInput: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: "#fff",
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  saveConfirm: {
    backgroundColor: "#0a84ff",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  saveConfirmLabel: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  cancelBtn: { paddingHorizontal: 4 },
  cancelLabel: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  saveCurrent: {
    alignItems: "center",
    paddingVertical: 12,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 12,
  },
  saveCurrentLabel: {
    color: "#0a84ff",
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
});
