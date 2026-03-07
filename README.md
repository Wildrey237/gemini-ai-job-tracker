# 🚀 AI Job Tracker - Automatisation du suivi & Sourcing de candidatures

Ce projet est un ecosystème complet pour gerer votre recherche d'emploi directement depuis Google Sheets. Il utilise **Google Apps Script + Gemini (1.5 Flash) + Gmail + Google Calendar**.

Il repose sur une logique de **"Zero Pollution"** et d'**"Inbox Zero"** : le script archive et trie vos mails automatiquement tout en extrayant les donnees strategiques.

## 🛠️ Flux de travail pro (VS Code ↔ Google ↔ GitHub)

Le cycle recommande pour maintenir le projet :

1. Developper en local dans VS Code.
2. Synchroniser avec `clasp` (`clasp push`).
3. Versionner avec Git/GitHub.

```bash
npm install -g @google/clasp
clasp login
clasp clone "ID_DU_SCRIPT"
clasp push
```

## ✅ Fonctionnalites Cles

- **Ajout & Enrichissement (S1)** : Detecte vos envois. Si l'entreprise existe deja, il complete les infos (Poste, Lien, Lieu).
- **Mise a jour Intelligente (S2)** : Analyse les reponses RH (Refus, Entretien, Acceptation) et met a jour le statut et la couleur de la ligne.
- **Sourcing Universel (S3)** : Scanne vos newsletters (LinkedIn, Glassdoor, etc.), extrait plusieurs offres par mail, et les classe par pertinence semantique.
- **Matching Normalise & Bilingue** : Gere les noms d'entreprises complexes (ex: `NPX` vs `Nuclear Promise X`) et comprend les mails en Francais et Anglais.
- **Formatage "Bouton"** : Les liens vers les offres sont inseres via la formule `=LIEN_HYPERTEXTE(...)` pour un tableau propre et cliquable.
- **Calendrier Auto** : Cree un evenement Google Calendar avec le lien du mail en cas d'entretien detecte.

## 📁 Fichiers du projet

- `add_candidature.js` : (S1) Analyse les confirmations d'envoi.
- `update_candidature.js` : (S2) Traite les reponses RH et gere la triple labellisation.
- `sourcing_jobs.js` : (S3) Nouveau. Aspire les newsletters selon vos criteres (Cibles, Contrats, Competences).
- `utils.js` : Cerveau utilitaire. Centralise `normaliserTexte()`, `safeValue()`, et la gestion des labels.
- `api.js` : Gestion centralisee des appels vers Gemini.
- `logger.js` : Journalisation des decisions (Matching, Rejets, Actions).

## ⚙️ Configuration & Prerequis

### 1. Script Properties (Parametres Google)

- `SHEET_NAME` : Nom de l'onglet de suivi (ex: `ing3`).
- `SHEET_NEWSLETTER_CONFIG` : Nom de l'onglet de configuration (ex: `config`).
- `GEMINI_KEY` : Votre cle API Google AI Studio.
- `MODEL_NAME` : `gemini-1.5-flash`.

### 2. Onglet `config` (Pilotage sans code)

L'onglet `config` permet de personnaliser la recherche sans toucher au script.

Colonnes recommandees :
`Cibles Metiers | Types de Contrat | Competences | Emails Newsletters | Flexibilite (Strict/Flexible)`

## 🏷️ Systeme de Labels Gmail

- **Candidatures** : `IA-Candidature-Ajoutee`
- **Reponses** : `IA-Reponse-Refusee`, `IA-Reponse-Entretien`, `IA-Reponse-Acceptee`
- **Sourcing** : `Newslatter-jobs-extraites` (archive automatiquement le mail apres lecture)

## 🚨 Depannage Rapide (FAQ)

| Erreur | Cause possible | Solution |
| --- | --- | --- |
| **Erreur 429** | Trop de requetes IA. | Le script inclut `Utilities.sleep(2000)` par defaut. |
| **Lien illisible** | URL trop longue. | Le script utilise `=LIEN_HYPERTEXTE(URL; "Acceder au lien")`. |
| **Offre ignoree (S3)** | Type de contrat non liste. | Le filtrage des contrats est `Strict` pour eviter les CDI si vous cherchez un stage. |
| **Doublons** | Entreprise deja listee. | Le script verifie les 100 dernieres lignes avant toute insertion. |

## 🔒 Securite

- Depot GitHub prive recommande.
- Cles API stockees uniquement dans les Script Properties.