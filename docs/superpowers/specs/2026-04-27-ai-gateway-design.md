# AI Gateway — Unified AI Module for MedCore KG

**Date:** 2026-04-27
**Status:** Approved
**Phase:** 1 (AI / Automation)

---

## Overview

Unified AI Gateway for MedCore KG — single entry point for all AI features across the platform. Multi-model architecture with auto-fallback between free API providers. All AI suggestions require explicit doctor approval before being written to patient records.

---

## Architecture

### AI Gateway (core service)

Single `AIGateway` class in the backend with three components:

- **ProviderRouter** — selects the best model for the task, handles fallback on failure, tracks rate limits per provider
- **PromptManager** — loads prompt templates from DB, renders with patient/context data, supports versioning
- **ResponseParser** — parses JSON from LLM responses, validates structure, handles malformed output

### Request Flow

```
Frontend → REST API (ai.py routes) → AIGateway
  → ProviderRouter picks provider by task type
  → PromptManager renders prompt template
  → Provider.complete(prompt) with 30s timeout
  → On failure: next provider in fallback chain
  → ResponseParser validates output
  → Save to ai_generated_content (accepted_by_doctor=null)
  → Return to frontend
```

### Providers (free tier)

| Provider | Strengths | Tier |
|----------|-----------|------|
| Gemini | Best free tier, multimodal (OCR) | powerful |
| Groq | Fastest inference, Llama/Mixtral | fast |
| DeepSeek | Good medical reasoning, cheap | powerful |
| OpenRouter | Aggregator, many free models | powerful |
| HuggingFace Inference API | Wide model selection | fast |
| Cloudflare Workers AI | Free tier, low latency | fast |

Auto-fallback order per task configured in `TASK_MODEL_MAP`.

---

## AI Features (4 groups, sequential delivery)

### Group A — Doctor's AI Assistant (first priority)

| Feature | Description | UI Location |
|---------|-------------|-------------|
| Exam auto-fill | Doctor enters complaints, AI generates structured exam | Patient → History |
| Diagnosis suggestion | Top-5 diagnoses with ICD-10 codes from symptoms | Patient → Diagnoses |
| Conclusion generation | Medical conclusion from exam data | Patient → Documents |
| History summarization | Brief summary of entire patient history | Patient → Overview |

### Group B — Document AI

| Feature | Description |
|---------|-------------|
| OCR prescriptions/referrals | Photo → structured data |
| Discharge summarization | Long discharge → brief summary |
| Document auto-generation | Template + patient data → ready document |

### Group C — Smart Automation

| Feature | Description |
|---------|-------------|
| Auto-suggest lab orders | Standard lab panel by diagnosis |
| Auto-suggest treatment plan | Treatment plan from clinical protocols |
| Smart scheduling | Optimal patient distribution across doctors/slots |

### Group D — Predictive Analytics

| Feature | Description |
|---------|-------------|
| Workload forecast | Patient flow prediction for the week ahead |
| Complication risk | Flags for high-risk patients |
| Readmission prediction | Which patients expected back and when |

---

## Data Model

### Table: ai_providers

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | PK |
| name | String | Provider name (gemini, groq, etc.) |
| base_url | String | API endpoint |
| api_key_env | String | Env var name for API key |
| is_active | Boolean | Enabled/disabled |
| priority | Integer | Default priority (lower = preferred) |
| rate_limit | Integer | Max requests per day |
| requests_today | Integer | Counter |
| reset_at | DateTime | When counter resets |

### Table: ai_prompt_templates

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | PK |
| task_type | String | diagnosis, summary, exam, conclusion, ocr, treatment, lab_suggest, predict |
| system_prompt | Text | System message |
| user_prompt_template | Text | User message template with {variables} |
| model_tier | String | fast or powerful |
| version | Integer | Template version |
| is_active | Boolean | Current active version |

