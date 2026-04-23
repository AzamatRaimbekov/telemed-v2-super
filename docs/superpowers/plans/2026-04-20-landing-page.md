# MedCore KG Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a premium dark-themed landing page with 3D elements (React Three Fiber) for MedCore KG telemedicine platform targeting clinic directors in Kyrgyzstan.

**Architecture:** 12-section single-page landing at `/` route, replacing the current redirect-to-login. Uses existing dark mode CSS variables from the design system. Three lazy-loaded R3F 3D scenes (hero orbit, phone, room). Scroll animations via Framer Motion. All content in Russian.

**Tech Stack:** React 18, TanStack Router, Tailwind CSS (existing design system vars), Framer Motion (existing), React Three Fiber + drei + three (new), Lucide React (existing), Vite 6.

**Spec:** `docs/superpowers/specs/2026-04-20-landing-page-design.md`

---

## Task 1: Install R3F dependencies

**Files:**
- Modify: `frontend/package.json`

- [ ] **Step 1: Install three + R3F + drei**

```bash
cd frontend && pnpm add three @react-three/fiber @react-three/drei && pnpm add -D @types/three
```

- [ ] **Step 2: Verify install**

```bash
cd frontend && pnpm ls three @react-three/fiber @react-three/drei
```

Expected: All three packages listed with versions.

- [ ] **Step 3: Commit**

```bash
git add frontend/package.json frontend/pnpm-lock.yaml
git commit -m "feat(landing): add three.js and react-three-fiber dependencies"
```

---

## Task 2: Data layer — modules, roles, pain points, integrations

**Files:**
- Create: `frontend/src/features/landing/data/modules.ts`

- [ ] **Step 1: Create the data file with all landing content**

```typescript
// frontend/src/features/landing/data/modules.ts
import {
  ClipboardList, Pill, FlaskConical, Stethoscope, Brain, BarChart3,
  CalendarDays, Banknote, Users, BedDouble, FileText, Video,
  Bot, Radio, Building2, UserCircle, Shield, ScrollText, UserCheck,
  Hospital, Wifi, Camera, MessageSquare, Send, Mail, Activity,
  Cpu, Smartphone,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

// ---------- Modules ----------

export interface Module {
  icon: LucideIcon;
  name: string;
  description: string;
  group: "medicine" | "management" | "technology";
}

export const modules: Module[] = [
  // Medicine
  { icon: ClipboardList, name: "Электронные медкарты", description: "Карточки пациентов, визиты, диагнозы МКБ-10", group: "medicine" },
  { icon: Pill, name: "Фармация", description: "Аптека, рецепты, склад, поставщики", group: "medicine" },
  { icon: FlaskConical, name: "Лаборатория", description: "Заказы анализов, результаты, утверждение", group: "medicine" },
  { icon: Stethoscope, name: "Лечение", description: "Планы лечения, назначения, контроль", group: "medicine" },
  { icon: Brain, name: "Реабилитация", description: "Инсульт, упражнения с AI, цели восстановления", group: "medicine" },
  { icon: BarChart3, name: "Аналитика", description: "Отчёты по пациентам, финансам, персоналу", group: "medicine" },
  // Management
  { icon: CalendarDays, name: "Расписание", description: "Приёмы, смены, загрузка врачей", group: "management" },
  { icon: Banknote, name: "Биллинг", description: "Счета, платежи, финансовая аналитика", group: "management" },
  { icon: Users, name: "Персонал", description: "Профили, роли, посещаемость", group: "management" },
  { icon: BedDouble, name: "Палаты", description: "Койки, размещение, статус занятости", group: "management" },
  { icon: FileText, name: "Аудит", description: "Журнал всех действий в системе", group: "management" },
  // Technology
  { icon: Video, name: "Телемедицина", description: "Видеоконсультации через Daily.co", group: "technology" },
  { icon: Bot, name: "AI ассистент", description: "Голосовое управление, умные подсказки", group: "technology" },
  { icon: Radio, name: "IoT мониторинг", description: "Датчики, алерты, показатели в реальном времени", group: "technology" },
  { icon: Building2, name: "BMS", description: "Управление зданием, климат, безопасность", group: "technology" },
  { icon: UserCircle, name: "Портал пациента", description: "Личный кабинет, запись, результаты", group: "technology" },
];

export const groupColors: Record<Module["group"], string> = {
  medicine: "var(--color-primary)",
  management: "var(--color-secondary)",
  technology: "var(--color-success)",
};

export const groupLabels: Record<Module["group"], string> = {
  medicine: "Медицина",
  management: "Управление",
  technology: "Технологии",
};

// ---------- Pain → Solution ----------

export interface PainSolution {
  pain: string;
  solution: string;
}

export const painSolutions: PainSolution[] = [
  { pain: "Медсёстры тратят часы на бумажные отчёты", solution: "Электронные медкарты заполняются за минуты" },
  { pain: "Пациенты уходят — нет удобного сервиса", solution: "Личный портал с голосовым ассистентом" },
  { pain: "10 программ, данные не связаны между собой", solution: "Единая платформа — всё в одном окне" },
  { pain: "Нет контроля за оборудованием и зданием", solution: "IoT мониторинг + автоматизация BMS" },
];

// ---------- Roles ----------

export interface Role {
  id: string;
  icon: LucideIcon;
  label: string;
  color: string;
  features: string[];
}

export const roles: Role[] = [
  {
    id: "chief", icon: Hospital, label: "Главврач", color: "var(--color-primary-deep)",
    features: [
      "Полная аналитика по клинике в реальном времени",
      "Контроль загрузки врачей и палат",
      "Аудит всех действий персонала",
      "Финансовые отчёты и прогнозы",
      "Управление зданием (BMS) и оборудованием",
    ],
  },
  {
    id: "doctor", icon: Stethoscope, label: "Врач", color: "var(--color-secondary)",
    features: [
      "Быстрые назначения и рецепты",
      "AI-помощник для диагностики",
      "Телемедицина — видеоконсультации",
      "История пациента в один клик",
      "Планы лечения с контролем выполнения",
    ],
  },
  {
    id: "nurse", icon: Activity, label: "Медсестра", color: "var(--color-success)",
    features: [
      "Мониторинг витальных показателей в реальном времени",
      "Автоматические алерты при критических значениях",
      "Электронные листы назначений",
      "Кнопка вызова — мгновенное оповещение",
      "Учёт процедур и манипуляций",
    ],
  },
  {
    id: "reception", icon: UserCheck, label: "Регистратура", color: "var(--color-warning)",
    features: [
      "Регистрация за 2 минуты (OCR + распознавание лица)",
      "Управление расписанием всех врачей",
      "Распределение по палатам и койкам",
      "Приём платежей и выставление счетов",
      "Поиск пациента по ФИО, ИНН, телефону",
    ],
  },
  {
    id: "patient", icon: UserCircle, label: "Пациент", color: "var(--color-primary)",
    features: [
      "Личный кабинет — запись на приём, результаты анализов",
      "Видеоконсультация с врачом из дома",
      "Упражнения для реабилитации с AI-трекером",
      "Голосовой ассистент — навигация голосом",
      "Оплата счетов онлайн",
    ],
  },
];

// ---------- Portal Features ----------

export const portalFeatures: string[] = [
  "Запись на приём к любому врачу",
  "Результаты анализов — как только врач утвердит",
  "Видеоконсультация без установки приложения",
  "Упражнения для реабилитации с камерой (MediaPipe)",
  "Голосовой ассистент — скажи «запишись к терапевту»",
  "Оплата счетов и история лечения",
];

// ---------- Security ----------

export interface SecurityItem {
  icon: LucideIcon;
  title: string;
  description: string;
}

export const securityItems: SecurityItem[] = [
  { icon: Shield, title: "Шифрование", description: "Данные зашифрованы при передаче и хранении. HTTPS, bcrypt для паролей." },
  { icon: ScrollText, title: "Полный аудит", description: "Каждое действие записывается. Кто, когда, что изменил — всегда известно." },
  { icon: Users, title: "9 ролей доступа", description: "От главврача до регистратора. Каждый видит только своё. Динамические права." },
  { icon: Hospital, title: "Изоляция данных", description: "Мультитенантность: данные каждой клиники полностью изолированы друг от друга." },
];

// ---------- Integrations ----------

export interface Integration {
  icon: LucideIcon;
  name: string;
}

export const integrations: Integration[] = [
  { icon: Radio, name: "IoT датчики" },
  { icon: Camera, name: "Камеры" },
  { icon: Video, name: "Daily.co" },
  { icon: ClipboardList, name: "МКБ-10" },
  { icon: Smartphone, name: "SMS" },
  { icon: MessageSquare, name: "WhatsApp" },
  { icon: Send, name: "Telegram" },
  { icon: Cpu, name: "MediaPipe" },
  { icon: Bot, name: "Google Gemini" },
  { icon: Mail, name: "Email SMTP" },
];

// ---------- Monitoring Stats ----------

export const monitoringStats = [
  { label: "SpO2", value: "98%", color: "var(--color-success)" },
  { label: "HR", value: "72 bpm", color: "var(--color-primary)" },
  { label: "Temp", value: "36.6°", color: "var(--color-secondary)" },
  { label: "Fall Detection", value: "✓", color: "var(--color-warning)" },
];

// ---------- Before/After ----------

export const beforeItems = [
  "Разрозненные данные",
  "Ручной учёт",
  "Потерянные карточки",
  "Нет аналитики",
];

export const afterItems = [
  "Всё в одном окне",
  "Автоматический учёт",
  "Мгновенный поиск",
  "Аналитика в реальном времени",
];

// ---------- Nav Links ----------

export const navLinks = [
  { label: "Возможности", href: "#pain-solution" },
  { label: "Модули", href: "#modules" },
  { label: "Безопасность", href: "#security" },
  { label: "Контакты", href: "#cta" },
];
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/landing/data/modules.ts
git commit -m "feat(landing): add all landing page content data"
```

