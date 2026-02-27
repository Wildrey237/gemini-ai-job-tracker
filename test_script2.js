/**
 * TEST 2 : Simulation de mise à jour d'une ligne existante avec Logger
 */
function testMiseAJourStatut() {
  const nomF = "testMiseAJourStatut";
  const ss = SpreadsheetApp.getActiveSpreadsheet(); // On récupère le tableur
  const props = PropertiesService.getScriptProperties(); // On récupère les propriétés
  
  // 1. On récupère le NOM de la feuille depuis les propriétés
  const nomDeLaFeuille = props.getProperty('SHEET_NAME');
  // 2. On récupère l'OBJET feuille réel
  const sheet = ss.getSheetByName(nomDeLaFeuille);
  
  try {
    // Vérification que la feuille existe bien dans le tableur
    if (!sheet) {
      writeLog(nomF, "Échec de l'accès à la feuille", "Oui", `L'onglet nommé '${nomDeLaFeuille}' est introuvable.`);
      return;
    }

    // Données simulées
    const extractionIA = {
      entreprise: "TESLA", 
      verdict: "Refusé",    
      date: Utilities.formatDate(new Date(), "GMT+1", "dd/MM/yyyy")
    };

    // Maintenant getLastRow() fonctionnera car 'sheet' est un objet Google Sheets
    const derniereLigne = sheet.getLastRow();
    
    if (derniereLigne < 2) {
       writeLog(nomF, "La feuille est vide", "Oui", "Aucune donnée trouvée en colonne A.");
       return;
    }
    
    const rangeEntreprises = sheet.getRange(1, 1, derniereLigne, 1).getValues();
    let ligneTrouvee = -1;

    for (let i = 0; i < rangeEntreprises.length; i++) {
      if (rangeEntreprises[i][0].toString().toUpperCase() === extractionIA.entreprise.toUpperCase()) {
        ligneTrouvee = i + 1;
        break;
      }
    }

    if (ligneTrouvee !== -1) {
      sheet.getRange(ligneTrouvee, 4).setValue(extractionIA.verdict);
      sheet.getRange(ligneTrouvee, 9).setValue(extractionIA.date);
      
      const couleur = extractionIA.verdict === "Refusé" ? "#f8d7da" : "#cfe2ff";
      sheet.getRange(ligneTrouvee, 1, 1, 9).setBackground(couleur);
      
      const msgSucces = `La fonction ${nomF} a mis à jour dans la feuille ${nomDeLaFeuille} l'entreprise ${extractionIA.entreprise} avec le statut ${extractionIA.verdict}`;
      writeLog(nomF, msgSucces, "Non", "");
      Logger.log("✅ " + msgSucces);

    } else {
      const msgEchec = `L'entreprise '${extractionIA.entreprise}' n'a pas été trouvée dans la colonne A.`;
      writeLog(nomF, "Mise à jour impossible", "Oui", msgEchec);
      Logger.log("⚠️ " + msgEchec);
    }

  } catch (e) {
    writeLog(nomF, "Erreur critique d'exécution", "Oui", e.toString());
    Logger.log("❌ Erreur : " + e.toString());
  }
}