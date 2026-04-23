# MedCore KG — Дизайн-система

Полное описание визуального языка проекта: цвета, типографика, компоненты, отступы, анимации.

---

## Шрифты

### Plus Jakarta Sans (основной)

Подключение: Google Fonts в `index.html` через `<link>` с `media="print" onload="this.media='all'"` для non-blocking загрузки.

```
CSS-переменная: --font-display
Tailwind: font-sans
Стек: 'Plus Jakarta Sans', system-ui, sans-serif
Вес: 200–800 (используются 400, 500, 600, 700, 800)
```

| Применение | Вес | Класс Tailwind |
|-----------|-----|----------------|
| Основной текст | 400 (Regular) | `font-normal` |
| Подписи, метки | 500 (Medium) | `font-medium` |
| Заголовки карточек | 600 (Semibold) | `font-semibold` |
| Заголовки секций | 700 (Bold) | `font-bold` |
| Главные заголовки | 800 (Extrabold) | `font-extrabold` |

### JetBrains Mono (моноширинный)

```
CSS-переменная: --font-mono
Tailwind: font-mono
Стек: 'JetBrains Mono', monospace
Вес: 400, 500
Применение: код, технические данные, ID
```

---

## Цветовая палитра

### Светлая тема (по умолчанию)

#### Основные цвета

| Токен | Hex | Tailwind | Применение |
|-------|-----|----------|-----------|
| `--color-primary` | `#BDEDE0` | `bg-primary` | Мятный — основной акцент, фоны кнопок, бейджи |
| `--color-primary-foreground` | `#1A1A2E` | `text-primary-foreground` | Текст на primary фоне |
| `--color-primary-deep` | `#7ECDB8` | `text-primary-deep` | Глубокий мятный — иконки, акцентный текст |
| `--color-secondary` | `#7E78D2` | `bg-secondary` | Фиолетовый — вторичный акцент, кнопки |
| `--color-secondary-foreground` | `#FFFFFF` | `text-secondary-foreground` | Текст на secondary фоне |
| `--color-secondary-deep` | `#5B54B0` | `text-secondary-deep` | Глубокий фиолетовый — градиенты кнопок |

#### Фоны и поверхности

| Токен | Hex | Tailwind | Применение |
|-------|-----|----------|-----------|
| `--color-background` | `#F6FAF9` | `bg-background` | Фон страницы |
| `--color-surface` | `#FFFFFF` | `bg-surface` | Карточки, модалки |
| `--color-surface-elevated` | `#FFFFFF` | `bg-surface-elevated` | Поднятые элементы |
| `--color-muted` | `#F1F5F9` | `bg-muted` | Приглушённый фон (hover, неактивные табы) |
| `--color-accent` | `#F0F4FF` | `bg-accent` | Акцентный фон (активный nav-item) |

#### Текст

| Токен | Hex | Tailwind | Применение |
|-------|-----|----------|-----------|
| `--color-text-primary` | `#0F172A` | `text-foreground` | Заголовки, основной текст |
| `--color-text-secondary` | `#64748B` | `text-muted-foreground` | Описания, подзаголовки |
| `--color-text-tertiary` | `#94A3B8` | — | Подписи, placeholder, метки полей |

#### Границы и инпуты

| Токен | Hex | Tailwind | Применение |
|-------|-----|----------|-----------|
| `--color-border` | `#E8EDF2` | `border-border` | Границы карточек, разделители |
| `--color-input` | `#E8EDF2` | `border-input` | Границы полей ввода |
| `--color-ring` | `#7E78D2` | `ring-ring` | Focus кольцо |

#### Статусные цвета

| Токен | Hex | Tailwind | Применение |
|-------|-----|----------|-----------|
| `--color-danger` | `#EF4444` | `bg-destructive` | Ошибки, удаление, критические алерты |
| `--color-warning` | `#F59E0B` | `bg-warning` | Предупреждения, средние алерты |
| `--color-success` | `#10B981` | `bg-success` | Успех, норма, подтверждение |

---

### Тёмная тема (class="dark")

