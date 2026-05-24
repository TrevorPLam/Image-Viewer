import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AppState, Platform } from "react-native";

export interface AppSettings {
  appLockEnabled: boolean;
  slideshowInterval: number;
  slideshowShuffle: boolean;
  slideshowTransition: "fade" | "slide" | "zoom";
  theme: "auto" | "dark" | "light";
  gridColumns: 2 | 3 | 4;
}

const DEFAULT_SETTINGS: AppSettings = {
  appLockEnabled: false,
  slideshowInterval: 3,
  slideshowShuffle: false,
  slideshowTransition: "fade",
  theme: "auto",
  gridColumns: 3,
};

interface SettingsContextValue {
  settings: AppSettings;
  updateSettings: (patch: Partial<AppSettings>) => Promise<void>;
  appLockPin: string | null;
  setAppLockPin: (pin: string | null) => Promise<void>;
  requiresUnlock: boolean;
  unlock: (pin: string) => boolean;
  unlockBiometric: () => Promise<boolean>;
  lock: () => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);
const SETTINGS_KEY = "@photos_settings_v1";
const PIN_KEY = "@photos_lock_pin_v1";

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [appLockPin, setAppLockPinState] = useState<string | null>(null);
  const [requiresUnlock, setRequiresUnlock] = useState(false);
  const appStateRef = useRef(AppState.currentState);

  useEffect(() => {
    (async () => {
      try {
        const [rawSettings, rawPin] = await Promise.all([
          AsyncStorage.getItem(SETTINGS_KEY),
          AsyncStorage.getItem(PIN_KEY),
        ]);
        if (rawSettings) setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(rawSettings) });
        if (rawPin) {
          setAppLockPinState(rawPin);
        }
      } catch {}
    })();
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (nextState) => {
      const wasActive = appStateRef.current === "active";
      const isBackground = nextState === "background" || nextState === "inactive";
      if (wasActive && isBackground && settings.appLockEnabled && appLockPin) {
        setRequiresUnlock(true);
      }
      appStateRef.current = nextState;
    });
    return () => sub.remove();
  }, [settings.appLockEnabled, appLockPin]);

  const updateSettings = useCallback(async (patch: Partial<AppSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const setAppLockPin = useCallback(async (pin: string | null) => {
    setAppLockPinState(pin);
    if (pin) {
      await AsyncStorage.setItem(PIN_KEY, pin);
    } else {
      await AsyncStorage.removeItem(PIN_KEY);
    }
  }, []);

  const unlock = useCallback(
    (pin: string): boolean => {
      if (pin === appLockPin) {
        setRequiresUnlock(false);
        return true;
      }
      return false;
    },
    [appLockPin]
  );

  const unlockBiometric = useCallback(async (): Promise<boolean> => {
    if (Platform.OS === "web") return false;
    try {
      const LocalAuth = await import("expo-local-authentication");
      const enrolled = await LocalAuth.isEnrolledAsync();
      if (!enrolled) return false;
      const result = await LocalAuth.authenticateAsync({
        promptMessage: "Unlock Photos",
        fallbackLabel: "Use PIN",
        cancelLabel: "Cancel",
      });
      if (result.success) {
        setRequiresUnlock(false);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, []);

  const lock = useCallback(() => {
    if (settings.appLockEnabled && appLockPin) {
      setRequiresUnlock(true);
    }
  }, [settings.appLockEnabled, appLockPin]);

  return (
    <SettingsContext.Provider
      value={{ settings, updateSettings, appLockPin, setAppLockPin, requiresUnlock, unlock, unlockBiometric, lock }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used inside SettingsProvider");
  return ctx;
}
