export const LANGUAGES = ['bs', 'en', 'de'] as const
export type Language = (typeof LANGUAGES)[number]

/** Where the language picked in the app is kept (i18next's own key). */
export const LANGUAGE_KEY = 'i18nextLng'

/**
 * The language the app opens in: the one chosen before, else Bosnian. Not the browser's:
 * on a new address (app.mydentflow.com) an English browser opened a Bosnian clinic's app in
 * English (user request 2026-11-13).
 */
export function initialLanguage(): Language {
  const chosen = localStorage.getItem(LANGUAGE_KEY)?.slice(0, 2)
  return (LANGUAGES as readonly string[]).includes(chosen ?? '') ? (chosen as Language) : 'bs'
}
