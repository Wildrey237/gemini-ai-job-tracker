/**
 * Logger Universel à 6 colonnes
 * Colonnes : Date | Heure | Fonction | Message | Erreur (Oui/Non) | Message d'erreur
 */
function writeLog(nomFonction, message, aEuErreur = "Non", msgErreur = "") {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let logSheet = ss.getSheetByName("logs");
  
  if (!logSheet) {
    logSheet = ss.insertSheet("logs");
    logSheet.appendRow(["Date", "Heure", "Fonction", "Message", "Erreur", "Message d'erreur"]);
    logSheet.getRange(1, 1, 1, 6).setFontWeight("bold").setBackground("#f3f3f3");
  }

  const maintenant = new Date();
  const dateStr = Utilities.formatDate(maintenant, "GMT+1", "dd/MM/yyyy");
  const heureStr = Utilities.formatDate(maintenant, "GMT+1", "HH:mm:ss");

  // Ajout de la ligne selon ton nouveau format
  logSheet.appendRow([
    dateStr,       // Date
    heureStr,      // Heure
    nomFonction,   // Fonction
    message,       // Message
    aEuErreur,     // Erreur (Oui/Non)
    msgErreur      // Message d'erreur
  ]);
}

/**
 * FONCTION UNIVERSELLE (À placer idéalement dans Logger.gs)
 * Permet de construire un résumé propre avec précision des lignes
 */
function construireResumeFinal(typeAction, stats) {
  let resume = `Scan terminé : ${stats.emailsVus} mails analysés. `;
  
  if (stats.count === 0) {
    resume += `Aucun ${typeAction.toLowerCase()} effectué.`;
  } else {
    const pluriel = stats.count > 1 ? "s" : "";
    const label = typeAction === "Ajout" ? `ajout${pluriel}` : `mise${pluriel} à jour`;
    resume += `${stats.count} ${label} : ${stats.details.join(", ")}.`;
  }
  
  return resume;
}