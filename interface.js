/**
 * 🚀 INTERFACE UTILISATEUR (UI)
 * Gère le menu dynamique, le verrouillage et la communication.
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
    menu.addItem('🔑 1. Configurer ma Clé API', 'uiDemanderCleAPI');
  }

  // 2. GESTION DYNAMIQUE DE L'AUTOMATISATION
  if (hasTriggers) {
    menu.addItem('🚫 Désactiver l\'automatisation', 'uiSupprimerAutomatisation');
  } else {
    menu.addItem('⏰ 2. Activer l\'automatisation', 'uiInstallerAutomatisation');
  }

  menu.addSeparator()
    .addItem('🔍 Lancer Sourcing (Manuel)', 'menuLancerSourcing')
    .addItem('🔄 Actualiser Réponses (Manuel)', 'menuLancerUpdate')
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
    ui.alert('❌ Stop !', 'Pas de clé API, pas de chocolat. Configurez la clé d\'abord (Étape 1).', ui.ButtonSet.OK);
    return;
  }

  // Nettoyage préventif
  uiSupprimerAutomatisation(true); 

  try {
    // Création du planning
    ScriptApp.newTrigger('analyserMailsCandidaturesEnvoyees').timeBased().everyDays(1).atHour(0).create();
    ScriptApp.newTrigger('analyserMailsReponsesRecues').timeBased().everyDays(1).atHour(3).create();
    ScriptApp.newTrigger('analyserNewslettersOpportunites').timeBased().everyDays(1).atHour(6).create();
    ScriptApp.newTrigger('maintenanceNettoyageLogs').timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(9).create();

    // MISE À JOUR DU TÉMOIN
    props.setProperty('TRIGGERS_ACTIVATED', 'true');

    ui.alert('🚀 C\'est parti !', 'L\'automatisation est configurée. Le menu va se mettre à jour.', ui.ButtonSet.OK);
    if (typeof enregistrerLog === "function") enregistrerLog("CONFIG", "Triggers installés", false, "Planning complet activé.");
    
    onOpen(); // Actualise le menu
  } catch (e) {
    ui.alert('❌ Erreur technique', e.toString(), ui.ButtonSet.OK);
  }
}

/**
 * SUPPRESSION DES TRIGGERS
 */
function uiSupprimerAutomatisation(silencieux = false) {
  const props = PropertiesService.getScriptProperties();
  const triggers = ScriptApp.getProjectTriggers();
  
  // Suppression réelle
  triggers.forEach(t => ScriptApp.deleteTrigger(t));
  
  // MISE À JOUR DU TÉMOIN
  props.setProperty('TRIGGERS_ACTIVATED', 'false');
  
  if (!silencieux) {
    SpreadsheetApp.getUi().alert('📴 Silence radio', 'Toutes les automatisations ont été supprimées.', SpreadsheetApp.getUi().ButtonSet.OK);
    if (typeof enregistrerLog === "function") enregistrerLog("CONFIG", "Triggers supprimés", false, "Désactivation manuelle.");
    onOpen(); // Actualise le menu
  }
}

/**
 * GESTION DE LA CLÉ API AVEC INSTRUCTIONS
 */
function uiDemanderCleAPI() {
  const ui = SpreadsheetApp.getUi();
  
  const instructions = 
    "Bienvenue dans votre assistant de candidature !\n\n" +
    "Pour fonctionner, ce script a besoin d'une clé API Gemini (gratuite).\n" +
    "1. Allez sur : https://aistudio.google.com/app/apikey\n" +
    "2. Créez une clé 'API Key'.\n" +
    "3. Collez-la ci-dessous :\n";

  const response = ui.prompt('🔑 Configuration Initiale', instructions, ui.ButtonSet.OK_CANCEL);
  
  if (response.getSelectedButton() == ui.Button.OK) {
    const key = response.getResponseText().trim();
    if (key !== "") {
      PropertiesService.getScriptProperties().setProperty('GEMINI_KEY', key);
      ui.alert('✅ Impeccable !', 'Votre clé est enregistrée. Vous pouvez activer l\'automatisation.', ui.ButtonSet.OK);
      if (typeof enregistrerLog === "function") enregistrerLog("CONFIG", "Clé API ajoutée", false, "Clé configurée via prompt.");
      onOpen(); 
    } else {
      ui.alert('⚠️ Attention', 'La clé ne peut pas être vide.', ui.ButtonSet.OK);
    }
  }
}

/**
 * SUPPRESSION DE LA CLÉ
 */
function uiSupprimerCleAPI() {
  const ui = SpreadsheetApp.getUi();
  const confirm = ui.alert('❌ Sécurité', 'Voulez-vous supprimer votre clé ? Le script s\'arrêtera.', ui.ButtonSet.YES_NO);

  if (confirm == ui.Button.YES) {
    PropertiesService.getScriptProperties().deleteProperty('GEMINI_KEY');
    ui.alert('🗑️ Clé supprimée.', 'Au revoir, petit robot.', ui.ButtonSet.OK);
    if (typeof enregistrerLog === "function") enregistrerLog("CONFIG", "Clé API supprimée", false, "Retrait manuel.");
    onOpen(); 
  }
}

/**
 * WRAPPERS & CORE LOGIC
 */
function menuLancerSourcing() { executerAvecVerrou('analyserNewslettersOpportunites', 'Sourcing Manuel'); }
function menuLancerUpdate() { executerAvecVerrou('analyserMailsReponsesRecues', 'Update Manuel'); }

function executerAvecVerrou(nomFonction, labelLog) {
  const ui = SpreadsheetApp.getUi();
  const props = PropertiesService.getScriptProperties();

  if (props.getProperty('IS_RUNNING') === 'true') {
    ui.alert('⏳ Oh là !', 'Une analyse est déjà en cours.', ui.ButtonSet.OK);
    return;
  }

  try {
    props.setProperty('IS_RUNNING', 'true');
    this[nomFonction](); 
    ui.alert('✅ Terminé !', `L'action "${labelLog}" est finie.`, ui.ButtonSet.OK);
    if (typeof enregistrerLog === "function") enregistrerLog("UI_ACTION", `Succès : ${labelLog}`, false, "Manuel");
  } catch (e) {
    ui.alert('❌ Oups...', e.toString(), ui.ButtonSet.OK);
    if (typeof enregistrerLog === "function") enregistrerLog("UI_ACTION", `ERREUR : ${labelLog}`, true, e.toString());
  } finally {
    props.setProperty('IS_RUNNING', 'false');
  }
}