| Токен | Светлая | Тёмная | Разница |
|-------|---------|--------|---------|
| primary | `#BDEDE0` | `#BDEDE0` | Без изменений |
| primary-deep | `#7ECDB8` | `#7ECDB8` | Без изменений |
| secondary | `#7E78D2` | `#9B95E0` | Светлее на тёмном фоне |
| secondary-deep | `#5B54B0` | `#7E78D2` | Светлее |
| background | `#F6FAF9` | `#0B0F14` | Инвертирован |
| surface | `#FFFFFF` | `#141921` | Тёмная карточка |
| surface-elevated | `#FFFFFF` | `#1A202C` | Ещё светлее |
| text-primary | `#0F172A` | `#F1F5F9` | Инвертирован |
| text-secondary | `#64748B` | `#94A3B8` | Светлее |
| text-tertiary | `#94A3B8` | `#64748B` | Темнее |
| danger | `#EF4444` | `#F87171` | Светлее |
| warning | `#F59E0B` | `#FBBF24` | Светлее |
| success | `#10B981` | `#34D399` | Светлее |
| muted | `#F1F5F9` | `#1E293B` | Инвертирован |
| border | `#E8EDF2` | `#1E293B` | Инвертирован |

---

## Скругления

```
CSS-переменная: --radius: 0.75rem (12px)
```

| Токен Tailwind | Значение | Применение |
|---------------|----------|-----------|
| `rounded-sm` | 8px | Мелкие элементы (бейджи) |
| `rounded-md` | 10px | Средние элементы (чипы) |
| `rounded-lg` | 12px | Карточки, инпуты, кнопки |
| `rounded-xl` | 16px | Кнопки md/lg, карточки |
| `rounded-2xl` | 24px | Большие карточки, секции |
| `rounded-full` | 50% | Аватары, индикаторы, бейджи |

---

## Тени

| Класс | Применение |
|-------|-----------|
| `shadow-sm` | Карточки в покое |
| `shadow-md` | Карточки при hover |
| `shadow-lg` | Кнопки primary, dropdown |
| `shadow-xl` | Модальные окна |

### Glass Card (специальная тень)
```css
.glass-card {
  background: rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.5);
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.03),
    0 2px 4px rgba(0, 0, 0, 0.02),
    0 12px 24px rgba(0, 0, 0, 0.04);
}
```

---

## Размеры текста

| Класс | Размер | Применение |
|-------|--------|-----------|
| `text-xs` | 12px | Метки, подписи, timestamps |
| `text-sm` | 14px | Основной текст, кнопки, инпуты |
| `text-base` | 16px | Описания, подзаголовки |
| `text-lg` | 18px | Заголовки карточек |
| `text-xl` | 20px | Заголовки модулей |
| `text-2xl` | 24px | Числовые значения (stat cards) |
| `text-3xl` | 30px | Заголовки секций (mobile) |
| `text-4xl` | 36px | Заголовки секций (desktop) |

### Метки полей (label)
```
Размер: 13px
Вес: 600 (Semibold)
Трансформация: uppercase
Letter-spacing: wider (0.05em)
Цвет: --color-text-tertiary
```

---

## Компоненты

### Button

**Файл:** `src/components/ui/button.tsx`

#### Варианты

| Вариант | Стиль |
|---------|-------|
| `primary` | Gradient secondary→secondary-deep, белый текст |
| `secondary` | bg-muted, текст foreground |
| `outline` | Border, текст secondary |
| `ghost` | Без фона, текст secondary, hover — bg-muted |
| `destructive` | bg-danger, белый текст |

#### Размеры

| Размер | Padding | Текст | Скругление |
|--------|---------|-------|------------|
| `sm` | px-3 py-1.5 | 12px | rounded-lg (12px) |
| `md` | px-5 py-2.5 | 14px | rounded-xl (16px) |
| `lg` | px-8 py-3.5 | 14px | rounded-xl (16px) |

