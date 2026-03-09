/**
 * 🚀 AI JOB TRACKER - INTERFACE UTILISATEUR (UI)
 * * Ce module gère l'affichage du menu personnalisé, la configuration de la clé API,
 * et l'activation des processus automatisés. 
 * * Note : Toutes les configurations sont stockées dans l'onglet "config" du Sheet,
 * rendant le système indépendant des Script Properties (sauf identifiant de bibliothèque).
 */

/**
 * Initialise le menu personnalisé à l'ouverture du Google Sheet.
 * Utilise getParam pour basculer dynamiquement entre "Activer" et "Désactiver".
 */
function onOpen() {
    const ui = SpreadsheetApp.getUi();
    
    // 1. Force l'écriture de tout changement en attente
    SpreadsheetApp.flush();

    // 2. Récupération directe pour éviter tout problème de cache
    const valKey = getParam('GEMINI_KEY');
    const valTriggers = getParam('TRIGGERS_ACTIVATED');

    // On normalise en minuscules pour la comparaison
    const hasKey = valKey !== null && valKey !== "";
    const hasTriggers = (valTriggers !== null && valTriggers.toString().toUpperCase() === 'TRUE');

    const menu = ui.createMenu('🚀 AI Job Tracker');

    // GESTION CLÉ API
    if (hasKey) {
        menu.addItem('❌ Supprimer ma Clé API', 'uiSupprimerCleAPI');
    } else {
        menu.addItem('🔑 Configurer ma Clé API', 'uiDemanderCleAPI');
    }

    // GESTION AUTOMATISATION (Le Switch)
    if (hasTriggers) {
        menu.addItem('🚫 Désactiver l\'automatisation', 'uiSupprimerAutomatisation');
    } else {
        menu.addItem('⏰ Activer l\'automatisation', 'uiInstallerAutomatisation');
    }

    // ... reste du menu ...
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
 * Crée les déclencheurs (Triggers) temporels pour automatiser les scans Gmail.
 * Met à jour 'TRIGGERS_ACTIVATED' à 'true' dans l'onglet config.
 */
function uiInstallerAutomatisation() {
    const ui = SpreadsheetApp.getUi();

    if (!getParam('GEMINI_KEY')) {
        ui.alert('❌ Stop !', 'Pas de clé API détectée dans l\'onglet config. Configurez la clé d\'abord.', ui.ButtonSet.OK);
        return;
    }

    // Nettoyage de sécurité pour éviter les doublons de triggers
    uiSupprimerAutomatisation(true);

    try {
        // Définition du planning de maintenance et de scan
        ScriptApp.newTrigger('analyserMailsCandidaturesEnvoyees').timeBased().everyDays(1).atHour(0).create();
        ScriptApp.newTrigger('analyserMailsReponsesRecues').timeBased().everyDays(1).atHour(3).create();
        ScriptApp.newTrigger('analyserNewslettersOpportunites').timeBased().everyDays(1).atHour(6).create();
        ScriptApp.newTrigger('detecterEtConfigurerNewsletters').timeBased().onWeekDay(ScriptApp.WeekDay.SUNDAY).atHour(21).create();
        ScriptApp.newTrigger('maintenanceNettoyageLogs').timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(9).create();

        // Enregistre l'état et force la mise à jour pour le menu
        setParam('TRIGGERS_ACTIVATED', 'true');
        SpreadsheetApp.flush(); 
        
        ui.alert('✅ Système Activé', "L'automatisation a été configurée avec succès.", ui.ButtonSet.OK);
        writeLog("uiInstallerAutomatisation", "Planning activé localement", "Non");
        
        // Rafraîchit le menu immédiatement
        onOpen(); 
    } catch (e) {
        ui.alert('❌ Erreur technique', e.toString(), ui.ButtonSet.OK);
        writeLog("uiInstallerAutomatisation", "Erreur triggers", "Oui", e.toString());
    }
}

/**
 * Supprime tous les déclencheurs actifs du projet.
 * Met à jour 'TRIGGERS_ACTIVATED' à 'false' dans l'onglet config.
 * @param {boolean} silencieux Si vrai, n'affiche pas d'alerte UI (utile pour le reset interne).
 */
function uiSupprimerAutomatisation(silencieux = false) {
    const triggers = ScriptApp.getProjectTriggers();
    triggers.forEach(t => ScriptApp.deleteTrigger(t));
    
    setParam('TRIGGERS_ACTIVATED', 'false');
    SpreadsheetApp.flush(); 

    if (!silencieux) {
        SpreadsheetApp.getUi().alert('📴 Automatisations désactivées pour ce fichier.');
        writeLog("uiSupprimerAutomatisation", "Désactivation locale", "Non");
        onOpen();
    }
}

/**
 * Ouvre une boîte de dialogue pour saisir la clé Google AI (Gemini).
 * Enregistre la clé dans l'onglet "config".
 */
function uiDemanderCleAPI() {
    const ui = SpreadsheetApp.getUi();
    const instructions = "Allez sur : https://aistudio.google.com/app/apikey\nCopiez votre clé et collez-la ci-dessous :";
    const response = ui.prompt('🔑 Configuration Clé Gemini', instructions, ui.ButtonSet.OK_CANCEL);

    if (response.getSelectedButton() == ui.Button.OK) {
        const key = response.getResponseText().trim();
        if (key !== "") {
            setParam('GEMINI_KEY', key);
            SpreadsheetApp.flush(); 
            ui.alert('✅ Enregistré !', 'La clé est maintenant active.', ui.ButtonSet.OK);
            writeLog("uiDemanderCleAPI", "Mise à jour Clé API", "Non");
            onOpen();
        } else {
            ui.alert('⚠️ Erreur', 'La clé ne peut pas être vide.', ui.ButtonSet.OK);
        }
    }
}

/**
 * Efface la clé API de l'onglet "config".
 */
function uiSupprimerCleAPI() {
    const ui = SpreadsheetApp.getUi();
    const confirm = ui.alert('❌ Sécurité', 'Voulez-vous supprimer votre clé de l\'onglet config ?', ui.ButtonSet.YES_NO);

    if (confirm == ui.Button.YES) {
        setParam('GEMINI_KEY', '');
        SpreadsheetApp.flush(); 
        ui.alert('🗑️ Clé supprimée.', 'Le robot est désormais hors ligne.', ui.ButtonSet.OK);
        writeLog("uiSupprimerCleAPI", "Suppression Clé API", "Non");
        onOpen();
    }
}

/**
 * Wrappers pour exécution manuelle avec verrou de sécurité.
 */
function menuLancerSourcing() { executerAvecVerrou('analyserNewslettersOpportunites', 'Sourcing'); }
function menuLancerUpdate() { executerAvecVerrou('analyserMailsReponsesRecues', 'Update'); }
function menuLancerAutoConfig() { executerAvecVerrou('detecterEtConfigurerNewsletters', 'Config IA'); }

/**
 * Exécute une fonction de sourcing ou d'analyse en empêchant les lancements multiples.
 * Utilise 'IS_RUNNING' dans l'onglet config comme sémaphore.
 * @param {string} nomFonction Le nom de la fonction de la bibliothèque à appeler.
 * @param {string} labelLog Nom convivial pour les logs.
 */
function executerAvecVerrou(nomFonction, labelLog) {
    const ui = SpreadsheetApp.getUi();

    if (getParam('IS_RUNNING') === 'true') {
        ui.alert('⏳ Patience...', 'Une analyse est déjà en cours sur ce fichier.', ui.ButtonSet.OK);
        return;
    }

    try {
        setParam('IS_RUNNING', 'true');
        SpreadsheetApp.flush(); // Verrouille l'état immédiatement

        const resultat = GlobalScope_Call(nomFonction);
        
        ui.alert('✅ Terminé', `L'action "${labelLog}" est finie.`, ui.ButtonSet.OK);
        writeLog(nomFonction, `Succès : ${labelLog}`, "Non", resultat || "");
    } catch (e) {
        ui.alert('❌ Erreur', e.toString(), ui.ButtonSet.OK);
        writeLog(nomFonction, `ERREUR : ${labelLog}`, "Oui", e.toString());
    } finally {
        setParam('IS_RUNNING', 'false');
        SpreadsheetApp.flush(); 
    }
}

/**
 * Helper pour appeler les fonctions de la bibliothèque dans le contexte global.
 */
function GlobalScope_Call(fnName) {
    return this[fnName]();
}