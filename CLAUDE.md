# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Project Is

An automated job search ATS built entirely on Google Apps Script. It connects Gmail, Google Sheets, Google Calendar, and Gemini AI to track job applications, analyze HR replies, and extract job leads from newsletters — with no external server or database.

## Platform & Runtime

- **Language:** Google Apps Script (V8 runtime), JavaScript syntax
- **No npm, no build step, no local execution** — all code runs inside Google's cloud
- `.clasp.json` configures the Apps Script project ID for deployment via `clasp`
- `appsscript.json` declares OAuth scopes required by the project
- To deploy: use `clasp push` (requires `clasp` CLI and prior `clasp login`)
- To test manually: open the Apps Script editor, select a function, and click Run

## Architecture: Three Processing Pipelines

All runtime config lives in the "config" Google Sheet (key-value pairs). All AI calls are centralized through `api.js`. All logging goes to the "logs" sheet via `logger.js`.

### Pipeline S1 — `add_candidature.js`
Detects sent applications from Gmail confirmation emails.
Flow: Gmail query → Gemini extraction (company, role, location) → insert row in main tracking sheet → apply Gmail label `IA-Candidature-Ajoutée`.

### Pipeline S2 — `update_candidature.js`
Analyzes HR replies to classify outcomes.
Flow: Gmail query for replies to known senders → Gemini verdict classification → update status column in sheet → create Google Calendar event for interviews → apply verdict label.

### Pipeline S3 — `sourcing_universel.js`
Extracts job offers from newsletter emails.
Flow: Gmail query on configured newsletter sources → Gemini multi-offer extraction → insert into newsletter sheet → deduplicate against last 100 rows → archive thread with label `Newslatter-jobs-extraites`.

### Supporting Files

| File | Role |
|---|---|
| `interface.js` | Menu creation, trigger management, API key dialog, execution lock |
| `api.js` | `callGeminiCentral(promptText)` — single Gemini connector |
| `utils.js` | `getParam(key)`, `setParam(key, value)`, text normalization, Gmail label helpers |
| `logger.js` | `writeLog(function, message, hasError, errorMsg)` → writes to "logs" sheet |
| `maintenance.js` | Log cleanup (rows older than 30 days) |
| `auto_config_newsletter.js` | Auto-detects newsletter senders from Gmail |
| `test_script1.js`, `test_script2.js` | Manual test functions run from the Apps Script editor |

## Key Patterns

**Config access:** Always use `getParam('KEY')` / `setParam('KEY', value)` — never hardcode sheet names or API keys. Critical keys: `GEMINI_KEY`, `MODEL_NAME`, `SHEET_NAME`, `SHEET_NEWSLETTER`, `SHEET_NEWSLETTER_CONFIG`, `TRIGGERS_ACTIVATED`, `IS_RUNNING`.

**Execution lock:** `IS_RUNNING` flag in config prevents concurrent executions. The `executerAvecVerrou()` wrapper in `interface.js` manages this.

**AI calls:** All pipelines call `callGeminiCentral()` which reads key/model from config, sets temperature 0.1, and expects JSON responses. Rate limiting: `Utilities.sleep(2000)` between calls.

**Deduplication:** S1 normalizes company names via `normaliserTexte()` before comparing. S2 matches by company + subject + sender domain. S3 checks last 100 sheet rows for (company, title) pairs.

**Language:** Code, variable names, and log messages are primarily in French (entreprise, poste, lieu, verdict, candidature, etc.).

## Scheduled Triggers (when automation is active)

- `00:00` — S1: scan sent applications
- `03:00` — S2: analyze HR replies
- `06:00` — S3: newsletter sourcing
- `Sunday 21:00` — auto-detect newsletter sources
- `Monday 09:00` — clean logs

Triggers are managed by `uiInstallerAutomatisation()` in `interface.js`.

## Gmail Labels Used

`IA-Candidature-Ajoutée`, `IA-Réponse-Refusée`, `IA-Réponse-Entretien`, `IA-Réponse-Acceptée`, `IA-Réponse-En-Cours`, `Newslatter-jobs-extraites`