---

## Task 3: Scroll animation hook + section wrapper

**Files:**
- Create: `frontend/src/features/landing/hooks/useScrollAnimation.ts`
- Create: `frontend/src/features/landing/components/SectionWrapper.tsx`

- [ ] **Step 1: Create scroll animation hook**

```typescript
// frontend/src/features/landing/hooks/useScrollAnimation.ts
import { useRef } from "react";
import { useInView, useReducedMotion } from "framer-motion";

export function useScrollAnimation(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, amount: threshold });
  const prefersReducedMotion = useReducedMotion();

  return { ref, isInView, prefersReducedMotion };
}
```

- [ ] **Step 2: Create section wrapper component**

```tsx
// frontend/src/features/landing/components/SectionWrapper.tsx
import { motion } from "framer-motion";
import { useScrollAnimation } from "../hooks/useScrollAnimation";

interface SectionWrapperProps {
  id?: string;
  children: React.ReactNode;
  className?: string;
}

export function SectionWrapper({ id, children, className = "" }: SectionWrapperProps) {
  const { ref, isInView, prefersReducedMotion } = useScrollAnimation();

  return (
    <section id={id} ref={ref} className={`relative px-4 py-20 md:py-28 ${className}`}>
      <motion.div
        className="mx-auto max-w-6xl"
        initial={prefersReducedMotion ? undefined : { opacity: 0, y: 40 }}
        animate={isInView ? { opacity: 1, y: 0 } : undefined}
        transition={{ duration: 0.7, ease: "easeOut" }}
      >
        {children}
      </motion.div>
    </section>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/landing/hooks/useScrollAnimation.ts frontend/src/features/landing/components/SectionWrapper.tsx
git commit -m "feat(landing): add scroll animation hook and section wrapper"
```

---

## Task 4: Navbar

**Files:**
- Create: `frontend/src/features/landing/components/LandingNavbar.tsx`

- [ ] **Step 1: Create navbar component**

```tsx
// frontend/src/features/landing/components/LandingNavbar.tsx
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Menu, X } from "lucide-react";
import { navLinks } from "../data/modules";

export function LandingNavbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <motion.nav
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5 }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-[#0B0F14]/80 backdrop-blur-xl border-b border-[#1E293B]"
          : "bg-transparent"
      }`}
    >
      <div className="mx-auto max-w-6xl flex items-center justify-between px-4 h-16">
        {/* Logo */}
        <a href="#" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-deep)] flex items-center justify-center text-sm font-extrabold text-[#0B0F14]">
            M
          </div>
          <span className="text-[15px] font-bold text-[var(--color-text-primary)]">
            MedCore<span className="text-[var(--color-text-tertiary)] font-normal ml-1">KG</span>
          </span>
        </a>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
            >
              {link.label}
            </a>
          ))}
        </div>

        {/* CTA */}
        <div className="hidden md:flex items-center gap-3">
          <a
            href="/login"
            className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
          >
            Войти
          </a>
          <a
            href="#cta"
            className="h-9 px-4 rounded-lg bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-deep)] flex items-center text-sm font-semibold text-[#0B0F14] hover:opacity-90 transition-opacity"
          >
            Заказать демо
          </a>
        </div>

        {/* Mobile burger */}
        <button
          className="md:hidden text-[var(--color-text-secondary)]"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="md:hidden bg-[#0B0F14]/95 backdrop-blur-xl border-b border-[#1E293B] px-4 pb-6"
        >
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className="block py-3 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            >
              {link.label}
            </a>
          ))}
          <div className="flex gap-3 mt-4">
            <a href="/login" className="text-sm text-[var(--color-text-secondary)]">Войти</a>
            <a
              href="#cta"
              onClick={() => setMobileOpen(false)}
              className="h-9 px-4 rounded-lg bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-deep)] flex items-center text-sm font-semibold text-[#0B0F14]"
            >
              Заказать демо
            </a>
          </div>
        </motion.div>
      )}
    </motion.nav>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/landing/components/LandingNavbar.tsx
git commit -m "feat(landing): add navbar with scroll blur and mobile menu"
```

---

## Task 5: Hero 3D orbit scene

**Files:**
- Create: `frontend/src/features/landing/three/OrbitScene.tsx`

- [ ] **Step 1: Create the 3D orbit scene**

```tsx
// frontend/src/features/landing/three/OrbitScene.tsx
import { useRef, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Float, Sphere, MeshDistortMaterial } from "@react-three/drei";
import * as THREE from "three";

const MODULE_ICONS = ["EHR", "Rx", "Lab", "AI", "IoT", "BMS", "Vid", "Portal"];
const ORBIT_RADIUS = 2.8;

function CentralSphere() {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (meshRef.current) {
      meshRef.current.rotation.y = clock.getElapsedTime() * 0.15;
    }
  });

  return (
    <Sphere ref={meshRef} args={[0.8, 32, 32]}>
      <MeshDistortMaterial
        color="#BDEDE0"
        transparent
        opacity={0.15}
        wireframe
        distort={0.2}
        speed={1.5}
      />
    </Sphere>
  );
}

