/**
 * Enregistre un log dans l'onglet "logs" avec la structure :
 * [Date, Heure, Fonction, Message, Erreur (Oui/Non), Message d'erreur]
 */
function enregistrerLog(nomFonction, message, aErreur, detailErreur = "") {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const logSheet = ss.getSheetByName("logs");
    
    if (!logSheet) {
      console.warn("Feuille 'logs' introuvable.");
      return;
    }

    const maintenant = new Date();
    const dateStr = Utilities.formatDate(maintenant, "GMT+1", "dd/MM/yyyy");
    const heureStr = Utilities.formatDate(maintenant, "GMT+1", "HH:mm:ss");

    // Ajoute la ligne selon ta structure exacte
    logSheet.appendRow([
      dateStr, 
      heureStr, 
      nomFonction, 
      message, 
      aErreur ? "Oui" : "Non", 
      detailErreur
    ]);
    
  } catch (e) {
    console.error("Erreur lors de l'écriture du log : " + e.toString());
  }
}