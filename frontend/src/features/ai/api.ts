import apiClient from "@/lib/api-client";

export interface DiagnosisSuggestInput {
  patient_id: string;
  symptoms: string;
  age?: number;
  sex?: string;
  existing_diagnoses?: string[];
}

export interface SuggestedDiagnosis {
  icd_code: string;
  title: string;
  confidence: number;
  reasoning: string;
}

export interface DiagnosisSuggestOutput {
  suggestions: SuggestedDiagnosis[];
  provider: string;
  model: string;
}

export interface ExamGenerateInput {
  patient_id: string;
  complaints: string;
  visit_type?: string;
}

export interface ExamGenerateOutput {
  examination_text: string;
  provider: string;
  model: string;
}

export interface PatientSummaryInput {
  patient_id: string;
}

export interface PatientSummaryOutput {
  summary: string;
  key_diagnoses: string[];
  key_medications: string[];
  risk_factors: string[];
  provider: string;
  model: string;
}

export interface ConclusionGenerateInput {
  patient_id: string;
  visit_id?: string;
  diagnoses?: string[];
  exam_notes?: string;
  treatment?: string;
}

export interface ConclusionGenerateOutput {
  conclusion_text: string;
  provider: string;
  model: string;
}

export const aiApi = {
  suggestDiagnoses: (data: DiagnosisSuggestInput): Promise<DiagnosisSuggestOutput> =>
    apiClient.post("/ai/diagnosis/suggest", data).then((r) => r.data),

  generateExam: (data: ExamGenerateInput): Promise<ExamGenerateOutput> =>
    apiClient.post("/ai/exam/generate", data).then((r) => r.data),

  summarizePatient: (data: PatientSummaryInput): Promise<PatientSummaryOutput> =>
    apiClient.post("/ai/summary/patient", data).then((r) => r.data),

  generateConclusion: (data: ConclusionGenerateInput): Promise<ConclusionGenerateOutput> =>
    apiClient.post("/ai/conclusion/generate", data).then((r) => r.data),
};
