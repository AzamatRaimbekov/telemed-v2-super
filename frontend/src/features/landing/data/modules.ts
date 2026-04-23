import {
  ClipboardList, Pill, FlaskConical, Stethoscope, Brain, BarChart3,
  CalendarDays, Banknote, Users, BedDouble, FileText, Video,
  Bot, Radio, Building2, UserCircle, Shield, ScrollText, UserCheck,
  Hospital, Camera, MessageSquare, Send, Mail, Activity,
  Cpu, Smartphone,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface Module {
  icon: LucideIcon;
  name: string;
  description: string;
  group: "medicine" | "management" | "technology";
}

export const modules: Module[] = [
  { icon: ClipboardList, name: "Электронные медкарты", description: "Карточки пациентов, визиты, диагнозы МКБ-10", group: "medicine" },
  { icon: Pill, name: "Фармация", description: "Аптека, рецепты, склад, поставщики", group: "medicine" },
  { icon: FlaskConical, name: "Лаборатория", description: "Заказы анализов, результаты, утверждение", group: "medicine" },
  { icon: Stethoscope, name: "Лечение", description: "Планы лечения, назначения, контроль", group: "medicine" },
  { icon: Brain, name: "Реабилитация", description: "Инсульт, упражнения с AI, цели восстановления", group: "medicine" },
  { icon: BarChart3, name: "Аналитика", description: "Отчёты по пациентам, финансам, персоналу", group: "medicine" },
  { icon: CalendarDays, name: "Расписание", description: "Приёмы, смены, загрузка врачей", group: "management" },
  { icon: Banknote, name: "Биллинг", description: "Счета, платежи, финансовая аналитика", group: "management" },
  { icon: Users, name: "Персонал", description: "Профили, роли, посещаемость", group: "management" },
  { icon: BedDouble, name: "Палаты", description: "Койки, размещение, статус занятости", group: "management" },
  { icon: FileText, name: "Аудит", description: "Журнал всех действий в системе", group: "management" },
  { icon: Video, name: "Телемедицина", description: "Видеоконсультации через Daily.co", group: "technology" },
  { icon: Bot, name: "AI ассистент", description: "Голосовое управление, умные подсказки", group: "technology" },
  { icon: Radio, name: "IoT мониторинг", description: "Датчики, алерты, показатели в реальном времени", group: "technology" },
  { icon: Building2, name: "BMS", description: "Управление зданием, климат, безопасность", group: "technology" },
  { icon: UserCircle, name: "Портал пациента", description: "Личный кабинет, запись, результаты", group: "technology" },
];

export const groupColors: Record<Module["group"], string> = {
  medicine: "#2563eb",
  management: "#7c3aed",
  technology: "#0891b2",
};

export const groupLabels: Record<Module["group"], string> = {
  medicine: "Медицина",
  management: "Управление",
  technology: "Технологии",
};

export interface PainSolution { pain: string; solution: string; }
export const painSolutions: PainSolution[] = [
  { pain: "Медсёстры тратят часы на бумажные отчёты", solution: "Электронные медкарты заполняются за минуты" },
  { pain: "Пациенты уходят — нет удобного сервиса", solution: "Личный портал с голосовым ассистентом" },
  { pain: "10 программ, данные не связаны между собой", solution: "Единая платформа — всё в одном окне" },
  { pain: "Нет контроля за оборудованием и зданием", solution: "IoT мониторинг + автоматизация BMS" },
];

export interface Role { id: string; icon: LucideIcon; label: string; color: string; features: string[]; }
export const roles: Role[] = [
  { id: "chief", icon: Hospital, label: "Главврач", color: "#2563eb", features: ["Полная аналитика по клинике в реальном времени","Контроль загрузки врачей и палат","Аудит всех действий персонала","Финансовые отчёты и прогнозы","Управление зданием (BMS) и оборудованием"] },
  { id: "doctor", icon: Stethoscope, label: "Врач", color: "#7c3aed", features: ["Быстрые назначения и рецепты","AI-помощник для диагностики","Телемедицина — видеоконсультации","История пациента в один клик","Планы лечения с контролем выполнения"] },
  { id: "nurse", icon: Activity, label: "Медсестра", color: "#0891b2", features: ["Мониторинг витальных показателей в реальном времени","Автоматические алерты при критических значениях","Электронные листы назначений","Кнопка вызова — мгновенное оповещение","Учёт процедур и манипуляций"] },
  { id: "reception", icon: UserCheck, label: "Регистратура", color: "#d97706", features: ["Регистрация за 2 минуты (OCR + распознавание лица)","Управление расписанием всех врачей","Распределение по палатам и койкам","Приём платежей и выставление счетов","Поиск пациента по ФИО, ИНН, телефону"] },
  { id: "patient", icon: UserCircle, label: "Пациент", color: "#10b981", features: ["Личный кабинет — запись на приём, результаты анализов","Видеоконсультация с врачом из дома","Упражнения для реабилитации с AI-трекером","Голосовой ассистент — навигация голосом","Оплата счетов онлайн"] },
];

export const portalFeatures: string[] = ["Запись на приём к любому врачу","Результаты анализов — как только врач утвердит","Видеоконсультация без установки приложения","Упражнения для реабилитации с камерой (MediaPipe)","Голосовой ассистент — скажи «запишись к терапевту»","Оплата счетов и история лечения"];

export interface SecurityItem { icon: LucideIcon; title: string; description: string; }
export const securityItems: SecurityItem[] = [
  { icon: Shield, title: "Шифрование", description: "Данные зашифрованы при передаче и хранении. HTTPS, bcrypt для паролей." },
  { icon: ScrollText, title: "Полный аудит", description: "Каждое действие записывается. Кто, когда, что изменил — всегда известно." },
  { icon: Users, title: "9 ролей доступа", description: "От главврача до регистратора. Каждый видит только своё. Динамические права." },
  { icon: Hospital, title: "Изоляция данных", description: "Мультитенантность: данные каждой клиники полностью изолированы друг от друга." },
];

export interface Integration { icon: LucideIcon; name: string; }
export const integrations: Integration[] = [
  { icon: Radio, name: "IoT датчики" },{ icon: Camera, name: "Камеры" },{ icon: Video, name: "Daily.co" },{ icon: ClipboardList, name: "МКБ-10" },{ icon: Smartphone, name: "SMS" },{ icon: MessageSquare, name: "WhatsApp" },{ icon: Send, name: "Telegram" },{ icon: Cpu, name: "MediaPipe" },{ icon: Bot, name: "Google Gemini" },{ icon: Mail, name: "Email SMTP" },
];

export const monitoringStats = [
  { label: "SpO2", value: "98%", color: "#10b981" },
  { label: "HR", value: "72 bpm", color: "#2563eb" },
  { label: "Temp", value: "36.6°", color: "#7c3aed" },
  { label: "Fall Detection", value: "✓", color: "#d97706" },
];

export const beforeItems = ["Разрозненные данные","Ручной учёт","Потерянные карточки","Нет аналитики"];
export const afterItems = ["Всё в одном окне","Автоматический учёт","Мгновенный поиск","Аналитика в реальном времени"];
export const navLinks = [
  { label: "Возможности", href: "#pain-solution" },
  { label: "Модули", href: "#modules" },
  { label: "Безопасность", href: "#security" },
  { label: "Контакты", href: "#cta" },
];
