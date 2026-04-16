# UI Components — MedCore KG

Документация по переиспользуемым UI-компонентам проекта.
**ВАЖНО**: Всегда используй эти компоненты вместо нативных HTML-элементов.

---

## 1. Button — `@/components/ui/button`

Кнопка с вариантами, размерами и loading-состоянием.

```tsx
import { Button } from "@/components/ui/button";

<Button variant="primary" size="md" loading={false} icon={<Icon />}>
  Сохранить
</Button>
```

**Props:**
| Prop | Тип | Default | Описание |
|------|-----|---------|----------|
| variant | `"primary" \| "secondary" \| "outline" \| "ghost" \| "destructive"` | `"primary"` | Визуальный стиль |
| size | `"sm" \| "md" \| "lg"` | `"md"` | Размер кнопки |
| icon | `React.ReactNode` | — | Иконка слева от текста |
| loading | `boolean` | `false` | Показать спиннер, заблокировать |
| children | `React.ReactNode` | — | Текст кнопки |
| + все стандартные `<button>` props | | | |

**Варианты:**
- `primary` — градиент secondary → secondary-deep, белый текст (основные действия)
- `secondary` — muted фон (второстепенные действия)
- `outline` — бордер, secondary текст
- `ghost` — только текст, hover фон
- `destructive` — красный фон (удаление, опасные действия)

---

## 2. Badge — `@/components/ui/badge`

Статусный бейдж с цветовыми вариантами.

```tsx
import { Badge } from "@/components/ui/badge";

<Badge variant="success" dot>Активен</Badge>
```

**Props:**
| Prop | Тип | Default | Описание |
|------|-----|---------|----------|
| variant | `"success" \| "warning" \| "destructive" \| "secondary" \| "muted" \| "primary"` | `"muted"` | Цветовой вариант |
| dot | `boolean` | `false` | Цветная точка перед текстом |
| className | `string` | — | Доп. классы |
| children | `React.ReactNode` | — | Текст бейджа |

---

## 3. InputField — `@/components/ui/input-field`

Текстовый инпут с лейблом, иконкой, ошибкой и подсказкой.

```tsx
import { InputField } from "@/components/ui/input-field";

<InputField
  label="Email"
  icon={<MailIcon />}
  error={errors.email}
  hint="Рабочий email сотрудника"
  placeholder="user@clinic.kg"
  value={email}
  onChange={e => setEmail(e.target.value)}
/>
```

**Props:**
| Prop | Тип | Default | Описание |
|------|-----|---------|----------|
| label | `string` | — | Лейбл над полем |
| icon | `React.ReactNode` | — | Иконка слева в поле |
| error | `string` | — | Текст ошибки (красный) |
| hint | `string` | — | Подсказка под полем |
| + все стандартные `<input>` props | | | |

---

## 4. TextareaField — `@/components/ui/textarea-field`

Многострочное текстовое поле с лейблом и ошибкой.

```tsx
import { TextareaField } from "@/components/ui/textarea-field";

<TextareaField
  label="Описание"
  error={errors.description}
  rows={4}
  value={desc}
  onChange={e => setDesc(e.target.value)}
/>
```

**Props:**
| Prop | Тип | Default | Описание |
|------|-----|---------|----------|
| label | `string` | — | Лейбл над полем |
| error | `string` | — | Текст ошибки |
| + все стандартные `<textarea>` props | | | |

---

## 5. CustomSelect — `@/components/ui/select-custom`

**Кастомный дропдаун** — ВСЕГДА используй вместо `<select>`.
Поддерживает поиск, иконки, описания.

```tsx
import { CustomSelect } from "@/components/ui/select-custom";

<CustomSelect
  label="Отделение"
  value={departmentId}
  onChange={setDepartmentId}
  placeholder="Выберите отделение"
  options={[
    { value: "neuro", label: "Неврология", description: "3 этаж" },
    { value: "cardio", label: "Кардиология", icon: <HeartIcon /> },
  ]}
/>
```

**Props:**
| Prop | Тип | Default | Описание |
|------|-----|---------|----------|
| value | `string` | — | Выбранное значение |
| onChange | `(value: string) => void` | — | Коллбэк при выборе |
| options | `SelectOption[]` | — | Массив опций |
| placeholder | `string` | `"Выберите..."` | Плейсхолдер |
| label | `string` | — | Лейбл над дропдауном |
| disabled | `boolean` | `false` | Заблокировать |
| className | `string` | — | Доп. классы |

