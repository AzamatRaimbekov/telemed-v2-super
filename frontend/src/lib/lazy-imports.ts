/**
 * Lazy import helpers for code splitting.
 * Heavy pages are loaded on demand to reduce initial bundle.
 */
import { lazy } from "react";

// Heavy pages that benefit from code splitting
export const LazyReports = lazy(() => import("@/routes/_authenticated/reports"));
export const LazyPredictions = lazy(() => import("@/routes/_authenticated/predictions"));
export const LazyRBAC = lazy(() => import("@/routes/_authenticated/rbac"));
export const LazyScheduleCalendar = lazy(() => import("@/routes/_authenticated/schedule-calendar"));
export const LazySurgery = lazy(() => import("@/routes/_authenticated/surgery"));
