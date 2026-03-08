# 🚀 AI Job Tracker - Écosystème de Suivi & Sourcing Intelligent

Ce projet transforme votre Google Sheets en un véritable **ATS (Applicant Tracking System)** personnel. Propulsé par **Gemini 1.5 Flash**, il automatise la lecture de vos emails Gmail pour suivre vos candidatures et dénicher de nouvelles opportunités.

## ✨ Nouvelles Fonctionnalités (V2.0)

* **Interface "Smart Menu"** : Un menu dédié dans Google Sheets qui s'adapte en temps réel (affiche "Activer" ou "Désactiver" selon l'état du script).
* **Onboarding Automatique** : À l'ouverture, le script détecte si une configuration est manquante et guide l'utilisateur pas à pas (Fenêtre d'instructions pour la clé API).
* **Système de Logs avec Tags** : Un onglet `logs` dédié qui trace chaque action avec des étiquettes claires (`CONFIG`, `UI_ACTION`, `ERREUR`, `AI_PROCESS`).
* **Verrouillage de Sécurité** : Empêche les exécutions simultanées pour éviter de corrompre les données ou de doubler les appels API.

## 🛠️ Installation Rapide (Pour vos amis)

1. **Copier le fichier** : `Fichier > Créer une copie` du Google Sheet Master.
2. **Autoriser** : Allez dans `Extensions > Apps Script`, sélectionnez `onOpen` et cliquez sur **Exécuter**. Acceptez les autorisations Google.
3. **Configurer** : Revenez sur le Sheet. Le menu **🚀 AI Job Tracker** apparaît.
* Cliquez sur `🔑 1. Configurer ma Clé API` (Lien direct : [Google AI Studio - API Keys](https://aistudio.google.com/api-keys)).
* Cliquez sur `⏰ 2. Activer l'automatisation`.



## ✅ Fonctionnalités Cœurs

* **Sourcing Universel (S3)** : Aspire les newsletters (LinkedIn, Welcome to the Jungle, etc.) et extrait les offres correspondant à vos critères.
* **Ajout & Enrichissement (S1)** : Détecte vos confirmations d'envoi et remplit automatiquement le tableau.
* **Mise à jour Intelligente (S2)** : Analyse les réponses RH. En cas d'entretien, crée un événement dans **Google Calendar** avec le lien du mail d'origine.
* **Logic de Matching** : Gère les noms d'entreprises complexes et nettoie les doublons sur les 100 dernières lignes.

## 📁 Structure du Projet

* `ui.gs` : **(Nouveau)** Gestion de l'interface, du menu dynamique et de l'onboarding.
* `logs.gs` : **(Nouveau)** Moteur de journalisation centralisé avec gestion des tags.
* `sourcing_jobs.js` : Extraction multi-offres depuis les newsletters.
* `add_candidature.js` : Analyse des mails sortants (confirmations).
* `update_candidature.js` : Traitement des mails entrants (réponses RH).
* `api.js` : Connecteur sécurisé vers Gemini 1.5 Flash.

## ⚙️ Configuration (Script Properties)

Le script utilise les **Propriétés du déclencheur** pour stocker les informations sensibles :

* `GEMINI_KEY` : Votre clé API secrète.
* `TRIGGERS_ACTIVATED` : État de l'automatisation (`true`/`false`).
* `IS_RUNNING` : Verrou de sécurité pour éviter les collisions.

## 🏷️ Système de Labels Gmail

Le script organise votre boîte mail automatiquement pour atteindre l'**Inbox Zero** :

* `IA-Candidature-Ajoutee` : Traité par le S1.
* `IA-Reponse-Entretien` / `IA-Reponse-Refusee` : Traité par le S2.
* `Newslatter-jobs-extraites` : Traité par le S3 (Archive le mail après lecture).

## 🚨 Dépannage (FAQ)

| Problème | Cause | Solution |
| --- | --- | --- |
| **Le menu n'apparaît pas** | Autorisation manquante. | Exécuter la fonction `onOpen` manuellement dans l'éditeur une fois. |
| **Bouton "Activer" reste là** | Témoin non synchronisé. | Cliquer sur "Activer" pour forcer la mise à jour de la propriété. |
| **Erreur de Quota (429)** | Trop d'appels API. | Le script intègre des pauses (`sleep`), vérifiez votre quota sur AI Studio. |

---

*Développé avec ❤️ pour rendre la recherche d'emploi moins chronophage.*

---