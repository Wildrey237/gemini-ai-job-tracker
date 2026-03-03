# 🚀 AI Job Tracker - Automatisation du suivi de candidatures

Ce projet automatise le suivi des candidatures dans Google Sheets avec **Google Apps Script + Gemini + Gmail + Google Calendar**.

Il repose sur une logique de **"Zéro Pollution"** : le script n'écrit dans votre Sheet que s'il est sûr de l'entreprise, sinon il vous alerte par mail.

## 🛠️ Flux de travail pro (VS Code ↔ Google ↔ GitHub)

Le cycle recommandé pour maintenir le code :

1. Développer en local dans VS Code.
2. Synchroniser avec `clasp`.
3. Versionner avec Git/GitHub.

```bash
npm install -g @google/clasp
clasp login
clasp clone "ID_DU_SCRIPT"
clasp push

```

## ✅ Fonctionnalités Clés

* **Ajout & Enrichissement (S1)** : Détecte les confirmations d'envoi. Si l'entreprise existe déjà, il complète les infos manquantes (Poste, Lien, Lieu) sans créer de doublon.
* **Mise à jour Intelligente (S2)** : Détecte les réponses RH (Refus, Entretien, Accepté).
* **Matching Normalisé** : Compare les noms en ignorant les accents, les majuscules et les suffixes (Hiring Team, SAS, etc.). Capable de lier "NPX" à "Nuclear Promise X".
* **Anti-Pollution & Alerte** : Si une réponse est détectée mais que l'entreprise n'est pas dans le Sheet, le script envoie une **alerte mail directe** au lieu de polluer le tableau.
* **Anti-Quota (Rate Limit)** : Intègre des pauses de sécurité (2s) et un filtrage par Blacklist JSON pour éviter l'erreur 429.
* **Calendrier Auto** : Crée un événement Google Calendar avec le lien du mail en cas d'entretien.

## 📁 Fichiers du projet

* `add_candidature.js` : (Script 1) Analyse les envois. Utilise la **Blacklist JSON** pour ignorer les pubs LinkedIn.
* `update_candidature.js` : (Script 2) Analyse les réponses. Gère la **Triple Labellisation** Gmail.
* `api.js` : Gestion centralisée des appels Gemini (IA).
* `utils.js` : Fonctions partagées comme `normaliser()` (nettoyage des noms) et `nettoyerTexte()`.
* `logger.js` & `logs.js` : Journalisation détaillée des décisions du script (Matching, Rejets, Actions).
* `maintenance.js` : Nettoyage auto des logs (> 30 jours).

## ⚙️ Configuration & Prérequis

### 1. Script Properties (Paramètres Google)

* `SHEET_NAME` : Nom de l'onglet (ex: `Candidatures`).
* `GEMINI_KEY` : Votre clé API Google AI Studio.
* `MODEL_NAME` : Modèle utilisé (ex: `gemini-1.5-flash`).

### 2. Structure du Google Sheet

L'onglet principal doit comporter les colonnes **A à I** :
`Entreprise | Date | Poste | Statut | Lieu | Remarques | Relance | Lien | Date Réponse`

## 🏷️ Système de Labels Gmail

Le script utilise une labellisation granulaire pour un suivi visuel dans Gmail :

* **Ajout** : `IA-Candidature-Ajoutée`
* **Résultats** : `IA-Réponse-Refusée`, `IA-Réponse-Entretien`, `IA-Réponse-En-Cours`, `IA-Réponse-Acceptée`
* **Contrôle** : `IA-A-VÉRIFIER` (Cas ambigus)

## 🚨 Dépannage Rapide (FAQ)

| Erreur | Cause possible | Solution |
| --- | --- | --- |
| **Erreur 429** | Trop de requêtes IA en une minute. | Vérifier que `Utilities.sleep(2000)` est bien présent dans la boucle. |
| **Pas de mise à jour** | L'entreprise n'est pas en statut "En attente". | Le Script 2 ne traite QUE les lignes marquées "En attente". |
| **Doublons** | Le nom de l'entreprise varie trop. | Vérifier la fonction `normaliser()` ou ajouter le nom de l'expéditeur manuellement. |
| **Mails ignorés** | Adresse dans la Blacklist. | Vérifier la variable `CONFIG_FILTRES` dans le script. |

## 🔒 Sécurité

* Dépôt GitHub **Privé** obligatoire (contient des patterns de vos candidatures).
* Clés API stockées uniquement dans les **Script Properties** (jamais en dur dans le code).