---
aliases: [File Dropzone, Drag and Drop Upload]
tags: [feature, frontend, ui, upload, drag-drop]
created: 2026-04-23
---

# Drag-and-drop загрузка файлов

> Компонент для загрузки файлов перетаскиванием или выбором из диалога.

---

## Обзор

Компонент `FileDropzone` поддерживает drag-and-drop, множественный выбор, валидацию размера, отображение списка файлов с иконками и возможность удаления.

## Параметры

| Параметр | Тип | По умолчанию | Описание |
|----------|-----|-------------|----------|
| `onFilesSelected` | `(files: File[]) => void` | обязательный | Колбэк при выборе файлов |
| `accept` | string | `"*"` | Допустимые типы файлов |
| `multiple` | boolean | `true` | Множественный выбор |
| `maxSizeMB` | number | `10` | Максимальный размер файла (MB) |
| `className` | string | `""` | Дополнительные CSS классы |

## Функции

- Drag-and-drop зона с визуальной подсветкой
- Клик для открытия диалога выбора файлов
- Валидация размера файлов
- Список выбранных файлов с иконками (изображение, PDF, другие)
- Отображение размера файла
- Удаление файлов из списка
- Сообщение об ошибке при превышении размера

## Использование

```tsx
import { FileDropzone } from "@/components/shared/file-dropzone";

<FileDropzone
  onFilesSelected={(files) => console.log(files)}
  accept="image/*,.pdf"
  maxSizeMB={5}
/>
```

## Файлы

- `frontend/src/components/shared/file-dropzone.tsx`

## Зависимости

- `lucide-react` (иконки: Upload, File, X, Image, FileText)

## Связанные модули

- [[UI Компоненты]]
- [[Электронное согласие]]
- [[DICOM интеграция]]
