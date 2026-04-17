export interface NavigationIntent {
  patterns: Record<string, string[]>;
  route: string;
}

export const navigationIntents: Record<string, NavigationIntent> = {
  dashboard: {
    patterns: {
      ru: ["главная", "домой", "на главную", "дашборд"],
      ky: ["башкы бет", "үйгө", "башкы"],
      en: ["home", "dashboard", "main page", "main"],
    },
    route: "/portal/dashboard",
  },
  treatment: {
    patterns: {
      ru: ["лечение", "мое лечение", "план лечения", "лекарства"],
      ky: ["дарылоо", "дарылоо планы", "дары"],
      en: ["treatment", "my treatment", "medications"],
    },
    route: "/portal/treatment",
  },
  schedule: {
    patterns: {
      ru: ["расписание", "календарь", "приёмы", "приемы"],
      ky: ["расписание", "календарь", "кабыл алуу"],
      en: ["schedule", "calendar", "appointments"],
    },
    route: "/portal/schedule",
  },
  medicalCard: {
    patterns: {
      ru: ["медицинская карта", "мед карта", "медкарта", "карта"],
      ky: ["медициналык карта", "мед карта"],
      en: ["medical card", "med card", "health record"],
    },
    route: "/portal/medical-card",
  },
  results: {
    patterns: {
      ru: ["анализы", "результаты", "мои анализы", "лаборатория"],
      ky: ["анализдер", "жыйынтыктар", "лаборатория"],
      en: ["results", "lab results", "tests", "my results"],
    },
    route: "/portal/results",
  },
  billing: {
    patterns: {
      ru: ["счета", "оплата", "биллинг", "мои счета"],
      ky: ["эсептер", "төлөм", "төлөө"],
      en: ["billing", "invoices", "payments", "my bills"],
    },
    route: "/portal/billing",
  },
  exercises: {
    patterns: {
      ru: ["упражнения", "мои упражнения", "тренировки", "зарядка"],
      ky: ["көнүгүүлөр", "машыгуулар"],
      en: ["exercises", "my exercises", "workouts"],
    },
    route: "/portal/exercises",
  },
  appointments: {
    patterns: {
      ru: ["записи", "записаться", "запись к врачу", "записаться к врачу"],
      ky: ["жазылуу", "врачка жазылуу"],
      en: ["book", "book appointment", "make appointment"],
    },
    route: "/portal/appointments",
  },
  history: {
    patterns: {
      ru: ["история", "история визитов", "визиты", "прошлые приёмы"],
      ky: ["тарых", "визиттер", "өткөн кабыл алуулар"],
      en: ["history", "visit history", "past visits"],
    },
    route: "/portal/history",
  },
  messages: {
    patterns: {
      ru: ["сообщения", "мои сообщения", "чат", "написать врачу"],
      ky: ["билдирүүлөр", "кабарлар", "врачка жазуу"],
      en: ["messages", "my messages", "chat", "write to doctor"],
    },
    route: "/portal/messages",
  },
  recovery: {
    patterns: {
      ru: ["динамика", "восстановление", "прогресс", "моя динамика"],
      ky: ["динамика", "калыбына келтирүү", "прогресс"],
      en: ["recovery", "dynamics", "progress", "my recovery"],
    },
    route: "/portal/recovery",
  },
  profile: {
    patterns: {
      ru: ["профиль", "мой профиль", "настройки", "мои данные"],
      ky: ["профиль", "жөндөөлөр", "маалыматтар"],
      en: ["profile", "my profile", "settings", "my data"],
    },
    route: "/portal/profile",
  },
};