### Table: ai_usage_log

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | PK |
| clinic_id | UUID | FK to clinics |
| user_id | UUID | FK to users (doctor) |
| patient_id | UUID | FK to patients (nullable) |
| task_type | String | What AI task was performed |
| provider_used | String | Which provider handled it |
| model_used | String | Specific model name |
| input_tokens | Integer | Tokens sent |
| output_tokens | Integer | Tokens received |
| latency_ms | Integer | Response time |
| success | Boolean | Did it succeed |
| error_message | Text | Error details if failed |
| created_at | DateTime | Timestamp |

### Table: ai_generated_content

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | PK |
| patient_id | UUID | FK to patients |
| task_type | String | What was generated |
| input_data | JSON | What was sent to AI |
| output_data | JSON | What AI returned |
| accepted_by_doctor | Boolean | null=pending, true=accepted, false=rejected |
| doctor_id | UUID | FK to users (who reviewed) |
| created_at | DateTime | Timestamp |

---

## API Endpoints

```
POST /api/v1/ai/diagnosis/suggest      — suggest diagnoses from symptoms
POST /api/v1/ai/exam/generate          — auto-fill exam from complaints
POST /api/v1/ai/summary/patient        — summarize patient history
POST /api/v1/ai/conclusion/generate    — generate medical conclusion
POST /api/v1/ai/document/ocr           — OCR from photo
POST /api/v1/ai/treatment/suggest      — suggest treatment plan
POST /api/v1/ai/lab-orders/suggest     — suggest lab orders by diagnosis
POST /api/v1/ai/schedule/optimize      — optimize schedule
POST /api/v1/ai/predict/workload       — workload forecast
POST /api/v1/ai/predict/risks          — complication risk assessment
GET  /api/v1/ai/usage                  — AI usage statistics
GET  /api/v1/ai/prompts                — list prompt templates (admin)
PUT  /api/v1/ai/prompts/{id}           — edit prompt template
```

---

## File Structure

```
backend/app/
  models/ai.py                          — SQLAlchemy models (4 tables)
  schemas/ai.py                         — Pydantic schemas
  services/ai/
    __init__.py
    gateway.py                          — AIGateway main class
    router.py                           — ProviderRouter (selection + fallback)
    prompt_manager.py                   — template loading and rendering
    response_parser.py                  — parse and validate LLM output
    providers/
      __init__.py
      base.py                           — BaseProvider abstract class
      gemini.py
      groq.py
      deepseek.py
      openrouter.py
      huggingface.py
      cloudflare.py
  api/v1/routes/ai.py                  — extend existing routes
```

---

## Configuration

### Environment Variables

```
GEMINI_API_KEY=
GROQ_API_KEY=
DEEPSEEK_API_KEY=
OPENROUTER_API_KEY=
HF_API_TOKEN=
CF_ACCOUNT_ID=
CF_API_TOKEN=
```

### Task-to-Model Routing

```python
TASK_MODEL_MAP = {
    "diagnosis":   {"tier": "powerful", "providers": ["gemini", "deepseek", "openrouter"]},
    "summary":     {"tier": "fast",     "providers": ["groq", "gemini", "cloudflare"]},
    "exam":        {"tier": "powerful", "providers": ["gemini", "deepseek", "openrouter"]},
    "conclusion":  {"tier": "fast",     "providers": ["groq", "gemini", "cloudflare"]},
    "ocr":         {"tier": "powerful", "providers": ["gemini", "openrouter"]},
    "treatment":   {"tier": "powerful", "providers": ["gemini", "deepseek", "openrouter"]},
    "lab_suggest": {"tier": "fast",     "providers": ["groq", "deepseek", "cloudflare"]},
    "predict":     {"tier": "fast",     "providers": ["groq", "gemini", "cloudflare"]},
}
```

### Fallback Logic

1. Pick first provider from task's provider list
2. Check rate-limit (not exceeded?)
3. Send request with 30s timeout
4. On error/timeout → next provider
5. All providers down → return "AI temporarily unavailable"
6. Log every attempt to ai_usage_log

---

## Key Principles

- **AI suggests, doctor approves** — nothing written to patient record without explicit acceptance
- **Language: Russian** — all prompts and responses in Russian
- **Free tier only** — no paid APIs, swap providers via config
- **Full audit** — every AI call logged with tokens, latency, provider
- **Graceful degradation** — if AI is down, the platform works normally without it
