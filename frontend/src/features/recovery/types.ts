export type RecoveryDomainKey = "VITALS" | "LABS" | "SCALES" | "EXERCISES" | "TREATMENT";

export interface RecoveryGoal {
  id: string;
  patient_id: string;
  domain: RecoveryDomainKey;
  metric_key: string;
  target_value: number | null;
  set_by_id: string;
  set_by_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface RecoveryDomainWeight {
  id: string;
  patient_id: string;
  domain: RecoveryDomainKey;
  weight: number;
  set_by_id: string;
  created_at: string;
  updated_at: string;
}

export interface DomainScore {
  domain: RecoveryDomainKey;
  score: number | null;
  trend: number | null;
  dataPoints: { date: string; value: number }[];
}

export interface RecoveryIndex {
  overall: number | null;
  trend: number | null;
  domains: DomainScore[];
  sparkline: { date: string; value: number }[];
}

export type PeriodKey = "7d" | "30d" | "3m" | "all" | "custom";

export interface PeriodRange {
  key: PeriodKey;
  from: Date;
  to: Date;
}
