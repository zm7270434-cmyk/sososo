// Bahasa yang didukung Deepgram Nova-3 (live/streaming). Semua opsi memakai model
// Nova-3 di backend. `multi` = auto-deteksi multilingual (code-switching). Daftar
// mengacu pada Models & Languages Overview Deepgram, termasuk varian regional.
// Sumber: https://developers.deepgram.com/docs/models-languages-overview

export interface LanguageOption {
  /** Kode BCP-47 yang dikirim ke Deepgram (mis. "id", "en-US", "multi"). */
  code: string;
  /** Label untuk UI (Bahasa Indonesia). */
  label: string;
}

// `multi` lalu `id` disematkan di atas (kasus pakai utama aplikasi ini), sisanya
// dikelompokkan per bahasa dengan varian regional berdekatan.
export const LANGUAGES: LanguageOption[] = [
  { code: "multi", label: "Auto-deteksi (multilingual)" },
  { code: "id", label: "Indonesia" },

  // Arab + varian regional
  { code: "ar", label: "Arab" },
  { code: "ar-SA", label: "Arab (Arab Saudi)" },
  { code: "ar-AE", label: "Arab (UEA)" },
  { code: "ar-EG", label: "Arab (Mesir)" },
  { code: "ar-QA", label: "Arab (Qatar)" },
  { code: "ar-KW", label: "Arab (Kuwait)" },
  { code: "ar-SY", label: "Arab (Suriah)" },
  { code: "ar-LB", label: "Arab (Lebanon)" },
  { code: "ar-PS", label: "Arab (Palestina)" },
  { code: "ar-JO", label: "Arab (Yordania)" },
  { code: "ar-SD", label: "Arab (Sudan)" },
  { code: "ar-TD", label: "Arab (Chad)" },
  { code: "ar-MA", label: "Arab (Maroko)" },
  { code: "ar-DZ", label: "Arab (Aljazair)" },
  { code: "ar-TN", label: "Arab (Tunisia)" },
  { code: "ar-IQ", label: "Arab (Irak)" },
  { code: "ar-IR", label: "Arab (Iran)" },

  { code: "nl", label: "Belanda" },
  { code: "nl-BE", label: "Belanda (Belgia) / Flemish" },
  { code: "be", label: "Belarus" },
  { code: "bn", label: "Bengali" },
  { code: "bs", label: "Bosnia" },
  { code: "bg", label: "Bulgaria" },
  { code: "cs", label: "Ceko" },
  { code: "da", label: "Denmark" },
  { code: "et", label: "Estonia" },
  { code: "fi", label: "Finlandia" },
  { code: "gu", label: "Gujarat" },
  { code: "hi", label: "Hindi" },
  { code: "hu", label: "Hungaria" },
  { code: "he", label: "Ibrani" },

  // Inggris + varian regional
  { code: "en", label: "Inggris" },
  { code: "en-US", label: "Inggris (AS)" },
  { code: "en-GB", label: "Inggris (Britania)" },
  { code: "en-AU", label: "Inggris (Australia)" },
  { code: "en-IN", label: "Inggris (India)" },
  { code: "en-NZ", label: "Inggris (Selandia Baru)" },

  { code: "it", label: "Italia" },
  { code: "ja", label: "Jepang" },
  { code: "de", label: "Jerman" },
  { code: "de-CH", label: "Jerman (Swiss)" },
  { code: "kn", label: "Kannada" },
  { code: "zh-HK", label: "Kanton (Hong Kong)" },
  { code: "ca", label: "Katalan" },
  { code: "ko", label: "Korea" },
  { code: "hr", label: "Kroasia" },
  { code: "lv", label: "Latvia" },
  { code: "lt", label: "Lituania" },
  { code: "mk", label: "Makedonia" },

  // Mandarin
  { code: "zh", label: "Mandarin (Tiongkok)" },
  { code: "zh-TW", label: "Mandarin (Tradisional)" },

  { code: "mr", label: "Marathi" },
  { code: "ms", label: "Melayu" },
  { code: "no", label: "Norwegia" },
  { code: "fa", label: "Persia" },
  { code: "pl", label: "Polandia" },

  // Portugis
  { code: "pt", label: "Portugis" },
  { code: "pt-BR", label: "Portugis (Brasil)" },
  { code: "pt-PT", label: "Portugis (Portugal)" },

  // Prancis
  { code: "fr", label: "Prancis" },
  { code: "fr-CA", label: "Prancis (Kanada)" },

  { code: "ro", label: "Rumania" },
  { code: "ru", label: "Rusia" },
  { code: "sr", label: "Serbia" },
  { code: "sk", label: "Slovakia" },
  { code: "sl", label: "Slovenia" },

  // Spanyol
  { code: "es", label: "Spanyol" },
  { code: "es-419", label: "Spanyol (Amerika Latin)" },

  { code: "sv", label: "Swedia" },
  { code: "tl", label: "Tagalog" },
  { code: "ta", label: "Tamil" },
  { code: "te", label: "Telugu" },
  { code: "th", label: "Thai" },
  { code: "tr", label: "Turki" },
  { code: "uk", label: "Ukraina" },
  { code: "ur", label: "Urdu" },
  { code: "vi", label: "Vietnam" },
  { code: "el", label: "Yunani" },
];

/** Cari label tampilan untuk sebuah kode bahasa (fallback ke kode itu sendiri). */
export function languageLabel(code: string): string {
  return LANGUAGES.find((l) => l.code === code)?.label ?? code;
}
