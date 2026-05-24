import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import {
  Alert,
  Dimensions,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { usePhotos } from "@/context/PhotosContext";
import { useColors } from "@/hooks/useColors";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

export default function PhotoDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { photos, deletePhoto } = usePhotos();
  const router = useRouter();
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const photo = useMemo(() => photos.find((p) => p.id === id), [photos, id]);

  const [showInfo, setShowInfo] = useState(false);

  const handleDelete = () => {
    if (Platform.OS === "web") {
      deletePhoto(id ?? "");
      router.back();
      return;
    }
    Alert.alert("Delete Photo", "This photo will be permanently deleted.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          if (id) {
            await deletePhoto(id);
          }
          router.back();
        },
      },
    ]);
  };

  if (!photo) {
    return (
      <View style={[styles.container, { backgroundColor: "#000" }]}>
        <Text style={{ color: "#fff" }}>Photo not found</Text>
      </View>
    );
  }

  const topInset = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[styles.container, { backgroundColor: "#000" }]}>
      <Pressable
        style={styles.imageContainer}
        onPress={() => setShowInfo((v) => !v)}
      >
        <Image
          source={{ uri: photo.uri }}
          style={styles.image}
          contentFit="contain"
          transition={150}
        />
      </Pressable>

      <View
        style={[
          styles.topBar,
          { paddingTop: topInset + 8 },
        ]}
      >
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.iconBtn, { opacity: pressed ? 0.6 : 1 }]}
          hitSlop={12}
        >
          <Feather name="chevron-left" size={28} color="#fff" />
        </Pressable>

        <Pressable
          onPress={handleDelete}
          style={({ pressed }) => [styles.iconBtn, { opacity: pressed ? 0.6 : 1 }]}
          hitSlop={12}
        >
          <Feather name="trash-2" size={22} color={colors.destructive} />
        </Pressable>
      </View>

      {showInfo && (
        <View
          style={[
            styles.infoBar,
            {
              backgroundColor: "rgba(0,0,0,0.75)",
              paddingBottom: insets.bottom + 16,
            },
          ]}
        >
          <Text style={styles.infoText}>
            {new Date(photo.timestamp).toLocaleDateString("en-US", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </Text>
          <Text style={styles.infoSubtext}>
            {new Date(photo.timestamp).toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  imageContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  image: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  infoBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 4,
  },
  infoText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_500Medium",
  },
  infoSubtext: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
});