function GlowSphere() {
  return (
    <Sphere args={[1.2, 16, 16]}>
      <meshBasicMaterial color="#BDEDE0" transparent opacity={0.03} />
    </Sphere>
  );
}

function OrbitingModule({ index, total }: { index: number; total: number }) {
  const groupRef = useRef<THREE.Group>(null);
  const angle = (index / total) * Math.PI * 2;

  const color = useMemo(() => {
    const colors = ["#BDEDE0", "#7E78D2", "#10B981", "#7ECDB8", "#9B95E0", "#34D399", "#BDEDE0", "#7E78D2"];
    return colors[index % colors.length];
  }, [index]);

  useFrame(({ clock }) => {
    if (groupRef.current) {
      const t = clock.getElapsedTime() * 0.6 + angle;
      groupRef.current.position.x = Math.cos(t) * ORBIT_RADIUS;
      groupRef.current.position.z = Math.sin(t) * ORBIT_RADIUS;
      groupRef.current.position.y = Math.sin(t * 0.5 + index) * 0.3;
    }
  });

  return (
    <group ref={groupRef}>
      <Float speed={2} rotationIntensity={0.3} floatIntensity={0.2}>
        <mesh>
          <boxGeometry args={[0.35, 0.35, 0.35]} />
          <meshStandardMaterial
            color={color}
            transparent
            opacity={0.6}
            roughness={0.2}
            metalness={0.8}
          />
        </mesh>
        <pointLight color={color} intensity={0.3} distance={2} />
      </Float>
    </group>
  );
}

function OrbitRing() {
  const points = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 64; i++) {
      const angle = (i / 64) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(angle) * ORBIT_RADIUS, 0, Math.sin(angle) * ORBIT_RADIUS));
    }
    return pts;
  }, []);

  const geometry = useMemo(() => new THREE.BufferGeometry().setFromPoints(points), [points]);

  return (
    <line>
      <primitive object={geometry} attach="geometry" />
      <lineBasicMaterial color="#1E293B" transparent opacity={0.4} />
    </line>
  );
}

function MouseParallax({ children }: { children: React.ReactNode }) {
  const groupRef = useRef<THREE.Group>(null);
  const { pointer } = useThree();

  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, pointer.x * 0.2, 0.05);
      groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, -pointer.y * 0.1, 0.05);
    }
  });

  return <group ref={groupRef}>{children}</group>;
}

function Scene() {
  return (
    <>
      <ambientLight intensity={0.3} />
      <pointLight position={[5, 5, 5]} intensity={0.5} color="#BDEDE0" />
      <pointLight position={[-5, -5, 5]} intensity={0.3} color="#7E78D2" />

      <MouseParallax>
        <CentralSphere />
        <GlowSphere />
        <OrbitRing />
        {MODULE_ICONS.map((_, i) => (
          <OrbitingModule key={i} index={i} total={MODULE_ICONS.length} />
        ))}
      </MouseParallax>
    </>
  );
}

export function OrbitScene() {
  return (
    <div className="w-full h-[350px] md:h-[450px]">
      <Canvas
        camera={{ position: [0, 2, 6], fov: 45 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true }}
        style={{ background: "transparent" }}
      >
        <Scene />
      </Canvas>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/landing/three/OrbitScene.tsx
git commit -m "feat(landing): add 3D orbit scene with rotating module cubes"
```

---

## Task 6: Hero section component

**Files:**
- Create: `frontend/src/features/landing/components/LandingHero.tsx`

- [ ] **Step 1: Create hero section**

```tsx
// frontend/src/features/landing/components/LandingHero.tsx
import { Suspense, lazy } from "react";
import { motion, useReducedMotion } from "framer-motion";

const OrbitScene = lazy(() =>
  import("../three/OrbitScene").then((m) => ({ default: m.OrbitScene }))
);

function OrbitFallback() {
  return (
    <div className="w-full h-[350px] md:h-[450px] flex items-center justify-center">
      <div className="w-40 h-40 rounded-full border border-[#1E293B] animate-pulse" />
    </div>
  );
}

export function LandingHero() {
  const prefersReducedMotion = useReducedMotion();

  const fadeUp = prefersReducedMotion
    ? {}
    : { initial: { opacity: 0, y: 30 }, animate: { opacity: 1, y: 0 } };

  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center px-4 pt-20 overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-[radial-gradient(ellipse,rgba(189,237,224,0.08)_0%,rgba(126,120,210,0.04)_40%,transparent_70%)] pointer-events-none" />

      {/* Badge */}
      <motion.div
        {...fadeUp}
        transition={{ duration: 0.6, delay: 0.1 }}
        className="mb-6"
      >
        <span className="inline-block px-4 py-1.5 rounded-full bg-[var(--color-secondary)]/10 border border-[var(--color-secondary)]/20 text-sm text-[var(--color-secondary)] font-medium">
          Единая платформа для клиник
        </span>
      </motion.div>

      {/* Headline */}
      <motion.h1
        {...fadeUp}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="text-4xl md:text-6xl lg:text-7xl font-extrabold text-center leading-tight max-w-4xl"
      >
        <span className="text-[var(--color-text-primary)]">Вся клиника </span>
        <span className="bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-deep)] bg-clip-text text-transparent">
          в одном экране
        </span>
      </motion.h1>

      {/* Subheadline */}
      <motion.p
        {...fadeUp}
        transition={{ duration: 0.6, delay: 0.3 }}
        className="mt-6 text-base md:text-lg text-[var(--color-text-secondary)] text-center max-w-2xl leading-relaxed"
      >
        EHR, аптека, лаборатория, биллинг, мониторинг, телемедицина, AI — 16 модулей в одной системе
      </motion.p>

      {/* CTAs */}
      <motion.div
        {...fadeUp}
        transition={{ duration: 0.6, delay: 0.4 }}
        className="mt-8 flex flex-col sm:flex-row gap-3"
      >
        <a
          href="#cta"
          className="h-12 px-8 rounded-xl bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-deep)] flex items-center justify-center text-sm font-bold text-[#0B0F14] shadow-[0_8px_30px_rgba(189,237,224,0.25)] hover:shadow-[0_12px_40px_rgba(189,237,224,0.35)] transition-shadow"
        >
          Попробовать бесплатно
        </a>
        <a
          href="#demo"
          className="h-12 px-8 rounded-xl border border-[#1E293B] flex items-center justify-center text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-text-tertiary)] transition-colors"
        >
          Смотреть демо ▶
        </a>
      </motion.div>

      {/* 3D Orbit */}
      <motion.div
        {...fadeUp}
        transition={{ duration: 0.8, delay: 0.5 }}
        className="w-full max-w-3xl mt-4"
      >
        <Suspense fallback={<OrbitFallback />}>
          <OrbitScene />
        </Suspense>
      </motion.div>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/landing/components/LandingHero.tsx
git commit -m "feat(landing): add hero section with 3D orbit and CTAs"
```

---

## Task 7: Pain→Solution and Before→After sections

**Files:**
- Create: `frontend/src/features/landing/components/LandingPainSolution.tsx`
- Create: `frontend/src/features/landing/components/LandingBeforeAfter.tsx`

- [ ] **Step 1: Create pain→solution section**

```tsx
// frontend/src/features/landing/components/LandingPainSolution.tsx
import { motion } from "framer-motion";
import { X, Check } from "lucide-react";
import { SectionWrapper } from "./SectionWrapper";
import { painSolutions } from "../data/modules";

export function LandingPainSolution() {
  return (
    <SectionWrapper id="pain-solution">
      <h2 className="text-3xl md:text-4xl font-extrabold text-center text-[var(--color-text-primary)] mb-4">
        Знакомые проблемы?
      </h2>
      <p className="text-center text-[var(--color-text-secondary)] mb-14 max-w-xl mx-auto">
        Мы решаем их каждый день
      </p>

      <div className="grid md:grid-cols-2 gap-5">
        {painSolutions.map((item, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: i * 0.1 }}
            className="rounded-2xl border border-[#1E293B] bg-[var(--color-surface)]/50 overflow-hidden"
          >
            <div className="grid grid-cols-2 divide-x divide-[#1E293B]">
              {/* Pain */}
              <div className="p-5 bg-[rgba(239,68,68,0.04)]">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 rounded-full bg-[var(--color-danger)]/10 flex items-center justify-center">
                    <X size={14} className="text-[var(--color-danger)]" />
                  </div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-danger)]/70">Проблема</span>
                </div>
                <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">{item.pain}</p>
              </div>
              {/* Solution */}
              <div className="p-5 bg-[rgba(189,237,224,0.04)]">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 rounded-full bg-[var(--color-primary)]/10 flex items-center justify-center">
                    <Check size={14} className="text-[var(--color-primary-deep)]" />
                  </div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-primary-deep)]/70">Решение</span>
                </div>
                <p className="text-sm text-[var(--color-text-primary)] leading-relaxed">{item.solution}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </SectionWrapper>
  );
}
```

- [ ] **Step 2: Create before→after section**

```tsx
// frontend/src/features/landing/components/LandingBeforeAfter.tsx
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { FileSpreadsheet, FolderOpen, MessageCircle, BookOpen, Monitor, Search, BarChart3, Zap } from "lucide-react";
import { SectionWrapper } from "./SectionWrapper";
import { beforeItems, afterItems } from "../data/modules";

