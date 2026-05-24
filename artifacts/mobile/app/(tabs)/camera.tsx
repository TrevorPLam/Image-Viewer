import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { usePhotos } from "@/context/PhotosContext";
import { useColors } from "@/hooks/useColors";

export default function CameraScreen() {
  const { addPhoto } = usePhotos();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);

  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  const openCamera = async () => {
    if (Platform.OS === "web") {
      openLibrary();
      return;
    }
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") return;

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      quality: 0.92,
      exif: false,
    });

    if (!result.canceled && result.assets[0]) {
      setLoading(true);
      const asset = result.assets[0];
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await addPhoto(asset.uri, asset.width, asset.height);
      setLoading(false);
    }
  };

  const openLibrary = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") return;

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsMultipleSelection: true,
      selectionLimit: 20,
      quality: 0.92,
      exif: false,
    });

    if (!result.canceled && result.assets.length > 0) {
      setLoading(true);
      if (Platform.OS !== "web") {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      for (const asset of result.assets) {
        await addPhoto(asset.uri, asset.width, asset.height);
      }
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topInset }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Add Photos</Text>
      </View>

      <View style={[styles.body, { paddingBottom: bottomInset + 90 }]}>
        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
              Saving…
            </Text>
          </View>
        ) : (
          <>
            {Platform.OS !== "web" && (
              <Pressable
                onPress={openCamera}
                style={({ pressed }) => [
                  styles.option,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    opacity: pressed ? 0.75 : 1,
                  },
                ]}
              >
                <View
                  style={[
                    styles.optionIcon,
                    { backgroundColor: colors.primary + "20" },
                  ]}
                >
                  <Feather name="camera" size={28} color={colors.primary} />
                </View>
                <View style={styles.optionText}>
                  <Text style={[styles.optionTitle, { color: colors.foreground }]}>
                    Take Photo
                  </Text>
                  <Text style={[styles.optionSubtitle, { color: colors.mutedForeground }]}>
                    Use camera to capture a new photo
                  </Text>
                </View>
                <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
              </Pressable>
            )}

            <Pressable
              onPress={openLibrary}
              style={({ pressed }) => [
                styles.option,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  opacity: pressed ? 0.75 : 1,
                },
              ]}
            >
              <View
                style={[
                  styles.optionIcon,
                  { backgroundColor: "#30d158" + "20" },
                ]}
              >
                <Feather name="image" size={28} color="#30d158" />
              </View>
              <View style={styles.optionText}>
                <Text style={[styles.optionTitle, { color: colors.foreground }]}>
                  Choose from Library
                </Text>
                <Text style={[styles.optionSubtitle, { color: colors.mutedForeground }]}>
                  Import one or more photos
                </Text>
              </View>
              <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  title: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
    marginTop: 8,
  },
  body: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 20,
    gap: 12,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    padding: 16,
    gap: 14,
    borderWidth: 1,
  },
  optionIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  optionText: {
    flex: 1,
    gap: 3,
  },
  optionTitle: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  optionSubtitle: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
  },
  loadingBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
  },
});
