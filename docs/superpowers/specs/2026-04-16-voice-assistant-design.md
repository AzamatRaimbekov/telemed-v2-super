# Voice Assistant — Голосовое управление портала пациента

## Обзор

Модуль голосового управления для портала пациента MedCore KG. Два уровня работы:
1. **Базовый** — навигация по командам через паттерн-матчинг, работает всегда без AI/сети
2. **AI-ассистент** — полный диалоговый режим через Gemini Flash / DeepSeek, зависит от токенов

Целевая аудитория: все пациенты как удобная альтернатива навигации.

## Требования

- **Языки**: русский, кыргызский, английский
- **Активация**: плавающая кнопка микрофона + wake word "Эй, Медкор"
- **UI**: минимальный индикатор (пульсирующая кнопка + всплывающий текст) + контекстные подсказки-чипы
- **STT**: Web Speech API (основной) → self-hosted Whisper (fallback)
- **AI**: Gemini Flash (бесплатный) → DeepSeek (fallback) → паттерн-матчинг (без AI)
- **TTS**: опционально, настраивается в профиле пациента
- **Данные**: полный доступ к данным авторизованного пациента
- **Действия**: выполнение с подтверждением (запись к врачу, оплата и т.д.)
- **Настройки**: всё выключено по умолчанию, пациент включает сам

---

## 1. Архитектура

```
┌─────────────────────────────────────────────────┐
│                   Frontend                       │
│                                                  │
│  VoiceAssistantProvider (React Context)          │
│  ┌──────────────────────────────────────────┐   │
│  │         VoiceAssistantCore               │   │
│  │                                          │   │
│  │  ┌─────────┐   ┌──────────────────┐     │   │
│  │  │ Wake    │──▶│ STT Engine       │     │   │
│  │  │ Word    │   │ (WebSpeech→      │     │   │
│  │  │ Detector│   │  Whisper fallback)│     │   │
│  │  └─────────┘   └───────┬──────────┘     │   │
│  │                        │ текст           │   │
│  │                        ▼                 │   │
│  │              ┌─────────────────┐         │   │
│  │              │ Intent Router   │         │   │
│  │              │ (local patterns)│         │   │
│  │              └──┬──────────┬───┘         │   │
│  │        matched  │          │ not matched │   │
│  │                 ▼          ▼              │   │
│  │  ┌──────────────┐  ┌─────────────┐      │   │
│  │  │ Navigation   │  │ AI Request  │      │   │
│  │  │ Handler      │  │ (→ backend) │      │   │
│  │  └──────────────┘  └─────────────┘      │   │
│  └──────────────────────────────────────────┘   │
│                                                  │
│  UI: FloatingMic + SpeechBubble + HintChips     │
└─────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────┐
│                   Backend                        │
│                                                  │
│  POST /api/v1/portal/voice/process              │
│  POST /api/v1/portal/voice/confirm-action       │
│  POST /api/v1/portal/voice/whisper              │
│  GET  /api/v1/portal/voice/hints/{page}         │
│                                                  │
│  VoiceAssistantService                          │
│  ┌──────────────────────────────────────────┐   │
│  │ - Gemini Flash (primary AI)              │   │
│  │ - DeepSeek (fallback AI)                 │   │
│  │ - Patient context injection              │   │
│  │ - Action executor (с подтверждением)     │   │
│  │ - Whisper STT (fallback)                 │   │
│  └──────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

**Поток данных:**
1. Пациент говорит (кнопка или "Эй, Медкор")
2. Web Speech API распознаёт → текст
3. Intent Router проверяет паттерны навигации (локально, без сети)
4. Если совпало → навигация немедленно
5. Если не совпало → запрос на бэкенд → Gemini/DeepSeek с контекстом пациента
6. Ответ показывается в SpeechBubble (+ озвучивается если TTS включён)

---

## 2. Frontend — структура файлов

```
frontend/src/features/voice-assistant/
├── components/
│   ├── VoiceAssistantProvider.tsx   # React Context, оборачивает портал
│   ├── FloatingMic.tsx              # Плавающая кнопка микрофона
│   ├── SpeechBubble.tsx             # Всплывающий текст + ответ AI
│   ├── HintChips.tsx                # Контекстные подсказки-чипы
│   └── ConfirmationDialog.tsx       # Подтверждение действий
├── hooks/
│   ├── useVoiceRecognition.ts       # Web Speech API + Whisper fallback
│   ├── useWakeWord.ts               # Детектор "Эй, Медкор"
│   ├── useIntentRouter.ts           # Локальный паттерн-матчинг
│   ├── useAIAssistant.ts            # Запросы к бэкенду для AI
│   └── useTextToSpeech.ts           # TTS озвучка
├── intents/
│   ├── navigation.ts                # Маппинг команд → роутов (3 языка)
│   ├── actions.ts                   # Маппинг команд → действий
│   └── hints.ts                     # Контекстные подсказки по страницам
├── types.ts
├── constants.ts
└── index.ts
```

### Компоненты

**VoiceAssistantProvider** — оборачивает `_portal.tsx`, предоставляет контекст:
- `isListening` — микрофон активен
- `transcript` — текущий распознанный текст
- `aiResponse` — ответ ассистента
- `language` — текущий язык распознавания
- `voiceEnabled` — вкл/выкл из профиля

**FloatingMic** — круглая кнопка (56px), позиция `fixed bottom-6 right-6`:
- Idle: иконка микрофона
- Listening: пульсирующая анимация (Framer Motion)
- Processing: спиннер
- Error: красная подсветка

**HintChips** — появляются над кнопкой микрофона при активации:
- Зависят от текущего роута
- Кликабельны — клик = отправка команды как текст
- Максимум 3 чипа одновременно
- Первые 2 — навигационные, третий — контекстный AI-вопрос
- На мобильных — горизонтальный скролл

---

## 3. Backend — сервисы и API

```
backend/app/
├── api/v1/routes/
│   └── portal_voice.py
├── services/
│   └── voice_assistant/
│       ├── __init__.py
│       ├── service.py                # VoiceAssistantService
│       ├── ai_providers/
│       │   ├── base.py               # Абстрактный AIProvider
│       │   ├── gemini_provider.py    # Gemini Flash
│       │   └── deepseek_provider.py  # DeepSeek fallback
│       ├── intent_parser.py          # Серверный парсер интентов
│       ├── context_builder.py        # Сборка контекста пациента
│       ├── action_executor.py        # Выполнение действий
│       └── whisper_stt.py            # Self-hosted Whisper STT
├── schemas/
│   └── voice.py                      # Pydantic схемы
```

### API эндпоинты

```
POST /api/v1/portal/voice/process
  Body: { text: string, language: "ru"|"ky"|"en", page: string }
  Response: { type: "answer"|"action_confirm"|"navigate",
              text: string, action?: Action, route?: string }

