/**
 * 🚀 INTERFACE UTILISATEUR (UI) - Le cerveau relationnel de ton application.
 * Gère le menu, le verrouillage et la communication avec l'utilisateur (et les logs).
 */

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  const props = PropertiesService.getScriptProperties();
  const hasKey = props.getProperty('GEMINI_KEY') !== null;
  
  const menu = ui.createMenu('🚀 AI Job Tracker');

  // Affichage dynamique : On ne propose que ce qui fait sens
  if (hasKey) {
    menu.addItem('❌ Supprimer ma Clé API', 'uiSupprimerCleAPI');
  } else {
    menu.addItem('🔑 1. Configurer ma Clé API', 'uiDemanderCleAPI');
  }

  menu.addItem('⏰ 2. Activer l\'automatisation', 'uiInstallerAutomatisation')
    .addSeparator()
    .addItem('🔍 Lancer Sourcing (Manuel)', 'menuLancerSourcing')
    .addItem('🔄 Actualiser Réponses (Manuel)', 'menuLancerUpdate')
    .addSeparator()
    .addItem('🧹 Nettoyer les Logs', 'maintenanceNettoyageLogs')
    .addItem('🚫 Désactiver l\'automatisation', 'uiSupprimerAutomatisation')
    .addToUi();
}

/**
 * WRAPPERS : On s'assure que l'utilisateur ne clique pas comme un dément.
 */
function menuLancerSourcing() { executerAvecVerrou('analyserNewslettersOpportunites', 'Sourcing Manuel'); }
function menuLancerUpdate() { executerAvecVerrou('analyserMailsReponsesRecues', 'Update Manuel'); }

/**
 * CORE LOGIC : Le garde-barrière qui évite les collisions.
 */
function executerAvecVerrou(nomFonction, labelLog) {
  const ui = SpreadsheetApp.getUi();
  const props = PropertiesService.getScriptProperties();

  if (props.getProperty('IS_RUNNING') === 'true') {
    ui.alert('⏳ Oh là ! Doucement.', 'Une analyse est déjà en cours. L\'IA travaille, laissez-la respirer un peu.', ui.ButtonSet.OK);
    return;
  }

  try {
    props.setProperty('IS_RUNNING', 'true');
    console.log(`>>> [UI] Lancement de ${nomFonction}...`);
    
    // Appel de la fonction métier
    this[nomFonction](); 
    
    ui.alert('✅ Terminé !', `L'action "${labelLog}" est finie. Vos données sont fraîches.`, ui.ButtonSet.OK);
    if (typeof enregistrerLog === "function") {
      enregistrerLog("UI_ACTION", `Succès : ${labelLog}`, false, "Lancé manuellement via le menu.");
    }

  } catch (e) {
    ui.alert('❌ Oups...', `Quelque chose a coincé : ${e.toString()}`, ui.ButtonSet.OK);
    if (typeof enregistrerLog === "function") {
      enregistrerLog("UI_ACTION", `ERREUR : ${labelLog}`, true, e.toString());
    }
  } finally {
    props.setProperty('IS_RUNNING', 'false');
  }
}

/**
 * CONFIGURATION & TRIGGERS
 */
function uiInstallerAutomatisation() {
  const ui = SpreadsheetApp.getUi();
  const props = PropertiesService.getScriptProperties();
  
  if (!props.getProperty('GEMINI_KEY')) {
    ui.alert('❌ Stop !', 'Pas de clé API, pas de chocolat. Configurez la clé d\'abord (Étape 1).', ui.ButtonSet.OK);
    return;
  }

  uiSupprimerAutomatisation(true); 

  try {
    ScriptApp.newTrigger('analyserMailsCandidaturesEnvoyees').timeBased().everyDays(1).atHour(0).create();
    ScriptApp.newTrigger('analyserMailsReponsesRecues').timeBased().everyDays(1).atHour(3).create();
    ScriptApp.newTrigger('analyserNewslettersOpportunites').timeBased().everyDays(1).atHour(6).create();
    ScriptApp.newTrigger('maintenanceNettoyageLogs').timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(9).create();

    ui.alert('🚀 C\'est parti !', 'L\'automatisation est configurée. Le script travaillera pendant que vous dormez.', ui.ButtonSet.OK);
    if (typeof enregistrerLog === "function") enregistrerLog("CONFIG", "Triggers installés", false, "Planning : 00h, 03h, 06h + Lundi");
  } catch (e) {
    ui.alert('❌ Erreur technique', e.toString(), ui.ButtonSet.OK);
  }
}

function uiSupprimerAutomatisation(silencieux = false) {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(t => ScriptApp.deleteTrigger(t));
  
  if (!silencieux) {
    SpreadsheetApp.getUi().alert('📴 Silence radio', 'Toutes les automatisations ont été supprimées.', SpreadsheetApp.getUi().ButtonSet.OK);
    if (typeof enregistrerLog === "function") enregistrerLog("CONFIG", "Triggers supprimés", false, "Désactivation manuelle.");
  }
}

/**
 * GESTION DE LA CLÉ API
 */
function uiDemanderCleAPI() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt('🔑 Configuration IA', 'Collez votre clé Gemini API pour réveiller le script :', ui.ButtonSet.OK_CANCEL);
  
  if (response.getSelectedButton() == ui.Button.OK) {
    const key = response.getResponseText().trim();
    if (key !== "") {
      PropertiesService.getScriptProperties().setProperty('GEMINI_KEY', key);
      ui.alert('✅ Impeccable.', 'La clé est enregistrée. Le menu va se mettre à jour.', ui.ButtonSet.OK);
      if (typeof enregistrerLog === "function") enregistrerLog("CONFIG", "Clé API ajoutée", false, "L'utilisateur a configuré sa clé.");
      onOpen(); // Refresh menu
    }
  }
}

function uiSupprimerCleAPI() {
  const ui = SpreadsheetApp.getUi();
  const confirm = ui.alert('❌ Sécurité', 'Voulez-vous vraiment supprimer votre clé ? Le script redeviendra une simple feuille Excel sans âme.', ui.ButtonSet.YES_NO);

  if (confirm == ui.Button.YES) {
    PropertiesService.getScriptProperties().deleteProperty('GEMINI_KEY');
    ui.alert('🗑️ Clé supprimée.', 'C\'est fait. Au revoir, petit robot.', ui.ButtonSet.OK);
    if (typeof enregistrerLog === "function") enregistrerLog("CONFIG", "Clé API supprimée", false, "L'utilisateur a retiré ses accès.");
    onOpen(); // Refresh menu
  }
}