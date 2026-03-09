/**
 * 🚀 INTERFACE UTILISATEUR (UI) - MODE FULL SHEET CONFIG
 * Toutes les données (Clé API, Triggers, État) sont dans l'onglet "config".
 */

/**
 * Se lance automatiquement à l'ouverture du Sheet.
 */
function onOpen() {
    const ui = SpreadsheetApp.getUi();

    // Lecture des états via getParam (Remplace PropertiesService)
    const hasKey = getParam('GEMINI_KEY') !== null && getParam('GEMINI_KEY') !== "";
    const hasTriggers = getParam('TRIGGERS_ACTIVATED') === 'true';

    const menu = ui.createMenu('🚀 AI Job Tracker');

    // 1. GESTION DYNAMIQUE DE LA CLÉ API
    if (hasKey) {
        menu.addItem('❌ Supprimer ma Clé API', 'uiSupprimerCleAPI');
    } else {
        menu.addItem('🔑 Configurer ma Clé API', 'uiDemanderCleAPI');
    }

    // 2. GESTION DYNAMIQUE DE L'AUTOMATISATION
    if (hasTriggers) {
        menu.addItem('🚫 Désactiver l\'automatisation', 'uiSupprimerAutomatisation');
    } else {
        menu.addItem('⏰ Activer l\'automatisation', 'uiInstallerAutomatisation');
    }

    menu.addSeparator()
        .addItem('🔍 Lancer Sourcing (Manuel)', 'menuLancerSourcing')
        .addItem('🔄 Actualiser Réponses (Manuel)', 'menuLancerUpdate')
        .addItem('🤖 Détecter nouvelles Newsletters (Manuel)', 'menuLancerAutoConfig')
        .addSeparator()
        .addItem('🧹 Nettoyer les Logs', 'maintenanceNettoyageLogs')
        .addToUi();

    // Onboarding automatique si pas de clé
    if (!hasKey) {
        Utilities.sleep(1500);
        console.log("En attente de configuration de clé API dans l'onglet config...");
    }
}

/**
 * CONFIGURATION & INSTALLATION DES TRIGGERS
 */
function uiInstallerAutomatisation() {
    const ui = SpreadsheetApp.getUi();

    if (!getParam('GEMINI_KEY')) {
        ui.alert('❌ Stop !', 'Pas de clé API détectée dans l\'onglet config. Configurez-la d\'abord.', ui.ButtonSet.OK);
        return;
    }

    uiSupprimerAutomatisation(true);

    try {
        // --- Création des Triggers ---
        ScriptApp.newTrigger('analyserMailsCandidaturesEnvoyees').timeBased().everyDays(1).atHour(0).create();
        ScriptApp.newTrigger('analyserMailsReponsesRecues').timeBased().everyDays(1).atHour(3).create();
        ScriptApp.newTrigger('analyserNewslettersOpportunites').timeBased().everyDays(1).atHour(6).create();
        ScriptApp.newTrigger('detecterEtConfigurerNewsletters').timeBased().onWeekDay(ScriptApp.WeekDay.SUNDAY).atHour(21).create();
        ScriptApp.newTrigger('maintenanceNettoyageLogs').timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(9).create();

        // Mise à jour de l'état dans le Sheet
        setParam('TRIGGERS_ACTIVATED', 'true');

        ui.alert('✅ Système Activé', "L'automatisation a été configurée pour ce fichier.", ui.ButtonSet.OK);
        writeLog("uiInstallerAutomatisation", "Planning activé localement", "Non");
        onOpen();
    } catch (e) {
        ui.alert('❌ Erreur technique', e.toString(), ui.ButtonSet.OK);
        writeLog("uiInstallerAutomatisation", "Erreur triggers", "Oui", e.toString());
    }
}

/**
 * SUPPRESSION DES TRIGGERS
 */
function uiSupprimerAutomatisation(silencieux = false) {
    const triggers = ScriptApp.getProjectTriggers();

    triggers.forEach(t => ScriptApp.deleteTrigger(t));

    // Mise à jour de l'état dans le Sheet
    setParam('TRIGGERS_ACTIVATED', 'false');

    if (!silencieux) {
        SpreadsheetApp.getUi().alert('📴 Automatisations supprimées pour ce fichier.');
        writeLog("uiSupprimerAutomatisation", "Désactivation locale", "Non");
        onOpen();
    }
}

/**
 * GESTION DE LA CLÉ API
 */
function uiDemanderCleAPI() {
    const ui = SpreadsheetApp.getUi();
    const instructions = "Allez sur : https://aistudio.google.com/app/apikey\nCopiez votre clé et collez-la ci-dessous :";
    const response = ui.prompt('🔑 Configuration Clé Gemini', instructions, ui.ButtonSet.OK_CANCEL);

    if (response.getSelectedButton() == ui.Button.OK) {
        const key = response.getResponseText().trim();
        if (key !== "") {
            // Enregistrement dans le Sheet via setParam
            setParam('GEMINI_KEY', key);
            ui.alert('✅ Enregistré !', 'Clé configurée dans l\'onglet config.', ui.ButtonSet.OK);
            writeLog("uiDemanderCleAPI", "Mise à jour de la clé API", "Non", "Clé configurée via prompt utilisateur.");
            onOpen();
        } else {
            ui.alert('⚠️ Erreur', 'La clé ne peut pas être vide.', ui.ButtonSet.OK);
        }
    }
}

/**
 * SUPPRESSION DE LA CLÉ
 */
function uiSupprimerCleAPI() {
    const ui = SpreadsheetApp.getUi();
    const confirm = ui.alert('❌ Sécurité', 'Voulez-vous supprimer votre clé de l\'onglet config ?', ui.ButtonSet.YES_NO);

    if (confirm == ui.Button.YES) {
        // Suppression de la valeur dans le Sheet
        setParam('GEMINI_KEY', '');
        ui.alert('🗑️ Clé supprimée.', 'Le robot est désormais hors ligne.', ui.ButtonSet.OK);
        writeLog("uiSupprimerCleAPI", "Suppression manuelle de la clé API", "Non", "La clé a été effacée de l'onglet config.");
        onOpen();
    }
}

/**
 * WRAPPERS MANUELS
 */
function menuLancerSourcing() {
    executerAvecVerrou('analyserNewslettersOpportunites', 'Sourcing');
}

function menuLancerUpdate() {
    executerAvecVerrou('analyserMailsReponsesRecues', 'Update');
}

function menuLancerAutoConfig() {
    executerAvecVerrou('detecterEtConfigurerNewsletters', 'Config IA');
}

/**
 * MOTEUR D'EXÉCUTION SÉCURISÉ
 */
function executerAvecVerrou(nomFonction, labelLog) {
    const ui = SpreadsheetApp.getUi();

    if (getParam('IS_RUNNING') === 'true') {
        ui.alert('⏳ Une analyse est déjà en cours sur ce fichier.');
        return;
    }

    try {
        setParam('IS_RUNNING', 'true');

        // Appel de la fonction (doit être définie dans le même scope)
        const resultat = GlobalScope_Call(nomFonction);

        ui.alert('✅ Action terminée : ' + labelLog);
        writeLog(nomFonction, `Succès : ${labelLog}`, "Non", resultat || "");
    } catch (e) {
        ui.alert('❌ Erreur : ' + e.toString());
        writeLog(nomFonction, `ERREUR : ${labelLog}`, "Oui", e.toString());
    } finally {
        setParam('IS_RUNNING', 'false');
    }
}

/**
 * Helper pour appeler les fonctions même en mode bibliothèque
 */
function GlobalScope_Call(fnName) {
    return this[fnName]();
}