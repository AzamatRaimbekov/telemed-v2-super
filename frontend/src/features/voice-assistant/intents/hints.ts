import type { VoiceLanguage } from "../types";

const PAGE_HINTS: Record<string, Record<VoiceLanguage, string[]>> = {
  dashboard: {
    ru: ["Расписание", "Мои анализы", "Ближайший приём"],
    ky: ["Расписание", "Анализдар", "Жакынкы кабыл алуу"],
    en: ["Schedule", "My results", "Next appointment"],
  },
  treatment: {
    ru: ["План лечения", "Мои лекарства", "Следующая процедура"],
    ky: ["Дарылоо планы", "Дарылар", "Кийинки процедура"],
    en: ["Treatment plan", "My medications", "Next procedure"],
  },
  schedule: {
    ru: ["Записаться к врачу", "Ближайший приём", "Отменить запись"],
    ky: ["Врачка жазылуу", "Жакынкы кабыл алуу", "Жазууну жокко чыгаруу"],
    en: ["Book appointment", "Next appointment", "Cancel booking"],
  },
  "medical-card": {
    ru: ["Мои диагнозы", "Аллергии", "История болезни"],
    ky: ["Диагноздор", "Аллергиялар", "Оору тарыхы"],
    en: ["My diagnoses", "Allergies", "Medical history"],
  },
  results: {
    ru: ["Последние анализы", "Результаты крови", "Скачать результат"],
    ky: ["Акыркы анализдер", "Кан анализи", "Жүктөп алуу"],
    en: ["Latest results", "Blood results", "Download result"],
  },
  billing: {
    ru: ["Неоплаченные счета", "Оплатить", "История платежей"],
    ky: ["Төлөнбөгөн эсептер", "Төлөө", "Төлөм тарыхы"],
    en: ["Unpaid bills", "Pay", "Payment history"],
  },
  exercises: {
    ru: ["Мои упражнения", "Показать видео", "План на сегодня"],
    ky: ["Көнүгүүлөр", "Видео көрсөтүү", "Бүгүнкү план"],
    en: ["My exercises", "Show video", "Today's plan"],
  },
  appointments: {
    ru: ["Записаться", "Свободные слоты", "К терапевту"],
    ky: ["Жазылуу", "Бош убакыттар", "Терапевтке"],
    en: ["Book", "Available slots", "To therapist"],
  },
  history: {
    ru: ["Последний визит", "Все визиты", "За этот месяц"],
    ky: ["Акыркы визит", "Бардык визиттер", "Бул ай үчүн"],
    en: ["Last visit", "All visits", "This month"],
  },
  messages: {
    ru: ["Новые сообщения", "Написать врачу", "Непрочитанные"],
    ky: ["Жаңы билдирүүлөр", "Врачка жазуу", "Окулбаган"],
    en: ["New messages", "Write to doctor", "Unread"],
  },
  recovery: {
    ru: ["Моя динамика", "Прогресс", "График восстановления"],
    ky: ["Динамикам", "Прогресс", "Калыбына келтирүү графиги"],
    en: ["My dynamics", "Progress", "Recovery chart"],
  },
  profile: {
    ru: ["Мои данные", "Сменить язык", "Настройки голоса"],
    ky: ["Маалыматтар", "Тилди өзгөртүү", "Үн жөндөөлөрү"],
    en: ["My data", "Change language", "Voice settings"],
  },
};

export function getHintsForPage(page: string, language: VoiceLanguage): string[] {
  const pageKey = page.includes("/") ? page.split("/").pop() || "dashboard" : page;
  const hints = PAGE_HINTS[pageKey] || PAGE_HINTS.dashboard;
  return hints[language] || hints.ru;
}
