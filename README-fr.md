# 🚀 AI Job Tracker — Personal ATS powered by Gmail, Sheets & Gemini

![Google Sheets](https://img.shields.io/badge/Google%20Sheets-Automatis%C3%A9-34A853?logo=googlesheets&logoColor=white)
![Google Apps Script](https://img.shields.io/badge/Apps%20Script-Production-4285F4?logo=googleappsscript&logoColor=white)
![Gemini 2.5 Flash](https://img.shields.io/badge/IA-Gemini%202.5%20Flash-1a73e8)
![Gmail](https://img.shields.io/badge/Gmail-Inbox%20Zero-EA4335?logo=gmail&logoColor=white)

## ✅ Commencer ici : dossier resultat du projet (Google Drive)

Dossier de resultat du projet :
https://drive.google.com/drive/folders/1pRYi3Nss2Gy3bquejA82tTFJLf0kGcnt?usp=share_link

Important :
- Copier le fichier ou l'ensemble du dossier dans votre propre Google Drive avant utilisation.
- Le dossier contient le mode d'emploi ainsi que le Google Sheet qui contient le code du projet.

## Presentation du projet

AI Job Tracker transforme Google Sheets en ATS personnel intelligent.

Le systeme automatise :

- la detection des candidatures envoyees
- l'analyse des reponses RH
- le sourcing automatique d'offres
- la detection automatique de newsletters emploi

Le tout fonctionne dans Google Workspace avec Gmail + Sheets + Apps Script + Gemini.

## 💡 Pourquoi ce projet

La recherche d'emploi est repetitive, chronophage et difficile a piloter. Ce projet transforme Gmail + Sheets en ATS intelligent pour centraliser le suivi et gagner du temps.

---

## 🎯 Objectif du projet

Automatiser jusqu'a 90% du suivi de recherche d'emploi.

| Tache | Automatisation |
| --- | --- |
| Detection des candidatures envoyees | ✅ |
| Analyse des reponses RH | ✅ |
| Detection d'entretiens | ✅ |
| Creation d'evenement Google Calendar | ✅ |
| Sourcing automatique d'offres | ✅ |
| Nettoyage Gmail (Inbox Zero) | ✅ |

---

## 🧠 Architecture globale

```text
		    Gmail
			|
			|
	+-----------v-----------+
	|  Google Apps Script   |
	|                       |
	|  S1 -> Candidatures   |
	|  S2 -> Reponses RH    |
	|  S3 -> Sourcing Jobs  |
	|                       |
	+-----------+-----------+
			|
			|
		Gemini AI
	(Extraction + Analyse)
			|
			|
	     Google Sheets
		(ATS personnel)
```

---

## ⚙️ Fonctionnement des pipelines

### 📩 Pipeline S1 — Candidatures envoyees

Script principal : `add_candidature.js`

Ce pipeline detecte automatiquement les confirmations d'envoi et enrichit le suivi.

- detecte les emails de confirmation ATS
- extrait entreprise / poste / lieu via IA
- evite les doublons
- enrichit les lignes existantes quand possible

### 🔄 Pipeline S2 — Reponses RH

Script principal : `update_candidature.js`

Ce pipeline classe les retours RH (refus, entretien, acceptation) et met a jour les statuts.

- detecte les messages de refus et entretien
- met a jour les statuts et la ligne associee
- cree un evenement Google Calendar en cas d'entretien

### 🔍 Pipeline S3 — Sourcing newsletters

Script principal : `sourcing_universel.js`

Ce pipeline analyse les newsletters et extrait plusieurs offres pertinentes.

- lit la config de `SHEET_NEWSLETTER_CONFIG`
- cherche les emails `newer_than:1d` (max `10` threads)
- filtre selon metier / contrat / competences
- insere les liens au format `=HYPERLINK("URL"; "Accéder au lien")`
- controle les doublons sur les `100` dernieres lignes
- labelise et archive tous les threads traites avec `Newslatter-jobs-extraites`

### 🤖 Auto-config newsletters

Fonction de reference : `detecterEtConfigurerNewsletters`

Le systeme peut detecter de nouvelles sources de newsletters et mettre a jour la configuration de sourcing.

Comportement actuel (dans `auto_config_newsletter.js`) :

- scan `newer_than:7d` (max `20` threads)
- exclusion des threads deja labels `Newslatter-jobs-extraites`
- ajout des expéditeurs valides dans la colonne D de la feuille config

---

## 🧰 Interface utilisateur

Menu Google Sheets dynamique : `🚀 AI Job Tracker`

- `🔑 Configurer ma Clé API`
- `⏰ Activer l'automatisation`
- `🔍 Lancer Sourcing (Manuel)`
- `🔄 Actualiser Réponses (Manuel)`
- `🤖 Détecter nouvelles Newsletters (Manuel)`
- `🧹 Nettoyer les Logs`

Le menu est gere par `interface.js` avec onboarding automatique et verrou anti-collision `IS_RUNNING`.

---

## ⏰ Planning automatique

Une fois activee, l'automatisation installe ce planning :

| Heure | Action | Fonction |
| --- | --- | --- |
| `00:00` | Scan candidatures envoyees | `analyserMailsCandidaturesEnvoyees` |
| `03:00` | Analyse des reponses RH | `analyserMailsReponsesRecues` |
| `06:00` | Sourcing automatique | `analyserNewslettersOpportunites` |
| `Dimanche 21:00` | Detection newsletters | `detecterEtConfigurerNewsletters` |
| `Lundi 09:00` | Nettoyage logs | `maintenanceNettoyageLogs` |

---

## 🛠 Installation rapide

1. Faites une copie du Google Sheet master.
2. Ouvrez `Extensions > Apps Script`.
3. Lancez `onOpen()` une premiere fois et acceptez les autorisations.
4. Dans le menu `🚀 AI Job Tracker`, cliquez sur `🔑 1. Configurer ma Clé API`.
5. Activez ensuite `⏰ 2. Activer l'automatisation`.

Si votre menu n'affiche pas de numerotation, utilisez :

- `🔑 Configurer ma Clé API`
- `⏰ Activer l'automatisation`

Creer une cle Gemini : [https://aistudio.google.com/api-keys](https://aistudio.google.com/api-keys)

Note : le prompt d'onboarding affiche actuellement `https://aistudio.google.com/app/apikey`.

---

## 📊 Configuration du sourcing

L'onglet configure via `SHEET_NEWSLETTER_CONFIG` permet de piloter l'IA sans toucher au code.

| Cibles metiers | Types de contrat | Competences | Email newsletter | Flexibilite |
| --- | --- | --- | --- | --- |
| `Data Analyst` | `CDI` | `Python, SQL` | `job-alerts@linkedin.com` | `Strict` |

### A quoi sert chaque colonne ?

- `Cibles metiers` : liste les intitulés de poste à rechercher en priorité.
	Exemple : `Data Analyst`, `BI Analyst`, `Product Data Analyst`.
- `Types de contrat` : filtre les offres selon le contrat souhaité.
	Exemple : `CDI`, `Stage`, `Alternance`.
- `Competences` : indique les technologies/mots-clés attendus dans l'offre.
	Exemple : `Python`, `SQL`, `Power BI`, `Tableau`.
- `Email newsletter` : adresse expéditrice à scanner dans Gmail.
	Exemple : `job-alerts@linkedin.com`, `jobalert@indeed.com`.
- `Flexibilite` : règle la tolérance du matching IA.
	`Strict` = correspondance stricte sur les critères.
	`Flexible` = plus souple sur le métier (synonymes FR/EN), mais contrat toujours contrôlé.

Conseil : mettez une valeur par cellule et répétez la ligne pour ajouter plusieurs métiers/contrats/compétences/sources.

## ⚙️ Parametres runtime (onglet `config`)

Le projet inclut maintenant des helpers de parametres dans `utils.js` :

- `getParam(cle)`
- `setParam(cle, valeur)`

`callGeminiCentral` (`api.js`) lit les parametres IA via `getParam` depuis une table cle/valeur dans l'onglet `config` :

- cle `GEMINI_KEY`
- cle `MODEL_NAME` (optionnelle, valeur par defaut : `gemini-2.5-flash`)

Format attendu dans `config` :

- colonne A : cle du parametre
- colonne B : valeur du parametre

## 📑 Structure de l'onglet principal (suivi candidatures)

Si vous partez d'un Google Sheet vide, creez les colonnes dans cet ordre :

| Colonne | Nom |
| --- | --- |
| A | Nom de l'entreprise |
| B | Date |
| C | Poste |
| D | Reponse |
| E | Lieux |
| F | Remarque |
| G | Postule ? |
| H | Lien |
| I | Date de reponse |
| J | Nb Messages |
| K | Date Relance |

Note : S1 et S2 s'appuient sur cet ordre de colonnes pour mettre a jour les lignes correctement.

## 📰 Structure de l'onglet newsletters (sourcing)

Pour l'onglet destination des offres issues des newsletters, utilisez cet ordre :

| Colonne | Nom |
| --- | --- |
| A | Nom de l'entreprise |
| B | Intitulé du poste |
| C | Ville / Télétravail. |
| D | Compétences |
| E | Lien |
| F | Date |
| G | Postule ? |

---

## 🔐 Securite & confidentialite

- approche local-first sur Google Workspace
- aucune base externe geree par le projet
- cle API utilisee par le connecteur IA lue depuis `config` via `getParam('GEMINI_KEY')`
- desactivation des triggers et suppression de cle disponibles depuis le menu

Script API central : `api.js`

---

## 📊 Logging & monitoring

Les actions sont journalisees via `logger.js` et `writeLog(...)`.

Format du log (onglet `logs`) :

- `Date`
- `Heure`
- `Fonction`
- `Message`
- `Erreur` (`Oui`/`Non`)
- `Message d'erreur`

Maintenance automatique : nettoyage periodique des logs via `maintenanceNettoyageLogs`.

---

## 📁 Structure du projet

- `interface.js` : UI dynamique, onboarding, triggers, verrou.
- `add_candidature.js` : pipeline S1 (candidatures envoyees).
- `update_candidature.js` : pipeline S2 (reponses RH).
- `sourcing_universel.js` : pipeline S3 (sourcing multi-offres).
- `api.js` : connecteur Gemini.
- `logger.js` : journalisation universelle (`writeLog`, `construireResumeFinal`).
- `maintenance.js` : routines de maintenance.

### Parametres runtime utilises (onglet `config`)

- `GEMINI_KEY`
- `MODEL_NAME`
- `SHEET_NAME`
- `TRIGGERS_ACTIVATED`
- `IS_RUNNING`
- `SHEET_NEWSLETTER`
- `SHEET_NEWSLETTER_CONFIG`

Note : ces parametres sont lus/ecrits via `getParam` et `setParam` (table cle/valeur dans l'onglet `config`).

### Label Gmail utilise

- `IA-Candidature-Ajoutée` : pose par S1 (`add_candidature.js`) quand une candidature est ajoutee/enrichie avec succes.
- `IA-Réponse-En-Cours` : label par defaut cote S2 (`utils.js`) pour une reponse RH en attente/indeterminee.
- `IA-Réponse-Refusée` : pose par S2 (`utils.js`) quand le verdict detecte est un refus.
- `IA-Réponse-Entretien` : pose par S2 (`utils.js`) quand un entretien/interview est detecte.
- `IA-Réponse-Acceptée` : pose par S2 (`utils.js`) quand une acceptation/offre est detectee.
- `Newslatter-jobs-extraites` : pose par S3 (`sourcing_universel.js`) apres traitement d'une newsletter, puis thread archive.

Note : ces labels sont aussi utilises dans les requetes Gmail pour exclure les emails deja traites.

---

## 🚨 Depannage

| Probleme | Solution |
| --- | --- |
| Menu invisible | Executer `onOpen()` manuellement une fois. |
| Erreur quota (429) | Reduire la frequence et verifier AI Studio. |
| Aucune offre detectee | Verifier l'onglet config (`metier`, `contrat`, `competences`, `emails`). |
| Script bloque | Attendre la fin si `IS_RUNNING=true`, puis relancer. |

### Debloquer le verrou `IS_RUNNING` (si une execution plante)

Si vous voyez en boucle "Une analyse est deja en cours" alors qu'aucun script ne tourne :

1. Ouvrez `Extensions > Apps Script` puis `Executions` et verifiez qu'aucune execution n'est encore active.
2. Ouvrez l'onglet `config` du classeur.
3. Recherchez la ligne de cle `IS_RUNNING` (colonne A).
4. Mettez sa valeur (colonne B) a `false`.
5. Revenez au menu `🚀 AI Job Tracker` et relancez l'action.

---

## 🗺 Roadmap v3.0

- [ ] Ghosting Killer (relance automatique)
- [ ] CV Matching Score
- [ ] Dashboard analytics
- [ ] Scoring entreprises
- [ ] Priorisation candidatures
- [ ] Recherche directe d'offres sur les sites recruteurs (pages Careers / Jobs)

---

## 🧑‍💻 Stack technique

- Google Apps Script
- Google Sheets
- Gmail
- Gemini AI
- Google Calendar

---

## 📄 Licence

Ce projet est publie sous licence MIT. Voir le fichier `LICENSE`.

---