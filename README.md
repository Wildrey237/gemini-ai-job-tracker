# 🚀 AI Job Tracker — Personal ATS powered by Gmail, Sheets & Gemini

![Google Sheets](https://img.shields.io/badge/Google%20Sheets-Automated-34A853?logo=googlesheets&logoColor=white)
![Google Apps Script](https://img.shields.io/badge/Apps%20Script-Production-4285F4?logo=googleappsscript&logoColor=white)
![Gemini 2.5 Flash](https://img.shields.io/badge/AI-Gemini%202.5%20Flash-1a73e8)
![Gmail](https://img.shields.io/badge/Gmail-Inbox%20Zero-EA4335?logo=gmail&logoColor=white)

AI Job Tracker turns Google Sheets into a smart personal ATS.

The system automates:

- sent application detection
- HR reply analysis
- automatic job sourcing
- automatic job newsletter detection

Everything runs directly in Google Workspace with Gmail + Sheets + Apps Script + Gemini.

---

## 🎯 Project Goal

Automate up to 90% of day-to-day job search tracking.

| Task | Automated |
| --- | --- |
| Sent application detection | ✅ |
| HR reply analysis | ✅ |
| Interview detection | ✅ |
| Google Calendar event creation | ✅ |
| Automatic job sourcing | ✅ |
| Gmail cleanup (Inbox Zero) | ✅ |

---

## 🧠 High-Level Architecture

```text
            Gmail
              |
              |
    +---------v---------+
    | Google Apps Script|
    |                   |
    | S1 -> Applications|
    | S2 -> HR Replies  |
    | S3 -> Job Sourcing|
    |                   |
    +---------+---------+
              |
              |
          Gemini AI
    (Extraction + Analysis)
              |
              |
         Google Sheets
         (Personal ATS)
```

---

## ⚙️ Pipeline Overview

### 📩 Pipeline S1 — Sent Applications

Main script: `add_candidature.js`

This pipeline detects sent-application confirmations and enriches your tracking sheet.

- detects ATS confirmation emails
- extracts company / role / location with AI
- prevents duplicates
- enriches existing rows when possible

### 🔄 Pipeline S2 — HR Replies

Main script: `update_candidature.js`

This pipeline classifies HR outcomes (rejected, interview, accepted, in progress) and updates statuses.

- detects rejection and interview replies
- updates status and matching row
- creates a Google Calendar event for interviews

### 🔍 Pipeline S3 — Newsletter Sourcing

Main script: `sourcing_universel.js`

This pipeline analyzes newsletters and extracts multiple relevant offers.

- reads settings from `SHEET_NEWSLETTER_CONFIG`
- scans `newer_than:1d` emails (max `10` threads)
- filters by role / contract / skills
- inserts links using `=HYPERLINK("URL"; "Accéder au lien")`
- checks duplicates over the latest `100` rows
- labels and archives all processed threads with `Newslatter-jobs-extraites`

### 🤖 Auto-Config Newsletters

Reference function: `detecterEtConfigurerNewsletters`

The system can detect new newsletter sources and automatically update sourcing configuration.

Current behavior (from `auto_config_newsletter.js`):

- scans `newer_than:7d` emails (max `20` threads)
- excludes threads already labeled `Newslatter-jobs-extraites`
- writes newly approved senders into config column D

---

## 🧰 User Interface

Dynamic Google Sheets menu: `🚀 AI Job Tracker`

- `🔑 Configurer ma Clé API`
- `⏰ Activer l'automatisation`
- `🔍 Lancer Sourcing (Manuel)`
- `🔄 Actualiser Réponses (Manuel)`
- `🤖 Détecter nouvelles Newsletters (Manuel)`
- `🧹 Nettoyer les Logs`

The menu is managed by `interface.js` with automatic onboarding and collision lock `IS_RUNNING`.

---

## ⏰ Automatic Schedule

Once enabled, automation installs this schedule:

| Time | Action | Function |
| --- | --- | --- |
| `00:00` | Scan sent applications | `analyserMailsCandidaturesEnvoyees` |
| `03:00` | Analyze HR replies | `analyserMailsReponsesRecues` |
| `06:00` | Automatic sourcing | `analyserNewslettersOpportunites` |
| `Sunday 21:00` | Detect newsletters | `detecterEtConfigurerNewsletters` |
| `Monday 09:00` | Clean logs | `maintenanceNettoyageLogs` |

---

## 🛠 Quick Installation

1. Make a copy of the master Google Sheet.
2. Open `Extensions > Apps Script`.
3. Run `onOpen()` once and accept permissions.
4. In menu `🚀 AI Job Tracker`, click `🔑 1. Configurer ma Clé API`.
5. Then click `⏰ 2. Activer l'automatisation`.

If your menu does not include numbering, use:

- `🔑 Configurer ma Clé API`
- `⏰ Activer l'automatisation`

Create a Gemini API key: [https://aistudio.google.com/api-keys](https://aistudio.google.com/api-keys)

Note: the current onboarding prompt still displays `https://aistudio.google.com/app/apikey`.

---

## 📊 Sourcing Configuration

The sheet configured by `SHEET_NEWSLETTER_CONFIG` controls AI filtering without editing code.

| Target roles | Contract types | Skills | Newsletter email | Flexibility |
| --- | --- | --- | --- | --- |
| `Data Analyst` | `CDI` | `Python, SQL` | `job-alerts@linkedin.com` | `Strict` |

### What each column does

- `Target roles`: job titles to prioritize.
  Example: `Data Analyst`, `BI Analyst`, `Product Data Analyst`.
- `Contract types`: offer type filter.
  Example: `CDI`, `Stage`, `Alternance`.
- `Skills`: keywords/technologies expected in offers.
  Example: `Python`, `SQL`, `Power BI`, `Tableau`.
- `Newsletter email`: sender address to scan in Gmail.
  Example: `job-alerts@linkedin.com`, `jobalert@indeed.com`.
- `Flexibility`: AI matching strictness.
  `Strict` = strict matching on criteria.
  `Flexible` = more flexible role matching (FR/EN synonyms), while contract remains controlled.

Tip: use one value per cell and repeat rows to add more roles/contracts/skills/sources.

## ⚙️ Runtime Parameters (`config` sheet)

The project now includes parameter helpers in `utils.js`:

- `getParam(key)`
- `setParam(key, value)`

`callGeminiCentral` (`api.js`) reads AI runtime parameters via `getParam` from the `config` sheet key/value table:

- key `GEMINI_KEY`
- key `MODEL_NAME` (optional, default: `gemini-2.5-flash`)

Expected format in `config`:

- column A: parameter key
- column B: parameter value

## 📑 Main Sheet Structure (application tracking)

If you start from an empty Google Sheet, create columns in this exact order:

| Column | Header |
| --- | --- |
| A | Company name |
| B | Date |
| C | Role |
| D | Response |
| E | Location |
| F | Notes |
| G | Applied? |
| H | Link |
| I | Response date |
| J | Message count |
| K | Follow-up date |

Note: S1 and S2 rely on this column order to update rows correctly.

## 📰 Newsletter Sheet Structure (sourcing output)

For the destination sheet that stores sourced offers, use this order:

| Column | Header |
| --- | --- |
| A | Company name |
| B | Job title |
| C | City / Remote |
| D | Skills |
| E | Link |
| F | Date |
| G | Applied? |

---

## 🔐 Security & Privacy

- local-first approach within Google Workspace
- no external database managed by the project
- API key used by AI connector read from `config` via `getParam('GEMINI_KEY')`
- triggers can be disabled and API key can be removed from the menu

Central AI connector: `api.js`

---

## 📊 Logging & Monitoring

Actions are logged via `logger.js` and `writeLog(...)`.

Log format (sheet `logs`):

- `Date`
- `Heure`
- `Fonction`
- `Message`
- `Erreur` (`Oui`/`Non`)
- `Message d'erreur`

Automatic maintenance: periodic cleanup via `maintenanceNettoyageLogs`.

---

## 📁 Project Structure

- `interface.js`: dynamic UI, onboarding, triggers, lock.
- `add_candidature.js`: S1 pipeline (sent applications).
- `update_candidature.js`: S2 pipeline (HR replies).
- `sourcing_universel.js`: S3 pipeline (multi-offer sourcing).
- `api.js`: Gemini connector.
- `logger.js`: universal logging (`writeLog`, `construireResumeFinal`).
- `maintenance.js`: maintenance routines.

### Runtime Parameters Used (`config` sheet)

- `GEMINI_KEY`
- `MODEL_NAME`
- `SHEET_NAME`
- `TRIGGERS_ACTIVATED`
- `IS_RUNNING`
- `SHEET_NEWSLETTER`
- `SHEET_NEWSLETTER_CONFIG`

Note: these parameters are read/written through `getParam` and `setParam` (key/value table in the `config` sheet).

### Gmail labels used

- `IA-Candidature-Ajoutée`: set by S1 (`add_candidature.js`) when an application is successfully added/enriched.
- `IA-Réponse-En-Cours`: default S2 label (`utils.js`) for pending/undetermined HR replies.
- `IA-Réponse-Refusée`: set by S2 (`utils.js`) when a rejection is detected.
- `IA-Réponse-Entretien`: set by S2 (`utils.js`) when an interview is detected.
- `IA-Réponse-Acceptée`: set by S2 (`utils.js`) when an acceptance/offer is detected.
- `Newslatter-jobs-extraites`: set by S3 (`sourcing_universel.js`) after newsletter processing, then thread is archived.

Note: these labels are also used in Gmail queries to exclude already processed emails.

---

## 🚨 Troubleshooting

| Problem | Solution |
| --- | --- |
| Menu not visible | Run `onOpen()` manually once. |
| Quota error (429) | Reduce frequency and check AI Studio quota. |
| No offers found | Check config sheet (`role`, `contract`, `skills`, `emails`). |
| Script appears stuck | Wait if `IS_RUNNING=true`, then run again. |

### Unlock `IS_RUNNING` (if an execution crashes)

If you keep seeing "An analysis is already running" while nothing is actually running:

1. Open `Extensions > Apps Script`, then open `Executions` and verify there is no active run.
2. Open the workbook `config` sheet.
3. Find key `IS_RUNNING` in column A.
4. Set its value in column B to `false`.
5. Run the action again from the `🚀 AI Job Tracker` menu.

---

## 🗺 Roadmap v3.0

- [ ] Ghosting Killer (automatic follow-up)
- [ ] CV Matching Score
- [ ] Analytics dashboard
- [ ] Company scoring
- [ ] Application prioritization
- [ ] Direct job search on recruiter websites (Careers / Jobs pages)

---

## 🧑‍💻 Tech Stack

- Google Apps Script
- Google Sheets
- Gmail
- Gemini AI
- Google Calendar

---

## 📄 License

To be defined (add a `LICENSE` file before open-source publication).

---

## 💡 Why this project

Modern job search is repetitive, time-consuming, and hard to track. AI Job Tracker turns Gmail + Sheets into a smart ATS to centralize follow-up and save time.