POST /api/v1/portal/voice/confirm-action
  Body: { action_id: string, confirmed: boolean }
  Response: { success: boolean, message: string }

POST /api/v1/portal/voice/whisper
  Body: FormData (audio blob)
  Response: { text: string, language: string }

GET /api/v1/portal/voice/hints/{page}
  Response: { hints: string[] }
```

### VoiceAssistantService

1. Получает текст + язык + текущую страницу
2. `context_builder` собирает контекст пациента (ближайшие приёмы, последние анализы, активное лечение)
3. Формирует system prompt для AI с контекстом + function calling
4. Отправляет в Gemini → если ошибка/лимит → DeepSeek → если ошибка → `{ fallback: true }`
5. Если AI вернул действие → создаёт pending action → отправляет `action_confirm`
6. После подтверждения → `action_executor` выполняет через существующие сервисы

### AI Provider fallback chain

```
Gemini Flash (бесплатный)
  └─ ошибка/лимит → DeepSeek (бесплатный)
      └─ ошибка/лимит → { fallback: true } → фронт на паттерн-матчинг
```

---

## 4. Wake Word Detection

**Подход:** Web Speech API в режиме `continuous: true` с фильтрацией на ключевую фразу.

**Варианты распознавания:**
- Русский: "эй медкор", "привет медкор", "медкор"
- Кыргызский: "эй медкор", "медкор"
- Английский: "hey medcore", "medcore"

**Поведение:**
- При совпадении → звуковой сигнал + вибрация → режим активного слушания
- Активное слушание 10 сек без речи → возврат в wake word режим
- Работает только когда вкладка активна (`document.visibilityState`)
- Автоматическая пауза при потере фокуса
- Настройка вкл/выкл отдельно от кнопки микрофона

**Ограничения:**
- Continuous mode потребляет батарею на мобильных
- Safari — ограниченная поддержка → только кнопка микрофона

---

## 5. Intent Router — локальный паттерн-матчинг

### Навигационные команды (3 языка, 12 страниц)

```typescript
const navigationIntents = {
  dashboard: {
    patterns: {
      ru: ["главная", "домой", "на главную", "дашборд"],
      ky: ["башкы бет", "үйгө"],
      en: ["home", "dashboard", "main page"]
    },
    route: "/portal/dashboard"
  },
  treatment: {
    patterns: {
      ru: ["лечение", "мое лечение", "план лечения"],
      ky: ["дарылоо", "дарылоо планы"],
      en: ["treatment", "my treatment"]
    },
    route: "/portal/treatment"
  },
  schedule: {
    patterns: {
      ru: ["расписание", "календарь", "приёмы"],
      ky: ["расписание", "календарь"],
      en: ["schedule", "calendar", "appointments"]
    },
    route: "/portal/schedule"
  },
  // ... аналогично для всех 12 страниц
}
```

### Алгоритм матчинга

1. Нормализация: lowercase, убрать пунктуацию
2. Точное совпадение с паттернами
3. Fuzzy match (Levenshtein distance ≤ 2) — для ошибок распознавания
4. Не совпало → отправка на бэкенд в AI

### Системные команды

```
"назад" / "артка" / "back" → history.back()
"обновить" / "жаңылоо" / "refresh" → window.location.reload()
"выйти" / "чыгуу" / "logout" → logout()
"помощь" / "жардам" / "help" → показать все команды
```

Fuzzy matching — простая функция Levenshtein (~20 строк), без внешних библиотек.

---

## 6. Контекстные подсказки (HintChips)

| Страница | Подсказки |
|----------|-----------|
| Dashboard | "Расписание", "Мои анализы", "Ближайший приём" |
| Treatment | "План лечения", "Мои лекарства", "Следующая процедура" |
| Schedule | "Записаться к врачу", "Ближайший приём", "Отменить запись" |
| Medical Card | "Мои диагнозы", "Аллергии", "История болезни" |
| Results | "Последние анализы", "Результаты крови", "Скачать результат" |
| Billing | "Неоплаченные счета", "Оплатить", "История платежей" |
| Exercises | "Мои упражнения", "Показать видео", "План на сегодня" |
| Appointments | "Записаться", "Свободные слоты", "К терапевту" |
| History | "Последний визит", "Все визиты", "За этот месяц" |
| Messages | "Новые сообщения", "Написать врачу", "Непрочитанные" |
| Recovery | "Моя динамика", "Прогресс", "График восстановления" |
| Profile | "Мои данные", "Сменить язык", "Настройки голоса" |

---

## 7. AI-ассистент

### System prompt

```
Ты — голосовой ассистент медицинского портала MedCore KG.
Пациент: {patient_name}, ID: {patient_id}
Текущая страница: {current_page}
Язык: {language}

