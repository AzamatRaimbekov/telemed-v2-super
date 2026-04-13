import type { RecoveryGoal, RecoveryDomainKey, DomainScore, RecoveryIndex } from "../types";

const VITAL_NORMS: Record<string, [number, number]> = {
  systolic_bp: [110, 140],
  diastolic_bp: [70, 90],
  pulse: [60, 100],
  spo2: [95, 100],
  temperature: [36.0, 37.2],
  blood_glucose: [3.9, 6.1],
  respiratory_rate: [12, 20],
};

const VITAL_KEYS = Object.keys(VITAL_NORMS);

interface ScaleConfig {
  lowerIsBetter: boolean;
  maxScore: number;
  goodThreshold: number;
}

const SCALE_CONFIGS: Record<string, ScaleConfig> = {
  NIHSS: { lowerIsBetter: true, maxScore: 42, goodThreshold: 0 },
  MRS: { lowerIsBetter: true, maxScore: 6, goodThreshold: 1 },
  BARTHEL: { lowerIsBetter: false, maxScore: 100, goodThreshold: 100 },
  MMSE: { lowerIsBetter: false, maxScore: 30, goodThreshold: 24 },
  BECK_DEPRESSION: { lowerIsBetter: true, maxScore: 63, goodThreshold: 9 },
  DYSPHAGIA: { lowerIsBetter: true, maxScore: 20, goodThreshold: 0 },
};

const DEFAULT_WEIGHTS: Record<RecoveryDomainKey, number> = {
  VITALS: 0.25,
  LABS: 0.25,
  TREATMENT: 0.20,
  SCALES: 0.15,
  EXERCISES: 0.15,
};

function scoreMetric(value: number, min: number, max: number): number {
  if (value >= min && value <= max) return 100;
  const rangeWidth = max - min;
  if (rangeWidth === 0) return value === min ? 100 : 0;
  const deviation = value < min ? min - value : value - max;
  const maxDeviation = rangeWidth * 2;
  const score = Math.max(0, 100 * (1 - deviation / maxDeviation));
  return Math.round(score * 10) / 10;
}

interface VitalRecord {
  recorded_at: string;
  systolic_bp?: number | null;
  diastolic_bp?: number | null;
  pulse?: number | null;
  spo2?: number | null;
  temperature?: number | null;
  blood_glucose?: number | null;
  respiratory_rate?: number | null;
}

export function calcVitalsScore(
  vitals: VitalRecord[],
  goals: RecoveryGoal[]
): { score: number | null; dataPoints: { date: string; value: number }[] } {
  if (vitals.length === 0) return { score: null, dataPoints: [] };

  const goalsMap = new Map(goals.filter((g) => g.domain === "VITALS").map((g) => [g.metric_key, g.target_value]));

  const dataPoints: { date: string; value: number }[] = [];

  for (const v of vitals) {
    const scores: number[] = [];
    for (const key of VITAL_KEYS) {
      const rawValue = v[key as keyof VitalRecord] as number | null | undefined;
      if (rawValue == null) continue;
      const goalTarget = goalsMap.get(key);
      let min: number, max: number;
      if (goalTarget != null) {
        min = goalTarget * 0.9;
        max = goalTarget * 1.1;
      } else {
        [min, max] = VITAL_NORMS[key];
      }
      scores.push(scoreMetric(rawValue, min, max));
    }
    if (scores.length > 0) {
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
      dataPoints.push({ date: v.recorded_at, value: Math.round(avg * 10) / 10 });
    }
  }

  const latest = dataPoints.length > 0 ? dataPoints[dataPoints.length - 1].value : null;
  return { score: latest, dataPoints };
}

interface LabResult {
  numeric_value?: number | null;
  reference_range?: string | null;
  is_abnormal?: boolean;
  resulted_at?: string | null;
  test_name?: string;
  test_code?: string;
}

function parseRefRange(ref: string | null | undefined): [number, number] | null {
  if (!ref) return null;
  const dashMatch = ref.match(/([\d.]+)\s*[-–]\s*([\d.]+)/);
  if (dashMatch) return [parseFloat(dashMatch[1]), parseFloat(dashMatch[2])];
  return null;
}

