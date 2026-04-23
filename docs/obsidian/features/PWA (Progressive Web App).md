---
aliases: [PWA, Progressive Web App, Оффлайн]
tags: [feature, frontend, pwa]
created: 2026-04-22
---

# PWA (Progressive Web App)

> Портал пациента можно установить как приложение на телефон. При потере интернета показывается offline-страница с брендингом MedCore.

---

## Обзор

MedCore KG поддерживает установку как Progressive Web App (PWA) на мобильных устройствах и десктопе. Это позволяет пациентам:

1. **Добавить на главный экран** — иконка MedCore на домашнем экране
2. **Standalone режим** — приложение открывается без адресной строки браузера
3. **Offline fallback** — при потере интернета показывается страница "Нет подключения"

---

## Конфигурация

### Web App Manifest

| Параметр | Значение |
|----------|---------|
| `name` | MedCore KG — Портал пациента |
| `short_name` | MedCore |
| `display` | standalone |
| `theme_color` | #7E78D2 |
| `background_color` | #F6FAF9 |
| `start_url` | /portal/dashboard |
| `orientation` | portrait-primary |

### Service Worker

Стратегия: **Network First with Offline Fallback**

- При навигации сначала пытается загрузить страницу из сети
- Если сеть недоступна — показывает кешированную offline-страницу
- Версия кеша: `medcore-v1`

### Иконки

| Размер | Файл |
|--------|------|
| 192x192 | `/icons/icon-192.png` |
| 512x512 | `/icons/icon-512.png` |

---

## Файлы

| Файл | Назначение |
|------|-----------|
| `frontend/public/manifest.json` | Web App Manifest |
| `frontend/public/sw.js` | Service Worker |
| `frontend/public/offline.html` | Offline fallback страница |
| `frontend/public/icons/` | PWA иконки |
| `frontend/index.html` | Регистрация SW + manifest link |

---

## Связанные модули

- [[Портал пациента]] — Основной use-case для PWA
