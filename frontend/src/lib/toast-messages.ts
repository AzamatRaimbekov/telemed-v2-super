/**
 * Centralized toast messages for consistent UX.
 * Import and use with sonner's toast() function.
 */
import { toast } from "sonner";

export const toasts = {
  // CRUD
  created: (entity: string) => toast.success(`${entity} создан(а) успешно`),
  updated: (entity: string) => toast.success(`${entity} обновлён(а)`),
  deleted: (entity: string) => toast.success(`${entity} удалён(а)`),

  // Actions
  saved: () => toast.success("Сохранено"),
  sent: () => toast.success("Отправлено"),
  copied: () => toast.success("Скопировано в буфер обмена"),

  // Errors
  error: (message?: string) => toast.error(message || "Произошла ошибка"),
  networkError: () => toast.error("Ошибка сети. Проверьте подключение."),
  forbidden: () => toast.error("Нет доступа к этому действию"),
  notFound: () => toast.error("Не найдено"),

  // Loading
  loading: (message?: string) => toast.loading(message || "Загрузка..."),

  // Specific
  loginSuccess: () => toast.success("Добро пожаловать!"),
  logoutSuccess: () => toast.success("Вы вышли из системы"),
  passwordChanged: () => toast.success("Пароль изменён"),
  profileUpdated: () => toast.success("Профиль обновлён"),
  appointmentBooked: () => toast.success("Приём записан"),
  appointmentCancelled: () => toast.success("Приём отменён"),
  prescriptionCreated: () => toast.success("Рецепт создан"),
  labOrderCreated: () => toast.success("Направление на анализы создано"),

  // Custom
  custom: (message: string, type: "success" | "error" | "info" | "warning" = "info") => {
    if (type === "success") toast.success(message);
    else if (type === "error") toast.error(message);
    else if (type === "warning") toast.warning(message);
    else toast.info(message);
  },
};
