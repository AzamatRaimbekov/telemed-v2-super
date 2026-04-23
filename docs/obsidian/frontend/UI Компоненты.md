---
aliases: [UI Components, Дизайн-система]
tags: [frontend, components, ui, tailwind]
created: 2026-04-20
---

# UI Компоненты

**Стиль:** Tailwind CSS 3.4 + Radix UI примитивы + Lucide иконки

Подробная документация: `frontend/UI_COMPONENTS.md`

## Компоненты дизайн-системы

### Button (`components/ui/button.tsx`)
Варианты: `primary`, `secondary`, `outline`, `ghost`, `destructive`
Размеры: `sm`, `md`, `lg`

### Badge (`components/ui/badge.tsx`)
Статусные бейджи: `success`, `warning`, `destructive`, `default`

### InputField (`components/ui/input-field.tsx`)
Текстовое поле с label, error, hint. Интеграция с React Hook Form.

### TextareaField (`components/ui/textarea-field.tsx`)
Многострочное поле.

### SelectCustom (`components/ui/select-custom.tsx`)
Кастомный выпадающий список с поиском.

### TagInput (`components/ui/tag-input.tsx`)
Поле для ввода тегов/чипов.

### DatePicker (`components/ui/date-picker.tsx`)
Выбор даты.

### DataTable (`components/ui/data-table.tsx`)
Таблица с сортировкой и пагинацией.

### PrintLayout (`components/ui/print-layout.tsx`)
Обёртка для печатных документов.

## Общие компоненты

### PageHeader (`components/shared/page-header.tsx`)
Заголовок страницы с навигацией.

### LoadingSkeleton (`components/shared/loading-skeleton.tsx`)
Skeleton placeholder при загрузке.

### RequireRole (`components/shared/require-role.tsx`)
```tsx
<RequireRole role="admin">
  <AdminPanel />
</RequireRole>
```

## Связанные документы

- [[Frontend Overview]]
- [[Стейт-менеджмент]]
