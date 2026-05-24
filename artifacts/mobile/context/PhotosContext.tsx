import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

export interface CurvePoint { x: number; y: number; }

export interface HslChannel { h: number; s: number; l: number; }

export interface HslAdjustments {
  red: HslChannel; orange: HslChannel; yellow: HslChannel; green: HslChannel;
  aqua: HslChannel; blue: HslChannel; purple: HslChannel; magenta: HslChannel;
}

export interface CurveSet {
  rgb: CurvePoint[]; r: CurvePoint[]; g: CurvePoint[]; b: CurvePoint[];
}

export const DEFAULT_HSL: HslAdjustments = {
  red: { h: 0, s: 0, l: 0 }, orange: { h: 0, s: 0, l: 0 },
  yellow: { h: 0, s: 0, l: 0 }, green: { h: 0, s: 0, l: 0 },
  aqua: { h: 0, s: 0, l: 0 }, blue: { h: 0, s: 0, l: 0 },
  purple: { h: 0, s: 0, l: 0 }, magenta: { h: 0, s: 0, l: 0 },
};

export const DEFAULT_CURVES: CurveSet = {
  rgb: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
  r: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
  g: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
  b: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
};

export interface PhotoAdjustments {
  brightness: number; contrast: number; highlights: number; shadows: number;
  whites: number; blacks: number; saturation: number; vibrance: number;
  warmth: number; tint: number; sharpness: number; clarity: number;
  dehaze: number; noiseReduction: number; vignette: number; grain: number;
  rotation: 0 | 90 | 180 | 270; flipH: boolean; flipV: boolean;
  exposure: number; hue: number; texture: number; colorNoise: number;
  sharpeningRadius: number; sharpeningMasking: number; toneMapping: number;
  freeRotate: number;
  splitHighlightsHue: number; splitHighlightsSat: number;
  splitShadowsHue: number; splitShadowsSat: number;
  levelsBlack: number; levelsMidtone: number; levelsWhite: number;
  levelsOutBlack: number; levelsOutWhite: number;
  hsl: HslAdjustments;
  curves: CurveSet;
  cropAspect: string;
  // Color Grading Wheels
  gradingShadowsHue: number; gradingShadowsSat: number; gradingShadowsLum: number;
  gradingMidtonesHue: number; gradingMidtonesSat: number; gradingMidtonesLum: number;
  gradingHighlightsHue: number; gradingHighlightsSat: number; gradingHighlightsLum: number;
  // LUT
  lutName: string;
}

export const DEFAULT_ADJUSTMENTS: PhotoAdjustments = {
  brightness: 0, contrast: 0, highlights: 0, shadows: 0,
  whites: 0, blacks: 0, saturation: 0, vibrance: 0,
  warmth: 0, tint: 0, sharpness: 0, clarity: 0,
  dehaze: 0, noiseReduction: 0, vignette: 0, grain: 0,
  rotation: 0, flipH: false, flipV: false,
  exposure: 0, hue: 0, texture: 0, colorNoise: 0,
  sharpeningRadius: 25, sharpeningMasking: 0, toneMapping: 0, freeRotate: 0,
  splitHighlightsHue: 0, splitHighlightsSat: 0,
  splitShadowsHue: 0, splitShadowsSat: 0,
  levelsBlack: 0, levelsMidtone: 0, levelsWhite: 0,
  levelsOutBlack: 0, levelsOutWhite: 0,
  hsl: DEFAULT_HSL,
  curves: DEFAULT_CURVES,
  cropAspect: "free",
  gradingShadowsHue: 0, gradingShadowsSat: 0, gradingShadowsLum: 0,
  gradingMidtonesHue: 0, gradingMidtonesSat: 0, gradingMidtonesLum: 0,
  gradingHighlightsHue: 0, gradingHighlightsSat: 0, gradingHighlightsLum: 0,
  lutName: "none",
};

function migrateAdjustments(raw: Partial<PhotoAdjustments>): PhotoAdjustments {
  return {
    ...DEFAULT_ADJUSTMENTS,
    ...raw,
    hsl: raw.hsl ? { ...DEFAULT_ADJUSTMENTS.hsl, ...raw.hsl } : DEFAULT_ADJUSTMENTS.hsl,
    curves: raw.curves ? { ...DEFAULT_ADJUSTMENTS.curves, ...raw.curves } : DEFAULT_ADJUSTMENTS.curves,
  };
}