export function calcLabsScore(
  results: LabResult[],
  goals: RecoveryGoal[]
): { score: number | null; dataPoints: { date: string; value: number }[] } {
  if (results.length === 0) return { score: null, dataPoints: [] };

  const goalsMap = new Map(goals.filter((g) => g.domain === "LABS").map((g) => [g.metric_key, g.target_value]));

  const byTest = new Map<string, LabResult>();
  for (const r of results) {
    const key = r.test_code || r.test_name || "unknown";
    if (!byTest.has(key)) byTest.set(key, r);
  }

  let totalScore = 0;
  let totalWeight = 0;

  for (const [testKey, r] of byTest) {
    if (r.numeric_value == null) continue;

    const goalTarget = goalsMap.get(testKey);
    let range: [number, number] | null = null;

    if (goalTarget != null) {
      range = [goalTarget * 0.9, goalTarget * 1.1];
    } else {
      range = parseRefRange(r.reference_range);
    }

    if (!range) continue;

    const s = scoreMetric(r.numeric_value, range[0], range[1]);
    const weight = r.is_abnormal ? 2 : 1;
    totalScore += s * weight;
    totalWeight += weight;
  }

  const score = totalWeight > 0 ? Math.round((totalScore / totalWeight) * 10) / 10 : null;

  const dataPoints = results
    .filter((r) => r.numeric_value != null && r.resulted_at)
    .map((r) => {
      const range = parseRefRange(r.reference_range);
      const val = range ? scoreMetric(r.numeric_value!, range[0], range[1]) : 50;
      return { date: r.resulted_at!, value: val };
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return { score, dataPoints };
}

interface Assessment {
  assessment_type: string;
  score: number | null;
  max_score?: number | null;
  assessed_at: string | null;
}

export function calcScalesScore(
  assessments: Assessment[]
): { score: number | null; dataPoints: { date: string; value: number }[] } {
  if (assessments.length === 0) return { score: null, dataPoints: [] };

  const byType = new Map<string, Assessment[]>();
  for (const a of assessments) {
    if (a.score == null) continue;
    const list = byType.get(a.assessment_type) || [];
    list.push(a);
    byType.set(a.assessment_type, list);
  }

  if (byType.size === 0) return { score: null, dataPoints: [] };

  const typeScores: number[] = [];
  const dataPoints: { date: string; value: number }[] = [];

  for (const [type, items] of byType) {
    const config = SCALE_CONFIGS[type];
    if (!config) continue;

    const sorted = items.sort(
      (a, b) => new Date(a.assessed_at!).getTime() - new Date(b.assessed_at!).getTime()
    );

    for (const item of sorted) {
      const maxS = item.max_score ?? config.maxScore;
      let normalized: number;
      if (config.lowerIsBetter) {
        normalized = Math.max(0, Math.min(100, ((maxS - item.score!) / maxS) * 100));
      } else {
        normalized = Math.max(0, Math.min(100, (item.score! / maxS) * 100));
      }
      dataPoints.push({ date: item.assessed_at!, value: Math.round(normalized * 10) / 10 });
    }

    const latest = sorted[sorted.length - 1];
    const maxS = latest.max_score ?? config.maxScore;
    let latestNorm: number;
    if (config.lowerIsBetter) {
      latestNorm = Math.max(0, Math.min(100, ((maxS - latest.score!) / maxS) * 100));
    } else {
      latestNorm = Math.max(0, Math.min(100, (latest.score! / maxS) * 100));
    }
    typeScores.push(latestNorm);
  }

  const score = typeScores.length > 0
    ? Math.round((typeScores.reduce((a, b) => a + b, 0) / typeScores.length) * 10) / 10
    : null;

  dataPoints.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return { score, dataPoints };
}

interface ExerciseSession {
  accuracy_score?: number | null;
  started_at?: string | null;
  completed_at?: string | null;
}

export function calcExerciseScore(
  sessions: ExerciseSession[],
  expectedSessionsPerWeek: number = 5,
  periodDays: number = 30
): { score: number | null; dataPoints: { date: string; value: number }[] } {
  if (sessions.length === 0) return { score: null, dataPoints: [] };

  const withAccuracy = sessions.filter((s) => s.accuracy_score != null);
  if (withAccuracy.length === 0) return { score: null, dataPoints: [] };

  const avgAccuracy =
    withAccuracy.reduce((sum, s) => sum + s.accuracy_score!, 0) / withAccuracy.length;

  const expectedTotal = (periodDays / 7) * expectedSessionsPerWeek;
  const regularity = Math.min(100, (sessions.length / Math.max(1, expectedTotal)) * 100);

  const mid = Math.floor(withAccuracy.length / 2);
  let progress = 50;
  if (mid > 0) {
    const firstHalf = withAccuracy.slice(0, mid);
    const secondHalf = withAccuracy.slice(mid);
    const avgFirst = firstHalf.reduce((s, e) => s + e.accuracy_score!, 0) / firstHalf.length;
    const avgSecond = secondHalf.reduce((s, e) => s + e.accuracy_score!, 0) / secondHalf.length;
    const delta = avgSecond - avgFirst;
    progress = Math.max(0, Math.min(100, 50 + delta));
  }

  const score = Math.round((avgAccuracy * 0.4 + regularity * 0.3 + progress * 0.3) * 10) / 10;

  const dataPoints = withAccuracy
    .filter((s) => s.started_at || s.completed_at)
    .map((s) => ({
      date: (s.completed_at || s.started_at)!,
      value: s.accuracy_score!,
    }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return { score, dataPoints };
}

interface TreatmentPlan {
  status: string;
  items?: TreatmentItem[];
}

interface TreatmentItem {
  status: string;
  scheduled_at?: string | null;
}

export function calcTreatmentScore(
  plans: TreatmentPlan[]
): { score: number | null; dataPoints: { date: string; value: number }[] } {
  const activePlans = plans.filter((p) => p.status === "ACTIVE");
  if (activePlans.length === 0) return { score: null, dataPoints: [] };

  let totalItems = 0;
  let completedItems = 0;
  let overdueItems = 0;
  const now = new Date();

  for (const plan of activePlans) {
    const items = plan.items || [];
    for (const item of items) {
      if (item.status === "CANCELLED") continue;
      totalItems++;
      if (item.status === "COMPLETED") {
        completedItems++;
      } else if (
        item.status === "PENDING" &&
        item.scheduled_at &&
        new Date(item.scheduled_at) < now
      ) {
        overdueItems++;
      }
    }
  }

  if (totalItems === 0) return { score: null, dataPoints: [] };

  const completionPct = (completedItems / totalItems) * 100;
  const overduePenalty = (overdueItems / totalItems) * 20;
  const score = Math.max(0, Math.round((completionPct - overduePenalty) * 10) / 10);

  return { score, dataPoints: [] };
}

export function calcOverallIndex(
  domainScores: DomainScore[],
  customWeights: { domain: RecoveryDomainKey; weight: number }[]
): RecoveryIndex {
  const weightsMap = new Map<RecoveryDomainKey, number>();
  if (customWeights.length > 0) {
    for (const w of customWeights) weightsMap.set(w.domain, w.weight);
  }

  const available = domainScores.filter((d) => d.score !== null);
  if (available.length === 0) {
    return { overall: null, trend: null, domains: domainScores, sparkline: [] };
  }

  let totalWeight = 0;
  const effectiveWeights = new Map<RecoveryDomainKey, number>();
  for (const d of available) {
    const w = weightsMap.get(d.domain) ?? DEFAULT_WEIGHTS[d.domain] ?? 0;
    effectiveWeights.set(d.domain, w);
    totalWeight += w;
  }

  let overall = 0;
  for (const d of available) {
    const normalizedWeight = effectiveWeights.get(d.domain)! / totalWeight;
    overall += d.score! * normalizedWeight;
  }
  overall = Math.round(overall * 10) / 10;

  let trendSum = 0;
  let trendCount = 0;
  for (const d of available) {
    if (d.trend !== null) {
      const w = effectiveWeights.get(d.domain)! / totalWeight;
      trendSum += d.trend * w;
      trendCount++;
    }
  }
  const trend = trendCount > 0 ? Math.round(trendSum * 10) / 10 : null;

  const allPoints = new Map<string, { sum: number; count: number }>();
  for (const d of available) {
    for (const dp of d.dataPoints) {
      const dateKey = dp.date.slice(0, 10);
      const entry = allPoints.get(dateKey) || { sum: 0, count: 0 };
      entry.sum += dp.value;
      entry.count++;
      allPoints.set(dateKey, entry);
    }
  }
  const sparkline = Array.from(allPoints.entries())
    .map(([date, { sum, count }]) => ({ date, value: Math.round((sum / count) * 10) / 10 }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return { overall, trend, domains: domainScores, sparkline };
}
