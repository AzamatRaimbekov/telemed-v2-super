import { useQueries } from "@tanstack/react-query";
import { useMemo } from "react";
import { subDays, subMonths } from "date-fns";
import { patientsApi } from "@/features/patients/api";
import { recoveryApi } from "../api";
import {
  calcVitalsScore,
  calcLabsScore,
  calcScalesScore,
  calcExerciseScore,
  calcTreatmentScore,
  calcOverallIndex,
} from "../lib/recovery-calculator";
import type { PeriodKey, DomainScore, RecoveryIndex, RecoveryGoal, RecoveryDomainWeight } from "../types";

function getPeriodRange(key: PeriodKey, customFrom?: Date, customTo?: Date) {
  const to = customTo ?? new Date();
  let from: Date;
  switch (key) {
    case "7d": from = subDays(to, 7); break;
    case "30d": from = subDays(to, 30); break;
    case "3m": from = subMonths(to, 3); break;
    case "all": from = new Date(2000, 0, 1); break;
    case "custom": from = customFrom ?? subDays(to, 30); break;
  }
  return { from, to };
}

function filterByPeriod<T extends Record<string, unknown>>(
  items: T[],
  dateField: string,
  from: Date,
  to: Date
): T[] {
  return items.filter((item) => {
    const d = item[dateField];
    if (!d) return false;
    const date = new Date(d as string);
    return date >= from && date <= to;
  });
}

export function useRecoveryData(
  patientId: string,
  periodKey: PeriodKey = "30d",
  customFrom?: Date,
  customTo?: Date
) {
  const queries = useQueries({
    queries: [
      {
        queryKey: ["patient-vitals", patientId],
        queryFn: () => patientsApi.getVitals(patientId),
      },
      {
        queryKey: ["patient-lab-results", patientId],
        queryFn: () => patientsApi.getLabResults(patientId),
      },
      {
        queryKey: ["patient-stroke-assessments", patientId],
        queryFn: () => patientsApi.getStrokeAssessments(patientId),
      },
      {
        queryKey: ["patient-exercise-sessions", patientId],
        queryFn: () => patientsApi.getExerciseSessions(patientId),
      },
      {
        queryKey: ["patient-treatment-plans", patientId],
        queryFn: () => patientsApi.getTreatmentPlans(patientId),
      },
      {
        queryKey: ["patient-recovery-goals", patientId],
        queryFn: () => recoveryApi.getGoals(patientId),
      },
      {
        queryKey: ["patient-recovery-weights", patientId],
        queryFn: () => recoveryApi.getWeights(patientId),
      },
    ],
  });

  const isLoading = queries.some((q) => q.isLoading);
  const isError = queries.some((q) => q.isError);

  const [vitalsQ, labsQ, assessmentsQ, exercisesQ, plansQ, goalsQ, weightsQ] = queries;

  const recoveryIndex: RecoveryIndex | null = useMemo(() => {
    if (isLoading) return null;

    const { from, to } = getPeriodRange(periodKey, customFrom, customTo);
    const goals: RecoveryGoal[] = (goalsQ.data as RecoveryGoal[]) || [];
    const weights: RecoveryDomainWeight[] = (weightsQ.data as RecoveryDomainWeight[]) || [];

    const periodDays = Math.max(1, Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)));

    const vitals = filterByPeriod((vitalsQ.data || []) as Record<string, unknown>[], "recorded_at", from, to);
    const labs = filterByPeriod((labsQ.data || []) as Record<string, unknown>[], "resulted_at", from, to);
    const assessments = filterByPeriod((assessmentsQ.data || []) as Record<string, unknown>[], "assessed_at", from, to);
    const exercises = filterByPeriod((exercisesQ.data || []) as Record<string, unknown>[], "started_at", from, to);
    const plans = (plansQ.data || []) as Record<string, unknown>[];

    const vitalsResult = calcVitalsScore(vitals as never[], goals);
    const labsResult = calcLabsScore(labs as never[], goals);
    const scalesResult = calcScalesScore(assessments as never[]);
    const exerciseResult = calcExerciseScore(exercises as never[], 5, periodDays);
    const treatmentResult = calcTreatmentScore(plans as never[]);

    const prevFrom = new Date(from.getTime() - (to.getTime() - from.getTime()));
    const prevVitals = filterByPeriod((vitalsQ.data || []) as Record<string, unknown>[], "recorded_at", prevFrom, from);
    const prevLabs = filterByPeriod((labsQ.data || []) as Record<string, unknown>[], "resulted_at", prevFrom, from);
    const prevAssessments = filterByPeriod((assessmentsQ.data || []) as Record<string, unknown>[], "assessed_at", prevFrom, from);
    const prevExercises = filterByPeriod((exercisesQ.data || []) as Record<string, unknown>[], "started_at", prevFrom, from);

    const prevVitalsResult = calcVitalsScore(prevVitals as never[], goals);
    const prevLabsResult = calcLabsScore(prevLabs as never[], goals);
    const prevScalesResult = calcScalesScore(prevAssessments as never[]);
    const prevExerciseResult = calcExerciseScore(prevExercises as never[], 5, periodDays);

    function calcTrend(current: number | null, previous: number | null): number | null {
      if (current === null || previous === null) return null;
      return Math.round((current - previous) * 10) / 10;
    }

    const domainScores: DomainScore[] = [
      { domain: "VITALS", score: vitalsResult.score, trend: calcTrend(vitalsResult.score, prevVitalsResult.score), dataPoints: vitalsResult.dataPoints },
      { domain: "LABS", score: labsResult.score, trend: calcTrend(labsResult.score, prevLabsResult.score), dataPoints: labsResult.dataPoints },
      { domain: "SCALES", score: scalesResult.score, trend: calcTrend(scalesResult.score, prevScalesResult.score), dataPoints: scalesResult.dataPoints },
      { domain: "EXERCISES", score: exerciseResult.score, trend: calcTrend(exerciseResult.score, prevExerciseResult.score), dataPoints: exerciseResult.dataPoints },
      { domain: "TREATMENT", score: treatmentResult.score, trend: null, dataPoints: treatmentResult.dataPoints },
    ];

    return calcOverallIndex(
      domainScores,
      weights.map((w) => ({ domain: w.domain, weight: w.weight }))
    );
  }, [isLoading, periodKey, customFrom, customTo, vitalsQ.data, labsQ.data, assessmentsQ.data, exercisesQ.data, plansQ.data, goalsQ.data, weightsQ.data]);

  return {
    recoveryIndex,
    isLoading,
    isError,
    goals: (goalsQ.data as RecoveryGoal[]) || [],
    weights: (weightsQ.data as RecoveryDomainWeight[]) || [],
    rawData: {
      vitals: vitalsQ.data || [],
      labs: labsQ.data || [],
      assessments: assessmentsQ.data || [],
      exercises: exercisesQ.data || [],
      plans: plansQ.data || [],
    },
  };
}
