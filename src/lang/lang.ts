import i18next from "i18next";
import Users from "../table/users";

import en from "../locales/en.json";
import it from "../locales/it.json";
import tr from "../locales/tr.json";
import fr from "../locales/fr.json";
import es from "../locales/es.json";

async function initLanguages(): Promise<void> {
  await i18next.init({
    fallbackLng: "en",
    debug: false,
    resources: {
      en: { translation: en },
      it: { translation: it },
      es: { translation: es },
      fr: { translation: fr },
      tr: { translation: tr },
    },
  });
}

async function getLanguage(id: string): Promise<string> {
  const users = new Users(process.env.DYNAMODB_TABLE!);
  const LANGUAGE: string = await users.getCurrentLanguage(id);
  return LANGUAGE;
}

function getT(language: string): any {
  const systemLocale = Intl.DateTimeFormat().resolvedOptions().locale;
  return i18next.getFixedT(language || systemLocale);
}

export { getT, initLanguages, getLanguage };