#### Состояния
- **Hover:** opacity-90 (primary), bg-border (secondary)
- **Active:** scale(0.98)
- **Disabled:** opacity-50, cursor-not-allowed
- **Loading:** Spinner вместо иконки

---

### Badge

**Файл:** `src/components/ui/badge.tsx`

| Вариант | Фон | Текст |
|---------|-----|-------|
| `success` | success/10 | success |
| `warning` | warning/10 | warning |
| `destructive` | destructive/10 | destructive |
| `secondary` | secondary/10 | secondary |
| `muted` | muted | text-secondary |
| `primary` | primary/10 | primary-deep |

Стиль: `rounded-full px-2.5 py-0.5 text-xs font-medium`
Опционально: `dot` — цветная точка перед текстом.

---

### InputField

**Файл:** `src/components/ui/input-field.tsx`

```
Высота: py-2.5 (~40px)
Скругление: rounded-xl
Фон: bg-surface
Граница: border-border (ошибка: border-destructive)
Текст: text-sm, text-foreground
Placeholder: text-tertiary
Focus: border-secondary/40 + glow ring
С иконкой: pl-11 (отступ для иконки слева)
```

**Focus glow:**
```css
box-shadow: 0 0 0 3px rgba(126, 120, 210, 0.12),
            0 0 0 1px rgba(126, 120, 210, 0.3);
```

---

### TextareaField

**Файл:** `src/components/ui/textarea-field.tsx`

Аналогичен InputField, но `<textarea>` с `resize-none`.

---

### CustomSelect

**Файл:** `src/components/ui/select-custom.tsx`

Кастомный dropdown с поиском. Portal-рендеринг для избежания z-index проблем.

---

### TagInput

**Файл:** `src/components/ui/tag-input.tsx`

Поле для ввода тегов. Цвета тегов: destructive, warning, success, secondary.

---

### DatePicker

**Файл:** `src/components/ui/date-picker.tsx`

Обёртка над `<input type="date">` с label и стилями дизайн-системы.

---

### DataTable

**Файл:** `src/components/ui/data-table.tsx`

Переиспользуемая таблица с сортировкой и пагинацией.

---

### PrintLayout

**Файл:** `src/components/ui/print-layout.tsx`

Обёртка для печатных документов (медкарты, рецепты).

---

## Общие компоненты

### PageHeader (`components/shared/page-header.tsx`)
Заголовок страницы с навигацией.

### LoadingSkeleton (`components/shared/loading-skeleton.tsx`)
Skeleton placeholder при загрузке данных.

### RequireRole (`components/shared/require-role.tsx`)
Компонент для ограничения доступа по роли.
```tsx
<RequireRole role="admin">
  <AdminPanel />
</RequireRole>
```

---

## Отступы и сетка

### Контейнер
```
max-width: 6xl (1152px)
Padding: px-4 (mobile), px-6 (desktop)
Центрирование: mx-auto
```

### Секции страниц
```
Вертикальные отступы: py-6 md:py-8
Между карточками: gap-4 md:gap-6
Сетка: grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3
```

### Карточки
```
Padding: p-5 md:p-6
Скругление: rounded-xl md:rounded-2xl
Граница: border border-border
Фон: bg-surface
Тень: shadow-sm (покой), shadow-md (hover)
```

---

## Анимации

### CSS анимации (index.css)

| Имя | Применение |
|-----|-----------|
| `float-up` | Появление элементов снизу вверх (0.7s) |
| `scale-in` | Масштабирование при появлении (0.5s) |
| `fade-in` | Плавное появление (0.5s) |
| `slide-in-right` | Слайд справа (0.5s) |
| `gradient-shift` | Анимация фона логина |
| `pulse-ring` | Пульсация кольца |
| `heartbeat-line` | Линия ЭКГ на логине |
| `shimmer` | Мерцание загрузки |
| `dot-pulse` | Пульсация индикатора (2s) |

### Tailwind классы

| Класс | Применение |
|-------|-----------|
| `animate-float-up` | Появление с задержкой |
| `animate-scale-in` | Масштабируемое появление |
| `animate-fade-in` | Плавное появление |
| `animate-slide-in-right` | Слайд справа |
| `animate-pulse` | Стандартная пульсация |

