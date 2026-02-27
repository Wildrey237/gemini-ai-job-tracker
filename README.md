# 🚀 AI Job Tracker - Automatisation du suivi de candidatures

Ce projet automatise le suivi des candidatures dans Google Sheets avec **Google Apps Script + Gemini + Gmail + Google Calendar**.

Il couvre 3 blocs :
- détection des confirmations de candidature,
- mise à jour des réponses RH (refus / entretien),
- maintenance et journalisation.

## 🛠️ Flux de travail pro (VS Code ↔ Google ↔ GitHub)

Le cycle recommandé est le suivant :
1. Développer en local dans VS Code.
2. Synchroniser le code Apps Script avec `clasp`.
3. Versionner le dossier local avec Git/GitHub.

Commandes `clasp` essentielles :

```bash
npm install -g @google/clasp
clasp login
clasp clone "ID_DU_SCRIPT"
clasp pull
clasp push
```

## ✅ Fonctionnalités

- **Ajout & enrichissement** : détecte les mails de confirmation de candidature, ajoute une ligne dans la feuille et enrichit les doublons.
- **Mise à jour des réponses** : détecte les réponses RH, met à jour le statut et la date de réponse.
- **Calendrier auto** : crée un événement Google Calendar en cas d’entretien avec date/heure détectées.
- **Fallback IA** : marque les cas ambigus avec le label Gmail `IA-A-VÉRIFIER` + ligne de contrôle dans le sheet + mail d’alerte.
- **Maintenance** : purge les logs vieux de plus de 30 jours.

## 📁 Fichiers du projet (et rôle de chacun)

- `add_candidature.js` : script principal d’ajout (`analyserMailsCandidaturesEnvoyees`), collecte Gmail, extraction IA, anti-doublons, enrichissement de lignes.
- `update_candidature.js` : script principal de mise à jour (`analyserMailsReponsesRecues`), analyse des réponses, statut, remarques, labels Gmail, création d’événements Calendar.
- `api.js` : couche centralisée d’appel Gemini (`callGeminiCentral`), format JSON et gestion d’erreurs API.
- `logger.js` : logger universel `writeLog` + utilitaire `construireResumeFinal`.
- `logs.js` : logger complémentaire `enregistrerLog` pour écrire dans l’onglet `logs`.
- `maintenance.js` : nettoyage automatique des anciennes lignes de logs.
- `test_script1.js` : test d’insertion d’une candidature simulée via extraction IA.
- `test_script2.js` : test de mise à jour de statut sur une ligne existante.
- `appsscript.json` : manifeste Apps Script (timezone, runtime, logs d’exception).
- `.clasp.json` : configuration locale `clasp` (id du script, extensions, rootDir).

## 📋 Prérequis

- Un compte Google (Gmail, Sheets, Calendar, Apps Script).
- Node.js + `clasp`.
- Une clé Gemini API.
- Un dépôt GitHub (idéalement privé).

## ⚙️ Configuration Google Sheet

Créer un onglet principal (ex: `Candidatures`) avec les colonnes :
- A `Entreprise`
- B `Date`
- C `Poste`
- D `Statut`
- E `Lieu`
- F `Remarques`
- G `Relance`
- H `Lien`
- I `Date Réponse`

Créer aussi un onglet `logs` avec l’en-tête :
`Date | Heure | Fonction | Message | Erreur | Message d'erreur`

## 🔐 Script Properties requises

Dans les paramètres du projet Apps Script, définir :
- `SHEET_NAME` : nom de l’onglet principal (ex: `Candidatures`)
- `GEMINI_KEY` : clé API Gemini utilisée par `api.js`
- `MODEL_NAME` : modèle Gemini (ex: `gemini-1.5-flash`)

## ⏰ Triggers recommandés

- `analyserMailsCandidaturesEnvoyees` : toutes les heures
- `analyserMailsReponsesRecues` : toutes les 2 heures
- `maintenanceNettoyageLogs` : 1 fois par jour

## 🏷️ Labels Gmail utilisés

- `IA-Candidature-Ajoutée`
- `IA-Réponse-Traitée`
- `IA-A-VÉRIFIER`

## 🔒 Sécurité & bonnes pratiques

- Ne jamais écrire la clé Gemini en dur dans le code.
- Utiliser uniquement les Script Properties pour les secrets.
- Vérifier le contenu avant commit (`.clasp.json`, fichiers de test, etc.).
- Conserver le dépôt GitHub en privé si possible.

---

Si tu veux, je peux aussi ajouter une section **Dépannage rapide** (erreurs courantes + correctifs immédiats).