**SelectOption:**
```ts
{ value: string; label: string; icon?: React.ReactNode; description?: string }
```

**Фичи:** Портальный дропдаун, поиск (при >6 опций), позиционирование при скролле, закрытие по клику вне.

---

## 6. DatePicker — `@/components/ui/date-picker`

Нативный date picker с лейблом.

```tsx
import { DatePicker } from "@/components/ui/date-picker";

<DatePicker
  label="Дата рождения"
  value={birthDate}
  onChange={setBirthDate}
  required
/>
```

**Props:**
| Prop | Тип | Default | Описание |
|------|-----|---------|----------|
| value | `string` | — | ISO дата (YYYY-MM-DD) |
| onChange | `(value: string) => void` | — | Коллбэк при изменении |
| label | `string` | — | Лейбл |
| required | `boolean` | — | Обязательное поле |
| className | `string` | — | Доп. классы |

---

## 7. TagInput — `@/components/ui/tag-input`

Ввод тегов (аллергии, хронические заболевания и т.д.).

```tsx
import { TagInput } from "@/components/ui/tag-input";

<TagInput
  label="Аллергии"
  tags={allergies}
  onAdd={tag => setAllergies([...allergies, tag])}
  onRemove={i => setAllergies(allergies.filter((_, idx) => idx !== i))}
  tagColor="destructive"
  placeholder="Добавить аллергию..."
/>
```

**Props:**
| Prop | Тип | Default | Описание |
|------|-----|---------|----------|
| label | `string` | — | Лейбл |
| tags | `string[]` | — | Текущие теги |
| onAdd | `(tag: string) => void` | — | Добавить тег |
| onRemove | `(index: number) => void` | — | Удалить тег по индексу |
| placeholder | `string` | `"Добавить..."` | Плейсхолдер |
| tagColor | `"destructive" \| "warning" \| "success" \| "secondary"` | `"secondary"` | Цвет тегов |
| className | `string` | — | Доп. классы |

---

## 8. DataTable — `@/components/ui/data-table`

Универсальная таблица с колонками, загрузкой и пустыми состояниями.

```tsx
import { DataTable } from "@/components/ui/data-table";

<DataTable
  columns={[
    { key: "name", header: "Имя" },
    { key: "status", header: "Статус", render: (item) => <Badge>{item.status}</Badge> },
  ]}
  data={patients}
  onRowClick={(p) => navigate(`/patients/${p.id}`)}
  isLoading={isLoading}
  emptyText="Нет пациентов"
/>
```

**Props:**
| Prop | Тип | Default | Описание |
|------|-----|---------|----------|
| columns | `Column<T>[]` | — | Определения колонок |
| data | `T[]` | — | Данные таблицы |
| onRowClick | `(item: T) => void` | — | Клик по строке |
| isLoading | `boolean` | — | Показать скелетон |
| loadingRows | `number` | `5` | Кол-во скелетон-строк |
| emptyIcon | `React.ReactNode` | — | Иконка пустого состояния |
| emptyText | `string` | `"Нет данных"` | Текст пустого состояния |
| emptySubtext | `string` | — | Подтекст |

**Column<T>:**
```ts
{ key: string; header: string; className?: string; render?: (item: T, index: number) => React.ReactNode }
```

---

## Правила использования

### ЗАПРЕЩЕНО в новом коде:
- `<select>` / `<option>` — используй `CustomSelect`
- `<input>` без обёртки — используй `InputField`
- `<textarea>` без обёртки — используй `TextareaField`
- `<button>` без стилей — используй `Button`
- Самодельные бейджи — используй `Badge`
- Самодельные таблицы — используй `DataTable`
- Самодельные date inputs — используй `DatePicker`

### Стилевые константы:
```
Карточка:       bg-[var(--color-surface)] rounded-2xl border border-border p-6
Секция:         text-sm font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-4
Анимация:       animate-float-up style={{ animationDelay: 'Xms' }}
Success:        bg-success/10 text-success
Warning:        bg-warning/10 text-warning
Destructive:    bg-destructive/10 text-destructive
Secondary:      bg-secondary/10 text-secondary
Primary:        #BDEDE0
Secondary:      #7E78D2
```

### Импорты:
```tsx
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { InputField } from "@/components/ui/input-field";
import { TextareaField } from "@/components/ui/textarea-field";
import { CustomSelect } from "@/components/ui/select-custom";
import { DatePicker } from "@/components/ui/date-picker";
import { TagInput } from "@/components/ui/tag-input";
import { DataTable } from "@/components/ui/data-table";
```