const beforeIcons = [FileSpreadsheet, FolderOpen, MessageCircle, BookOpen];
const afterIcons = [Monitor, Zap, Search, BarChart3];

export function LandingBeforeAfter() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: containerRef, offset: ["start end", "end start"] });
  const beforeOpacity = useTransform(scrollYProgress, [0.2, 0.5], [1, 0.3]);
  const afterOpacity = useTransform(scrollYProgress, [0.2, 0.5], [0.3, 1]);
  const afterScale = useTransform(scrollYProgress, [0.2, 0.5], [0.95, 1]);

  return (
    <SectionWrapper>
      <h2 className="text-3xl md:text-4xl font-extrabold text-center text-[var(--color-text-primary)] mb-4">
        Цифровая трансформация за один шаг
      </h2>
      <p className="text-center text-[var(--color-text-secondary)] mb-14 max-w-xl mx-auto">
        От хаоса к единой системе
      </p>

      <div ref={containerRef} className="grid md:grid-cols-2 gap-6">
        {/* BEFORE */}
        <motion.div
          style={{ opacity: beforeOpacity }}
          className="rounded-2xl border border-[#1E293B] bg-[var(--color-surface)]/30 p-8"
        >
          <span className="text-xs font-bold uppercase tracking-widest text-[var(--color-text-tertiary)] mb-6 block">Было</span>
          <div className="space-y-4">
            {beforeItems.map((item, i) => {
              const Icon = beforeIcons[i];
              return (
                <div key={i} className="flex items-center gap-3 opacity-60">
                  <div className="w-10 h-10 rounded-xl bg-[#1E293B] flex items-center justify-center">
                    <Icon size={18} className="text-[var(--color-text-tertiary)]" />
                  </div>
                  <span className="text-sm text-[var(--color-text-tertiary)]">{item}</span>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* AFTER */}
        <motion.div
          style={{ opacity: afterOpacity, scale: afterScale }}
          className="rounded-2xl border border-[var(--color-primary)]/20 bg-[rgba(189,237,224,0.04)] p-8"
        >
          <span className="text-xs font-bold uppercase tracking-widest text-[var(--color-primary-deep)] mb-6 block">Стало</span>
          <div className="space-y-4">
            {afterItems.map((item, i) => {
              const Icon = afterIcons[i];
              return (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[var(--color-primary)]/10 flex items-center justify-center">
                    <Icon size={18} className="text-[var(--color-primary-deep)]" />
                  </div>
                  <span className="text-sm text-[var(--color-text-primary)] font-medium">{item}</span>
                </div>
              );
            })}
          </div>
        </motion.div>
      </div>
    </SectionWrapper>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/landing/components/LandingPainSolution.tsx frontend/src/features/landing/components/LandingBeforeAfter.tsx
git commit -m "feat(landing): add pain-solution and before-after sections"
```

---

## Task 8: Modules grid section

**Files:**
- Create: `frontend/src/features/landing/components/LandingModules.tsx`

- [ ] **Step 1: Create modules grid**

```tsx
// frontend/src/features/landing/components/LandingModules.tsx
import { motion } from "framer-motion";
import { SectionWrapper } from "./SectionWrapper";
import { modules, groupColors, groupLabels, type Module } from "../data/modules";

function ModuleCard({ mod, index }: { mod: Module; index: number }) {
  const borderColor = groupColors[mod.group];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay: index * 0.04 }}
      whileHover={{ scale: 1.02 }}
      className="group relative rounded-2xl border border-[#1E293B] bg-[var(--color-surface)]/30 backdrop-blur-sm p-5 cursor-default transition-colors hover:border-opacity-50"
      style={{ "--hover-border": borderColor } as React.CSSProperties}
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
        style={{ background: `color-mix(in srgb, ${borderColor} 12%, transparent)` }}
      >
        <mod.icon size={20} style={{ color: borderColor }} />
      </div>
      <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-1">{mod.name}</h3>
      <p className="text-xs text-[var(--color-text-tertiary)] leading-relaxed opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        {mod.description}
      </p>
    </motion.div>
  );
}

export function LandingModules() {
  const groups = (["medicine", "management", "technology"] as const).map((g) => ({
    key: g,
    label: groupLabels[g],
    modules: modules.filter((m) => m.group === g),
  }));

  return (
    <SectionWrapper id="modules">
      <h2 className="text-3xl md:text-4xl font-extrabold text-center text-[var(--color-text-primary)] mb-4">
        16 модулей. Одна подписка.
      </h2>
      <p className="text-center text-[var(--color-text-secondary)] mb-14 max-w-xl mx-auto">
        Каждый работает отдельно и вместе с остальными
      </p>

      {groups.map((group) => (
        <div key={group.key} className="mb-10 last:mb-0">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-2 h-2 rounded-full" style={{ background: groupColors[group.key] }} />
            <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: groupColors[group.key] }}>
              {group.label}
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {group.modules.map((mod, i) => (
              <ModuleCard key={mod.name} mod={mod} index={i} />
            ))}
          </div>
        </div>
      ))}
    </SectionWrapper>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/landing/components/LandingModules.tsx
git commit -m "feat(landing): add modules grid with groups and hover effects"
```

---

## Task 9: Demo and Roles sections

**Files:**
- Create: `frontend/src/features/landing/components/LandingDemo.tsx`
- Create: `frontend/src/features/landing/components/LandingRoles.tsx`

- [ ] **Step 1: Create demo section**

```tsx
// frontend/src/features/landing/components/LandingDemo.tsx
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { SectionWrapper } from "./SectionWrapper";

export function LandingDemo() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "center center"] });
  const rotateX = useTransform(scrollYProgress, [0, 1], [8, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], [0.92, 1]);

  return (
    <SectionWrapper id="demo">
      <h2 className="text-3xl md:text-4xl font-extrabold text-center text-[var(--color-text-primary)] mb-4">
        Посмотрите как это работает
      </h2>
      <p className="text-center text-[var(--color-text-secondary)] mb-14 max-w-xl mx-auto">
        Единый интерфейс для всей клиники
      </p>

      <motion.div
        ref={ref}
        style={{ rotateX, scale, transformPerspective: 1200 }}
        className="rounded-2xl border border-[#1E293B] bg-[var(--color-surface)]/50 overflow-hidden shadow-[0_30px_80px_rgba(0,0,0,0.4)]"
      >
        {/* Browser chrome */}
        <div className="flex items-center gap-2 px-4 py-3 bg-[#141921] border-b border-[#1E293B]">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-[#EF4444]/60" />
            <div className="w-3 h-3 rounded-full bg-[#F59E0B]/60" />
            <div className="w-3 h-3 rounded-full bg-[#10B981]/60" />
          </div>
          <div className="flex-1 mx-4">
            <div className="h-6 rounded-md bg-[#0B0F14] flex items-center px-3">
              <span className="text-[10px] text-[var(--color-text-tertiary)]">app.medcore.kg/dashboard</span>
            </div>
          </div>
        </div>
        {/* Screenshot placeholder */}
        <div className="aspect-video bg-gradient-to-br from-[#0B0F14] to-[#141921] flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[var(--color-primary)]/20 to-[var(--color-secondary)]/20 flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">▶</span>
            </div>
            <p className="text-sm text-[var(--color-text-tertiary)]">Видео-демонстрация платформы</p>
          </div>
        </div>
      </motion.div>

      <div className="text-center mt-8">
        <p className="text-sm text-[var(--color-text-secondary)] mb-4">Хотите персональную демонстрацию?</p>
        <a
          href="#cta"
          className="inline-flex h-10 px-6 rounded-xl bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-deep)] items-center text-sm font-semibold text-[#0B0F14] hover:opacity-90 transition-opacity"
        >
          Заказать демо
        </a>
      </div>
    </SectionWrapper>
  );
}
```

- [ ] **Step 2: Create roles section**

```tsx
// frontend/src/features/landing/components/LandingRoles.tsx
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check } from "lucide-react";
import { SectionWrapper } from "./SectionWrapper";
import { roles } from "../data/modules";

