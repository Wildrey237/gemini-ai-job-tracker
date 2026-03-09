/**
 * 🚀 INTERFACE UTILISATEUR (UI)
 * Gère le menu dynamique, le verrouillage et la communication via writeLog.
 */

/**
 * Se lance automatiquement à l'ouverture du Sheet.
 */
function onOpen() {
    const ui = SpreadsheetApp.getUi();
    const props = PropertiesService.getScriptProperties();

    // Lecture des états
    const hasKey = props.getProperty('GEMINI_KEY') !== null;
    const hasTriggers = props.getProperty('TRIGGERS_ACTIVATED') === 'true';

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
        uiDemanderCleAPI();
    }
}

/**
 * CONFIGURATION & INSTALLATION DES TRIGGERS
 */
function uiInstallerAutomatisation() {
    const ui = SpreadsheetApp.getUi();
    const props = PropertiesService.getScriptProperties();

    if (!props.getProperty('GEMINI_KEY')) {
        ui.alert('❌ Stop !', 'Pas de clé API. Configurez la clé d\'abord (Étape 1).', ui.ButtonSet.OK);
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

        props.setProperty('TRIGGERS_ACTIVATED', 'true');

        const recapPlanning =
            "🚀 C'est parti ! L'automatisation est configurée.\n\n" +
            "Voici votre planning :\n" +
            "• 00h00 : Collecte candidatures envoyées.\n" +
            "• 03h00 : Analyse réponses RH.\n" +
            "• 06h00 : Sourcing newsletters.\n" +
            "• Dimanche 21h00 : Détection nouvelles newsletters.\n" +
            "• Lundi 09h00 : Nettoyage des logs.\n\n" +
            "Le script travaillera en arrière-plan.";

        ui.alert('Système Activé', recapPlanning, ui.ButtonSet.OK);

        // Utilisation de writeLog
        writeLog("uiInstallerAutomatisation", "Planning complet activé", "Non", "Triggers : 00h/03h/06h/Dim 21h/Lun 09h");

        onOpen();
    } catch (e) {
        ui.alert('❌ Erreur technique', e.toString(), ui.ButtonSet.OK);
        writeLog("uiInstallerAutomatisation", "Échec installation triggers", "Oui", e.toString());
    }
}

/**
 * SUPPRESSION DES TRIGGERS
 */
function uiSupprimerAutomatisation(silencieux = false) {
    const props = PropertiesService.getScriptProperties();
    const triggers = ScriptApp.getProjectTriggers();

    triggers.forEach(t => ScriptApp.deleteTrigger(t));
    props.setProperty('TRIGGERS_ACTIVATED', 'false');

    if (!silencieux) {
        SpreadsheetApp.getUi().alert('📴 Silence radio', 'Toutes les automatisations ont été supprimées.', SpreadsheetApp.getUi().ButtonSet.OK);
        writeLog("uiSupprimerAutomatisation", "Désactivation manuelle de l'automatisation", "Non", "Tous les triggers ont été retirés.");
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
            PropertiesService.getScriptProperties().setProperty('GEMINI_KEY', key);
            ui.alert('✅ Enregistré !', 'Clé configurée.', ui.ButtonSet.OK);
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
    const confirm = ui.alert('❌ Sécurité', 'Voulez-vous supprimer votre clé ?', ui.ButtonSet.YES_NO);

    if (confirm == ui.Button.YES) {
        PropertiesService.getScriptProperties().deleteProperty('GEMINI_KEY');
        ui.alert('🗑️ Clé supprimée.', 'Le robot est désormais hors ligne.', ui.ButtonSet.OK);
        writeLog("uiSupprimerCleAPI", "Suppression manuelle de la clé API", "Non", "La clé a été retirée des Script Properties.");
        onOpen();
    }
}

/**
 * WRAPPERS MANUELS AVEC VERROUILLAGE
 */
function menuLancerSourcing() {
    executerAvecVerrou('analyserNewslettersOpportunites', 'Sourcing Manuel');
}

function menuLancerUpdate() {
    executerAvecVerrou('analyserMailsReponsesRecues', 'Update Manuel');
}

function menuLancerAutoConfig() {
    executerAvecVerrou('detecterEtConfigurerNewsletters', 'Détection Newsletters Manuelle');
}

/**
 * MOTEUR D'EXÉCUTION SÉCURISÉ
 */
function executerAvecVerrou(nomFonction, labelLog) {
    const ui = SpreadsheetApp.getUi();
    const props = PropertiesService.getScriptProperties();

    if (props.getProperty('IS_RUNNING') === 'true') {
        ui.alert('⏳ Patience...', 'Une analyse est déjà en cours.', ui.ButtonSet.OK);
        return;
    }

    try {
        props.setProperty('IS_RUNNING', 'true');

        // Appel dynamique de la fonction
        const resultat = this[nomFonction]();

        ui.alert('✅ Terminé !', `L'action "${labelLog}" est finie.`, ui.ButtonSet.OK);

        // Log de succès (on passe le résultat du script s'il existe en message)
        writeLog(nomFonction, `Succès : ${labelLog}`, "Non", resultat || "Exécution manuelle terminée");

    } catch (e) {
        ui.alert('❌ Erreur', e.toString(), ui.ButtonSet.OK);
        writeLog(nomFonction, `ERREUR lors de : ${labelLog}`, "Oui", e.toString());
    } finally {
        props.setProperty('IS_RUNNING', 'false');
    }
}