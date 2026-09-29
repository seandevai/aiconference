// Lingue dei sottotitoli (slice 6). Si allarga quando il provider di traduzione è scelto.
export const SUPPORTED_LANGUAGES = ['it', 'en', 'es', 'fr', 'de'] as const;

export type Language = (typeof SUPPORTED_LANGUAGES)[number];

export const LANGUAGE_LABELS: Record<Language, string> = {
  it: 'Italiano',
  en: 'English',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
};

export function isLanguage(value: string): value is Language {
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}