export function LandingRoles() {
  const [activeRole, setActiveRole] = useState(roles[0].id);
  const current = roles.find((r) => r.id === activeRole)!;

  return (
    <SectionWrapper>
      <h2 className="text-3xl md:text-4xl font-extrabold text-center text-[var(--color-text-primary)] mb-4">
        Каждому — своё рабочее место
      </h2>
      <p className="text-center text-[var(--color-text-secondary)] mb-14 max-w-xl mx-auto">
        Один вход, разные возможности
      </p>

      {/* Tabs */}
      <div className="flex flex-wrap justify-center gap-2 mb-10">
        {roles.map((role) => {
          const isActive = role.id === activeRole;
          return (
            <button
              key={role.id}
              onClick={() => setActiveRole(role.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? "bg-[var(--color-surface)] border border-[#1E293B] text-[var(--color-text-primary)] shadow-lg"
                  : "text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]"
              }`}
            >
              <role.icon size={16} style={isActive ? { color: role.color } : undefined} />
              <span className="hidden sm:inline">{role.label}</span>
            </button>
          );
        })}
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={current.id}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3 }}
          className="max-w-lg mx-auto"
        >
          <div className="rounded-2xl border border-[#1E293B] bg-[var(--color-surface)]/30 p-8">
            <div className="flex items-center gap-3 mb-6">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: `color-mix(in srgb, ${current.color} 15%, transparent)` }}
              >
                <current.icon size={20} style={{ color: current.color }} />
              </div>
              <h3 className="text-lg font-bold text-[var(--color-text-primary)]">{current.label}</h3>
            </div>
            <ul className="space-y-3">
              {current.features.map((feature, i) => (
                <li key={i} className="flex items-start gap-3">
                  <div
                    className="mt-0.5 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: `color-mix(in srgb, ${current.color} 15%, transparent)` }}
                  >
                    <Check size={12} style={{ color: current.color }} />
                  </div>
                  <span className="text-sm text-[var(--color-text-secondary)] leading-relaxed">{feature}</span>
                </li>
              ))}
            </ul>
          </div>
        </motion.div>
      </AnimatePresence>
    </SectionWrapper>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/landing/components/LandingDemo.tsx frontend/src/features/landing/components/LandingRoles.tsx
git commit -m "feat(landing): add demo browser mockup and roles tabs sections"
```

---

## Task 10: Portal section with 3D phone

**Files:**
- Create: `frontend/src/features/landing/three/PhoneScene.tsx`
- Create: `frontend/src/features/landing/components/LandingPortal.tsx`

- [ ] **Step 1: Create 3D phone scene**

```tsx
// frontend/src/features/landing/three/PhoneScene.tsx
import { useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { RoundedBox, Float } from "@react-three/drei";
import * as THREE from "three";

function Phone() {
  return (
    <Float speed={2} rotationIntensity={0.15} floatIntensity={0.4}>
      <group>
        {/* Phone body */}
        <RoundedBox args={[1.6, 3, 0.15]} radius={0.15} smoothness={4}>
          <meshStandardMaterial color="#141921" roughness={0.3} metalness={0.8} />
        </RoundedBox>
        {/* Screen */}
        <RoundedBox args={[1.4, 2.7, 0.01]} radius={0.1} smoothness={4} position={[0, 0, 0.08]}>
          <meshStandardMaterial color="#0B0F14" roughness={0.9} emissive="#0B0F14" emissiveIntensity={0.2} />
        </RoundedBox>
        {/* Screen content lines */}
        {[0.8, 0.4, 0, -0.4, -0.8].map((y, i) => (
          <mesh key={i} position={[0, y, 0.09]}>
            <planeGeometry args={[1.1, 0.15]} />
            <meshBasicMaterial
              color={i % 2 === 0 ? "#BDEDE0" : "#7E78D2"}
              transparent
              opacity={0.08 + i * 0.02}
            />
          </mesh>
        ))}
        {/* Notch */}
        <mesh position={[0, 1.25, 0.09]}>
          <planeGeometry args={[0.5, 0.06]} />
          <meshBasicMaterial color="#0B0F14" />
        </mesh>
      </group>
    </Float>
  );
}

function VoiceBubble() {
  const ref = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.scale.setScalar(1 + Math.sin(clock.getElapsedTime() * 3) * 0.08);
    }
  });

  return (
    <mesh ref={ref} position={[1.3, -0.8, 0.2]}>
      <sphereGeometry args={[0.25, 16, 16]} />
      <meshStandardMaterial color="#BDEDE0" transparent opacity={0.3} emissive="#BDEDE0" emissiveIntensity={0.3} />
    </mesh>
  );
}

function PhoneParallax({ children }: { children: React.ReactNode }) {
  const groupRef = useRef<THREE.Group>(null);
  const { pointer } = useThree();

  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, pointer.x * 0.15, 0.05);
      groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, -pointer.y * 0.08, 0.05);
    }
  });

  return <group ref={groupRef}>{children}</group>;
}

function Scene() {
  return (
    <>
      <ambientLight intensity={0.4} />
      <pointLight position={[3, 3, 5]} intensity={0.6} color="#BDEDE0" />
      <pointLight position={[-3, -2, 3]} intensity={0.3} color="#7E78D2" />
      <PhoneParallax>
        <Phone />
        <VoiceBubble />
      </PhoneParallax>
    </>
  );
}

export function PhoneScene() {
  return (
    <div className="w-full h-[350px] md:h-[400px]">
      <Canvas
        camera={{ position: [0, 0, 5], fov: 40 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true }}
        style={{ background: "transparent" }}
      >
        <Scene />
      </Canvas>
    </div>
  );
}
```

- [ ] **Step 2: Create portal section**

```tsx
// frontend/src/features/landing/components/LandingPortal.tsx
import { Suspense, lazy } from "react";
import { motion } from "framer-motion";
import { Check, Mic } from "lucide-react";
import { SectionWrapper } from "./SectionWrapper";
import { portalFeatures } from "../data/modules";

const PhoneScene = lazy(() =>
  import("../three/PhoneScene").then((m) => ({ default: m.PhoneScene }))
);

function PhoneFallback() {
  return (
    <div className="w-full h-[350px] md:h-[400px] flex items-center justify-center">
      <div className="w-32 h-56 rounded-2xl border border-[#1E293B] bg-[#141921] animate-pulse" />
    </div>
  );
}

export function LandingPortal() {
  return (
    <SectionWrapper>
      <div className="grid md:grid-cols-2 gap-12 items-center">
        {/* Text */}
        <div>
          <h2 className="text-3xl md:text-4xl font-extrabold text-[var(--color-text-primary)] mb-4">
            Пациент всегда на связи
          </h2>
          <p className="text-[var(--color-text-secondary)] mb-8">
            Личный кабинет с голосовым управлением
          </p>
          <ul className="space-y-4">
            {portalFeatures.map((feature, i) => (
              <motion.li
                key={i}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
                className="flex items-start gap-3"
              >
                <div className="mt-0.5 w-5 h-5 rounded-full bg-[var(--color-primary)]/10 flex items-center justify-center flex-shrink-0">
                  <Check size={12} className="text-[var(--color-primary-deep)]" />
                </div>
                <span className="text-sm text-[var(--color-text-secondary)] leading-relaxed">{feature}</span>
              </motion.li>
            ))}
          </ul>
          {/* Voice highlight */}
          <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--color-primary)]/8 border border-[var(--color-primary)]/15">
            <Mic size={16} className="text-[var(--color-primary-deep)]" />
            <span className="text-sm text-[var(--color-primary-deep)] font-medium">Голосовой ассистент включён</span>
          </div>
        </div>

        {/* 3D Phone */}
        <Suspense fallback={<PhoneFallback />}>
          <PhoneScene />
        </Suspense>
      </div>
    </SectionWrapper>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/landing/three/PhoneScene.tsx frontend/src/features/landing/components/LandingPortal.tsx
git commit -m "feat(landing): add portal section with 3D floating phone"
```

---

## Task 11: IoT monitoring section with 3D room

**Files:**
- Create: `frontend/src/features/landing/three/RoomScene.tsx`
- Create: `frontend/src/features/landing/components/LandingMonitoring.tsx`

- [ ] **Step 1: Create 3D room scene**

```tsx
// frontend/src/features/landing/three/RoomScene.tsx
import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float } from "@react-three/drei";
import * as THREE from "three";

function Room() {
  return (
    <group>
      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1, 0]}>
        <planeGeometry args={[5, 4]} />
        <meshStandardMaterial color="#141921" />
      </mesh>
      {/* Back wall */}
      <mesh position={[0, 0.5, -2]}>
        <planeGeometry args={[5, 3]} />
        <meshStandardMaterial color="#1A202C" />
      </mesh>
      {/* Left wall */}
      <mesh position={[-2.5, 0.5, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[4, 3]} />
        <meshStandardMaterial color="#1A202C" transparent opacity={0.7} />
      </mesh>
    </group>
  );
}

function Bed() {
  return (
    <group position={[-0.5, -0.5, -0.5]}>
      {/* Frame */}
      <mesh>
        <boxGeometry args={[1.8, 0.3, 0.9]} />
        <meshStandardMaterial color="#1E293B" />
      </mesh>
      {/* Mattress */}
      <mesh position={[0, 0.2, 0]}>
        <boxGeometry args={[1.7, 0.1, 0.8]} />
        <meshStandardMaterial color="#0B0F14" />
      </mesh>
      {/* Pillow */}
      <mesh position={[-0.65, 0.3, 0]}>
        <boxGeometry args={[0.3, 0.08, 0.5]} />
        <meshStandardMaterial color="#1E293B" />
      </mesh>
    </group>
  );
}

function Sensor({ position, color }: { position: [number, number, number]; color: string }) {
  const ref = useRef<THREE.PointLight>(null);
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.intensity = 0.4 + Math.sin(clock.getElapsedTime() * 2 + position[0]) * 0.2;
    }
    if (meshRef.current) {
      meshRef.current.scale.setScalar(1 + Math.sin(clock.getElapsedTime() * 2 + position[0]) * 0.1);
    }
  });

  return (
    <Float speed={1.5} rotationIntensity={0} floatIntensity={0.1}>
      <group position={position}>
        <mesh ref={meshRef}>
          <sphereGeometry args={[0.08, 16, 16]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.8} />
        </mesh>
        <pointLight ref={ref} color={color} intensity={0.4} distance={2} />
      </group>
    </Float>
  );
}

function ConnectionLines() {
  const points = [
    [new THREE.Vector3(1.5, 0.5, -1.5), new THREE.Vector3(0, 0, 0.5)],
    [new THREE.Vector3(-2, 0.5, 0.5), new THREE.Vector3(0, 0, 0.5)],
    [new THREE.Vector3(1, 0.8, 0.5), new THREE.Vector3(0, 0, 0.5)],
  ];

  return (
    <>
      {points.map(([start, end], i) => {
        const geometry = new THREE.BufferGeometry().setFromPoints([start, end]);
        return (
          <line key={i}>
            <primitive object={geometry} attach="geometry" />
            <lineBasicMaterial color="#BDEDE0" transparent opacity={0.15} />
          </line>
        );
      })}
    </>
  );
}

function Scene() {
  return (
    <>
      <ambientLight intensity={0.2} />
      <pointLight position={[0, 3, 2]} intensity={0.4} color="#F1F5F9" />
      <group rotation={[0.3, -0.4, 0]}>
        <Room />
        <Bed />
        <Sensor position={[1.5, 0.5, -1.5]} color="#10B981" />
        <Sensor position={[-2, 0.5, 0.5]} color="#BDEDE0" />
        <Sensor position={[1, 0.8, 0.5]} color="#7E78D2" />
        <Sensor position={[-0.5, 1.2, -1.8]} color="#F59E0B" />
        <ConnectionLines />
      </group>
    </>
  );
}

export function RoomScene() {
  return (
    <div className="w-full h-[300px] md:h-[380px]">
      <Canvas
        camera={{ position: [0, 2, 5], fov: 40 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true }}
        style={{ background: "transparent" }}
      >
        <Scene />
      </Canvas>
    </div>
  );
}
```

- [ ] **Step 2: Create monitoring section**

```tsx
// frontend/src/features/landing/components/LandingMonitoring.tsx
import { Suspense, lazy } from "react";
import { motion } from "framer-motion";
import { SectionWrapper } from "./SectionWrapper";
import { monitoringStats } from "../data/modules";

const RoomScene = lazy(() =>
  import("../three/RoomScene").then((m) => ({ default: m.RoomScene }))
);

function RoomFallback() {
  return (
    <div className="w-full h-[300px] md:h-[380px] flex items-center justify-center">
      <div className="w-48 h-32 rounded-xl border border-[#1E293B] bg-[#141921] animate-pulse" />
    </div>
  );
}

export function LandingMonitoring() {
  return (
    <SectionWrapper>
      <h2 className="text-3xl md:text-4xl font-extrabold text-center text-[var(--color-text-primary)] mb-4">
        Умная палата в реальном времени
      </h2>
      <p className="text-center text-[var(--color-text-secondary)] mb-10 max-w-xl mx-auto">
        Каждый датчик на контроле. Каждый алерт — мгновенно.
      </p>

      {/* 3D Room */}
      <Suspense fallback={<RoomFallback />}>
        <RoomScene />
      </Suspense>

      {/* Stats */}
      <div className="flex flex-wrap justify-center gap-3 mt-6">
        {monitoringStats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.3, delay: i * 0.08 }}
            className="px-4 py-2 rounded-xl border border-[#1E293B] bg-[var(--color-surface)]/30"
          >
            <span className="text-xs font-semibold mr-2" style={{ color: stat.color }}>{stat.label}</span>
            <span className="text-sm font-bold text-[var(--color-text-primary)]">{stat.value}</span>
          </motion.div>
        ))}
      </div>

      <p className="text-center text-xs text-[var(--color-text-tertiary)] mt-6">
        10 типов датчиков · Алерты за &lt;1 сек · WebSocket real-time · Кнопка вызова медсестры
      </p>
    </SectionWrapper>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/landing/three/RoomScene.tsx frontend/src/features/landing/components/LandingMonitoring.tsx
git commit -m "feat(landing): add IoT monitoring section with 3D room scene"
```

---

## Task 12: Security, Integrations, Clients, CTA, Footer sections

**Files:**
- Create: `frontend/src/features/landing/components/LandingSecurity.tsx`
- Create: `frontend/src/features/landing/components/LandingIntegrations.tsx`
- Create: `frontend/src/features/landing/components/LandingClients.tsx`
- Create: `frontend/src/features/landing/components/LandingCTA.tsx`
- Create: `frontend/src/features/landing/components/LandingFooter.tsx`

- [ ] **Step 1: Create security section**

```tsx
// frontend/src/features/landing/components/LandingSecurity.tsx
import { motion } from "framer-motion";
import { SectionWrapper } from "./SectionWrapper";
import { securityItems } from "../data/modules";

export function LandingSecurity() {
  return (
    <SectionWrapper id="security">
      <h2 className="text-3xl md:text-4xl font-extrabold text-center text-[var(--color-text-primary)] mb-4">
        Медицинские данные под защитой
      </h2>
      <p className="text-center text-[var(--color-text-secondary)] mb-14 max-w-xl mx-auto">
        Безопасность на каждом уровне
      </p>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {securityItems.map((item, i) => (
          <motion.div
            key={item.title}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: i * 0.08 }}
            className="rounded-2xl border border-[#1E293B] bg-[#141921] p-6"
          >
            <div className="w-10 h-10 rounded-xl bg-[var(--color-primary)]/8 flex items-center justify-center mb-4">
              <item.icon size={20} className="text-[var(--color-primary-deep)]" />
            </div>
            <h3 className="text-sm font-bold text-[var(--color-text-primary)] mb-2">{item.title}</h3>
            <p className="text-xs text-[var(--color-text-tertiary)] leading-relaxed">{item.description}</p>
          </motion.div>
        ))}
      </div>
    </SectionWrapper>
  );
}
```

- [ ] **Step 2: Create integrations section**

```tsx
// frontend/src/features/landing/components/LandingIntegrations.tsx
import { motion } from "framer-motion";
import { SectionWrapper } from "./SectionWrapper";
import { integrations } from "../data/modules";

export function LandingIntegrations() {
  return (
    <SectionWrapper>
      <h2 className="text-3xl md:text-4xl font-extrabold text-center text-[var(--color-text-primary)] mb-4">
        Работает с тем, что у вас уже есть
      </h2>
      <p className="text-center text-[var(--color-text-secondary)] mb-14 max-w-xl mx-auto">
        Интеграции с оборудованием и сервисами
      </p>

      <div className="flex flex-wrap justify-center gap-4">
        {integrations.map((item, i) => (
          <motion.div
            key={item.name}
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.3, delay: i * 0.05 }}
            className="flex flex-col items-center gap-2 w-20"
          >
            <div className="w-14 h-14 rounded-2xl border border-[#1E293B] bg-[var(--color-surface)]/30 backdrop-blur-sm flex items-center justify-center hover:border-[var(--color-primary)]/30 transition-colors">
              <item.icon size={22} className="text-[var(--color-text-secondary)]" />
            </div>
            <span className="text-[10px] text-[var(--color-text-tertiary)] text-center leading-tight">{item.name}</span>
          </motion.div>
        ))}
      </div>
    </SectionWrapper>
  );
}
```

- [ ] **Step 3: Create clients section**

```tsx
// frontend/src/features/landing/components/LandingClients.tsx
import { SectionWrapper } from "./SectionWrapper";

const placeholderClinics = ["Клиника №1", "Мед. центр", "Поликлиника", "Госпиталь"];

export function LandingClients() {
  return (
    <SectionWrapper>
      <h2 className="text-3xl md:text-4xl font-extrabold text-center text-[var(--color-text-primary)] mb-14">
        Нам доверяют
      </h2>

      {/* Logo row */}
      <div className="flex justify-center gap-8 mb-12">
        {placeholderClinics.map((name) => (
          <div
            key={name}
            className="w-24 h-12 rounded-xl border border-[#1E293B] bg-[var(--color-surface)]/20 flex items-center justify-center opacity-40 hover:opacity-80 transition-opacity"
          >
            <span className="text-[10px] text-[var(--color-text-tertiary)]">{name}</span>
          </div>
        ))}
      </div>

      {/* Testimonial */}
      <blockquote className="max-w-2xl mx-auto text-center">
        <p className="text-lg md:text-xl text-[var(--color-text-secondary)] italic leading-relaxed mb-4">
          «MedCore заменил нам 8 разных программ. Теперь всё в одном месте — от регистратуры до лаборатории.»
        </p>
        <cite className="text-sm text-[var(--color-text-tertiary)] not-italic">
          — Главврач, Бишкек
        </cite>
      </blockquote>

      <div className="text-center mt-8">
        <a
          href="#cta"
          className="text-sm text-[var(--color-primary-deep)] hover:text-[var(--color-primary)] transition-colors font-medium"
        >
          Хотите стать одним из первых? →
        </a>
      </div>
    </SectionWrapper>
  );
}
```

- [ ] **Step 4: Create CTA section**

```tsx
// frontend/src/features/landing/components/LandingCTA.tsx
import { useState } from "react";
import { Phone, Building2, MessageSquare, Send, Mail } from "lucide-react";
import { SectionWrapper } from "./SectionWrapper";

export function LandingCTA() {
  const [phone, setPhone] = useState("");
  const [clinic, setClinic] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const message = `Заявка на демо: ${clinic}, тел: ${phone}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank");
  };

  return (
    <SectionWrapper id="cta">
      <div className="rounded-3xl border border-[var(--color-primary)]/15 bg-gradient-to-br from-[rgba(189,237,224,0.05)] to-[rgba(126,120,210,0.05)] p-8 md:p-14">
        <h2 className="text-3xl md:text-4xl font-extrabold text-center text-[var(--color-text-primary)] mb-3">
          Готовы к переменам?
        </h2>
        <p className="text-center text-[var(--color-text-secondary)] mb-10">
          Бесплатная демонстрация. Настройка за 1 день.
        </p>

        <form onSubmit={handleSubmit} className="max-w-md mx-auto space-y-4">
          <div className="relative">
            <Phone size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)]" />
            <input
              type="tel"
              placeholder="+996 XXX XXX XXX"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full h-12 pl-10 pr-4 rounded-xl border border-[#1E293B] bg-[#141921] text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-primary)]/40 transition-colors"
            />
          </div>
          <div className="relative">
            <Building2 size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)]" />
            <input
              type="text"
              placeholder="Название клиники"
              value={clinic}
              onChange={(e) => setClinic(e.target.value)}
              className="w-full h-12 pl-10 pr-4 rounded-xl border border-[#1E293B] bg-[#141921] text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-primary)]/40 transition-colors"
            />
          </div>
          <button
            type="submit"
            className="w-full h-12 rounded-xl bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-deep)] text-sm font-bold text-[#0B0F14] hover:opacity-90 transition-opacity shadow-[0_8px_30px_rgba(189,237,224,0.25)]"
          >
            Заказать демо
          </button>
        </form>

        <div className="flex justify-center gap-6 mt-8">
          <a href="#" className="flex items-center gap-2 text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] transition-colors">
            <MessageSquare size={14} /> WhatsApp
          </a>
          <a href="#" className="flex items-center gap-2 text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] transition-colors">
            <Send size={14} /> Telegram
          </a>
          <a href="mailto:info@medcore.kg" className="flex items-center gap-2 text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] transition-colors">
            <Mail size={14} /> info@medcore.kg
          </a>
        </div>
      </div>
    </SectionWrapper>
  );
}
```

- [ ] **Step 5: Create footer**

```tsx
// frontend/src/features/landing/components/LandingFooter.tsx
export function LandingFooter() {
  return (
    <footer className="border-t border-[#1E293B] py-8 px-4">
      <div className="mx-auto max-w-6xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-deep)] flex items-center justify-center text-xs font-extrabold text-[#0B0F14]">
            M
          </div>
          <span className="text-sm text-[var(--color-text-tertiary)]">
            © 2026 MedCore KG. Бишкек, Кыргызстан.
          </span>
        </div>
        <div className="flex gap-6">
          <a href="/login" className="text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] transition-colors">
            Вход для персонала
          </a>
          <a href="/portal/login" className="text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] transition-colors">
            Портал пациента
          </a>
        </div>
      </div>
    </footer>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/landing/components/LandingSecurity.tsx frontend/src/features/landing/components/LandingIntegrations.tsx frontend/src/features/landing/components/LandingClients.tsx frontend/src/features/landing/components/LandingCTA.tsx frontend/src/features/landing/components/LandingFooter.tsx
git commit -m "feat(landing): add security, integrations, clients, CTA, and footer sections"
```

---

## Task 13: Landing page route — assemble all sections

**Files:**
- Modify: `frontend/src/routes/index.tsx`

- [ ] **Step 1: Replace index.tsx with landing page**

Replace the entire contents of `frontend/src/routes/index.tsx`:

```tsx
// frontend/src/routes/index.tsx
import { createFileRoute, redirect } from "@tanstack/react-router";
import { LandingNavbar } from "@/features/landing/components/LandingNavbar";
import { LandingHero } from "@/features/landing/components/LandingHero";
import { LandingPainSolution } from "@/features/landing/components/LandingPainSolution";
import { LandingModules } from "@/features/landing/components/LandingModules";
import { LandingBeforeAfter } from "@/features/landing/components/LandingBeforeAfter";
import { LandingDemo } from "@/features/landing/components/LandingDemo";
import { LandingRoles } from "@/features/landing/components/LandingRoles";
import { LandingPortal } from "@/features/landing/components/LandingPortal";
import { LandingMonitoring } from "@/features/landing/components/LandingMonitoring";
import { LandingSecurity } from "@/features/landing/components/LandingSecurity";
import { LandingIntegrations } from "@/features/landing/components/LandingIntegrations";
import { LandingClients } from "@/features/landing/components/LandingClients";
import { LandingCTA } from "@/features/landing/components/LandingCTA";
import { LandingFooter } from "@/features/landing/components/LandingFooter";

export const Route = createFileRoute("/")({
  beforeLoad: ({ context }) => {
    if (context.auth.isAuthenticated) {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: LandingPage,
});

function LandingPage() {
  return (
    <div className="dark min-h-screen bg-[#0B0F14] text-[var(--color-text-primary)]">
      <LandingNavbar />
      <main>
        <LandingHero />
        <LandingPainSolution />
        <LandingModules />
        <LandingBeforeAfter />
        <LandingDemo />
        <LandingRoles />
        <LandingPortal />
        <LandingMonitoring />
        <LandingSecurity />
        <LandingIntegrations />
        <LandingClients />
        <LandingCTA />
      </main>
      <LandingFooter />
    </div>
  );
}
```

- [ ] **Step 2: Verify dev server starts**

```bash
cd frontend && pnpm dev
```

Expected: Vite starts on port 5173. Navigate to `http://localhost:5173/` in browser — landing page renders with all 12 sections and 3D scenes.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/routes/index.tsx
git commit -m "feat(landing): assemble all 12 sections into landing page route"
```

---

## Task 14: Smooth scroll and final polish

**Files:**
- Modify: `frontend/src/index.css`

- [ ] **Step 1: Add smooth scroll to index.css**

Add at the end of the `@layer base` block in `frontend/src/index.css`, after the closing `}` of the `body` rule but before the closing `}` of `@layer base`:

```css
  html {
    scroll-behavior: smooth;
  }
```

- [ ] **Step 2: Verify smooth scrolling**

Open `http://localhost:5173/` and click navbar links. Page should smooth-scroll to each section.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/index.css
git commit -m "feat(landing): add smooth scroll behavior"
```

---

## Task 15: Final verification

- [ ] **Step 1: Run type check**

```bash
cd frontend && pnpm tsc --noEmit
```

Expected: No type errors.

- [ ] **Step 2: Run build**

```bash
cd frontend && pnpm build
```

Expected: Build succeeds. Three.js scenes are in separate chunks.

- [ ] **Step 3: Verify all sections render**

Open `http://localhost:5173/` and scroll through all 12 sections:
1. Hero + 3D orbit ✓
2. Pain → Solution ✓
3. Modules grid ✓
4. Before → After ✓
5. Demo browser ✓
6. Roles tabs ✓
7. Portal + 3D phone ✓
8. Monitoring + 3D room ✓
9. Security ✓
10. Integrations ✓
11. Clients ✓
12. CTA form ✓

- [ ] **Step 4: Verify mobile responsive**

Open DevTools → toggle device toolbar → check iPhone 14 and iPad sizes. All sections should stack vertically, 3D fallbacks on small screens.

- [ ] **Step 5: Verify auth redirect still works**

If logged in, navigating to `/` should redirect to `/dashboard`.

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat(landing): complete premium landing page with 3D elements - 12 sections"
```
