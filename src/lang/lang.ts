import i18next from 'i18next'
import DynamoDbConnector from "../connector/dynamoDbConnector";

import en from '../locales/en.json'
import it from '../locales/it.json'
import tr from '../locales/tr.json'

async function initLanguages(): Promise<void> {
  await i18next.init({
    fallbackLng: 'en',
    debug: false,
    resources: {
      en: { translation: en },
      it: { translation: it },
      tr: { translation: tr },
    }
  })
}

async function getLanguage(id: string): Promise<string> {
  const dbConnector = new DynamoDbConnector(process.env.DYNAMODB_TABLE!);
  const LANGUAGE: string = await dbConnector.getCurrentLanguage(id);
  return LANGUAGE
}

function getT(language: string): any {
  const systemLocale = Intl.DateTimeFormat().resolvedOptions().locale
  return i18next.getFixedT(language || systemLocale)
}

export { getT, initLanguages, getLanguage }