Контекст пациента:
- Ближайшие приёмы: {upcoming_appointments}
- Активное лечение: {active_treatment}
- Последние анализы: {recent_results}
- Неоплаченные счета: {unpaid_bills}

Правила:
1. Отвечай кратко, 1-3 предложения
2. Отвечай на том же языке, на котором спросили
3. Ты НЕ врач — не ставь диагнозы, не давай медицинские рекомендации
4. Если вопрос выходит за рамки портала — вежливо откажи
5. Для действий используй function calling
```

### Function calling

```
navigate(route: string)           — перейти на страницу
book_appointment(doctor_id, date, time)  — записаться к врачу
cancel_appointment(appointment_id)       — отменить запись
pay_bill(bill_id)                        — инициировать оплату
send_message(doctor_id, text)            — отправить сообщение врачу
```

Все функции кроме `navigate` требуют подтверждения через ConfirmationDialog.

### Пример диалога

```
Пациент: "Когда мой следующий приём?"
AI: "Ваш ближайший приём — 18 апреля, четверг, 10:00, к терапевту Иванову А.С."

Пациент: "Запиши меня к хирургу на пятницу"
AI: → function call: book_appointment(...)
   → ConfirmationDialog: "Записать вас к хирургу Петрову на пятницу, 19 апреля, 14:00?"
   → Пациент: "Да"
   → Выполнение
```

Context builder подгружает только релевантные данные — экономия токенов.

---

## 8. Настройки в профиле пациента

Новая секция на странице `/portal/profile`:

| Настройка | Тип | По умолчанию |
|-----------|-----|-------------|
| Голосовое управление | Toggle | Выкл |
| Активация голосом ("Эй, Медкор") | Toggle | Выкл |
| Озвучка ответов (TTS) | Toggle | Выкл |
| Язык распознавания | Select: ru/ky/en | Русский |
| Скорость озвучки | Slider 0.5-2.0 | 1.0 |
| Размер подсказок | Slider S/M/L | M |

**Хранение:**
- Zustand `portal-auth-store` + `localStorage` для мгновенного доступа
- Синхронизация с бэкендом: поле `voice_settings JSONB` в таблице `patients`
- API: `GET/PUT /api/v1/portal/voice/settings` — чтение и сохранение настроек
- При логине подгружается с сервера, при изменении — сохраняется на сервер + localStorage

---

## 9. Обработка ошибок

### STT ошибки
- Браузер не поддерживает Web Speech API → тултип "Используйте Chrome или Edge"
- Микрофон не разрешён → "Разрешите доступ к микрофону"
- Web Speech API не распознал → отправка на Whisper → если не смог → "Попробуйте ещё раз"

### AI fallback chain
```
Gemini Flash (timeout 5s)
  → DeepSeek (timeout 5s)
    → { fallback: true }
      → "AI-ассистент временно недоступен. Навигация голосом доступна."
```

### Сетевые ошибки
- Нет интернета → только локальный паттерн-матчинг
- Таймаут бэкенда → 1 повтор → fallback

### UX edge cases
- Молчание 10 сек → автоматический возврат в idle
- Confidence < 0.6 → игнорировать (фоновый шум)
- Два запроса одновременно → отменить предыдущий
- Речь во время TTS → остановить TTS, начать слушать

### Безопасность
- Все AI-запросы через бэкенд (ключи API не на фронте)
- Контекст пациента инжектится на бэкенде по JWT-токену
- Rate limiting: 30 AI-запросов в минуту на пациента
- Аудио Whisper не сохраняется — обрабатывается и удаляется