### Easing
```
Основной: cubic-bezier(0.22, 1, 0.36, 1)
Стандартный: ease-out
Длительность: 200ms (hover), 500ms (появление), 700ms (секции)
```

---

## Навигация (Sidebar)

### Nav Item
```css
.nav-item {
  display: flex; align-items: center; gap: 12px;
  padding: 8px 12px; border-radius: 12px;
  font-size: 14px; font-weight: 500;
  color: text-secondary;
  transition: all 200ms;
}

.nav-item:hover {
  color: text-primary;
  background: muted;
}

.nav-item.active {
  color: secondary-deep;
  background: accent;
  box-shadow: inset 0 0 0 1px rgba(126, 120, 210, 0.12);
}
```

---

## Специальные стили

### Login Background
Mesh-градиент из мятного и фиолетового:
```css
.login-bg {
  background:
    radial-gradient(ellipse 80% 50% at 20% 40%, rgba(189,237,224,0.25), transparent),
    radial-gradient(ellipse 60% 40% at 80% 20%, rgba(126,120,210,0.15), transparent),
    radial-gradient(ellipse 50% 60% at 50% 90%, rgba(189,237,224,0.12), transparent),
    var(--color-background);
}
```

### Scrollbar
```
Ширина: 6px
Thumb: color-border, rounded-3px
Thumb hover: color-text-tertiary
Track: transparent
```

### Stat Card Hover
```
Transform: translateY(-2px)
Shadow: 0 16px 32px rgba(0,0,0,0.06)
Transition: 300ms ease-out
```

---

## Иконки

**Библиотека:** Lucide React
**Размеры:**
- 14px — внутри бейджей, мелкие индикаторы
- 16px — внутри кнопок sm, инпутов
- 18px — навигация, карточки
- 20px — карточки модулей, фичей
- 24px — заголовки секций, главные действия

---

## Файловая структура дизайн-системы

```
frontend/
├── index.html                     # Подключение шрифтов
├── src/
│   ├── index.css                  # CSS-переменные, анимации, утилиты
│   ├── lib/utils.ts               # cn() — merge Tailwind классов
│   ├── components/
│   │   ├── ui/                    # Дизайн-система
│   │   │   ├── button.tsx         # Button (5 вариантов, 3 размера)
│   │   │   ├── badge.tsx          # Badge (6 вариантов)
│   │   │   ├── input-field.tsx    # InputField (label, icon, error, hint)
│   │   │   ├── textarea-field.tsx # TextareaField
│   │   │   ├── select-custom.tsx  # CustomSelect (с поиском)
│   │   │   ├── tag-input.tsx      # TagInput
│   │   │   ├── date-picker.tsx    # DatePicker
│   │   │   ├── data-table.tsx     # DataTable (сортировка, пагинация)
│   │   │   └── print-layout.tsx   # PrintLayout
│   │   └── shared/                # Общие компоненты
│   │       ├── page-header.tsx    # PageHeader
│   │       ├── loading-skeleton.tsx
│   │       └── require-role.tsx   # RequireRole
│   └── tailwind.config.ts         # Tailwind конфигурация
```

---

## Правила использования

1. **Всегда используй CSS-переменные** через Tailwind классы (`bg-primary`, `text-foreground`), а не хардкод цветов
2. **Скругления** — минимум `rounded-lg`, карточки `rounded-xl` или `rounded-2xl`
3. **Тени** — `shadow-sm` для покоя, `shadow-md` для hover
4. **Текст** — `text-sm` для body, `text-xs` для метки, `font-semibold` минимум для заголовков
5. **Отступы** — `p-5` или `p-6` для карточек, `gap-4` или `gap-6` для сеток
6. **Dark mode** — все компоненты автоматически поддерживают через CSS-переменные
7. **Анимации** — `transition-all duration-200` для hover, `animate-float-up` для появления
8. **Иконки** — Lucide React, размер должен соответствовать контексту