export interface Photo {
  id: string; uri: string; timestamp: number;
  width?: number; height?: number;
  favorited?: boolean; adjustments?: PhotoAdjustments;
  rating?: number;
  colorLabel?: string | null;
  tags?: string[];
}

export type PhotoChanges = Partial<Pick<Photo, "adjustments" | "rating" | "colorLabel" | "tags" | "favorited">>;

interface PhotosContextValue {
  photos: Photo[];
  addPhoto: (uri: string, width?: number, height?: number) => Promise<void>;
  deletePhoto: (id: string) => Promise<void>;
  deletePhotos: (ids: string[]) => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;
  updatePhoto: (id: string, changes: PhotoChanges) => Promise<void>;
  loading: boolean;
}

const PhotosContext = createContext<PhotosContextValue | null>(null);

const STORAGE_KEY = "@photos_app_v1";
const SEEDED_KEY = "@photos_app_seeded_v1";

const now = Date.now();
const DAY = 86_400_000;

const SEED_PHOTOS: Photo[] = [
  { id: "seed_1", uri: "https://picsum.photos/id/10/900/1200",  timestamp: now - 2 * DAY },
  { id: "seed_2", uri: "https://picsum.photos/id/15/900/1100",  timestamp: now - 3 * DAY },
  { id: "seed_3", uri: "https://picsum.photos/id/24/900/1200",  timestamp: now - 5 * DAY },
  { id: "seed_4", uri: "https://picsum.photos/id/37/900/1100",  timestamp: now - 8 * DAY },
  { id: "seed_5", uri: "https://picsum.photos/id/65/900/1200",  timestamp: now - 11 * DAY },
  { id: "seed_6", uri: "https://picsum.photos/id/82/900/1100",  timestamp: now - 14 * DAY },
  { id: "seed_7", uri: "https://picsum.photos/id/91/900/1200",  timestamp: now - 18 * DAY },
  { id: "seed_8", uri: "https://picsum.photos/id/103/900/1100", timestamp: now - 22 * DAY },
  { id: "seed_9", uri: "https://picsum.photos/id/119/900/1200", timestamp: now - 27 * DAY },
];

export function PhotosProvider({ children }: { children: React.ReactNode }) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      try {
        const [raw, seeded] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY),
          AsyncStorage.getItem(SEEDED_KEY),
        ]);
        let initial: Photo[] = raw ? JSON.parse(raw) : [];
        initial = initial.map((p) => ({
          ...p,
          adjustments: p.adjustments ? migrateAdjustments(p.adjustments) : undefined,
        }));
        if (!seeded) {
          initial = [...SEED_PHOTOS, ...initial];
          await Promise.all([
            AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(initial)),
            AsyncStorage.setItem(SEEDED_KEY, "1"),
          ]);
        }
        setPhotos(initial);
      } catch {
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  const persist = useCallback(async (next: Photo[]) => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  const addPhoto = useCallback(async (uri: string, width?: number, height?: number) => {
    const photo: Photo = {
      id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
      uri, timestamp: Date.now(), width, height,
    };
    setPhotos((prev) => { const next = [photo, ...prev]; persist(next); return next; });
  }, [persist]);

  const deletePhoto = useCallback(async (id: string) => {
    setPhotos((prev) => { const next = prev.filter((p) => p.id !== id); persist(next); return next; });
  }, [persist]);

  const deletePhotos = useCallback(async (ids: string[]) => {
    const idSet = new Set(ids);
    setPhotos((prev) => { const next = prev.filter((p) => !idSet.has(p.id)); persist(next); return next; });
  }, [persist]);

  const toggleFavorite = useCallback(async (id: string) => {
    setPhotos((prev) => {
      const next = prev.map((p) => p.id === id ? { ...p, favorited: !p.favorited } : p);
      persist(next); return next;
    });
  }, [persist]);

  const updatePhoto = useCallback(async (id: string, changes: PhotoChanges) => {
    setPhotos((prev) => {
      const next = prev.map((p) => (p.id === id ? { ...p, ...changes } : p));
      persist(next); return next;
    });
  }, [persist]);

  return (
    <PhotosContext.Provider value={{ photos, addPhoto, deletePhoto, deletePhotos, toggleFavorite, updatePhoto, loading }}>
      {children}
    </PhotosContext.Provider>
  );
}

export function usePhotos(): PhotosContextValue {
  const ctx = useContext(PhotosContext);
  if (!ctx) throw new Error("usePhotos must be used inside PhotosProvider");
  return ctx;
}
