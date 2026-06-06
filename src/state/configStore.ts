import { create } from "zustand";

/** Kode bahasa Deepgram (BCP-47, mis. "multi" | "id" | "en-US"). Daftar opsi
 *  yang ditampilkan ada di `lib/languages.ts`. */
export type LanguageCode = string;

interface ConfigStore {
  language: LanguageCode;
  /** true = system audio only (cleaner for videos); false = system + mic (meetings). */
  systemOnly: boolean;
  setLanguage: (l: LanguageCode) => void;
  setSystemOnly: (s: boolean) => void;
}

export const useConfigStore = create<ConfigStore>((set) => ({
  language: "multi",
  systemOnly: false,
  setLanguage: (language) => set({ language }),
  setSystemOnly: (systemOnly) => set({ systemOnly }),
}));
