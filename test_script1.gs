/**
 * TEST : Extraction IA + Insertion avec Logger & IA Centralisée
 */
function testRemplissageIA_Correct() {
  const nomF = "testRemplissageIA_Correct";
  const props = PropertiesService.getScriptProperties();
  const sheetName = props.getProperty('SHEET_NAME');
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  
  try {
    if (!sheet) {
      writeLog(nomF, "Échec de l'accès à la feuille", "Oui", "L'onglet '" + sheetName + "' est introuvable.");
      return;
    }

    const fauxMail = "De: recruitment@tesla.com \n Sujet: Confirmation. \n Contenu: Bonjour, nous confirmons la réception de votre dossier pour le stage de 'AI Software Engineer' à Berlin.";

    // ON DÉFINIT LE PROMPT ICI
    const prompt = "Donne uniquement un JSON pur (clés: entreprise, poste, lieu). Analyse ce mail : " + fauxMail;

    // APPEL DE LA FONCTION CENTRALISÉE
    const extraction = callGeminiCentral(prompt);

    if (extraction) {
      const dateDuJour = Utilities.formatDate(new Date(), "GMT+1", "dd/MM/yyyy");
      const ligneCible = sheet.getLastRow() + 1;

      // Ta formule avec points-virgules
      const formuleStatut = `=IF(G${ligneCible}="oui"; IF(TODAY()-B${ligneCible}>60; "Refusé"; "En attente"); "")`;

      const ligneDonnees = [
        extraction.entreprise || "Tesla", 
        dateDuJour,                      
        extraction.poste || "Intern",     
        formuleStatut, 
        extraction.lieu || "Berlin",      
        "test",                           
        "oui",                            
        "https://tesla.com"               
      ];

      sheet.getRange(ligneCible, 1, 1, 8).setValues([ligneDonnees]);
      sheet.getRange(ligneCible, 1, 1, 8).setBackground("#d1e7dd");

      const msgSucces = `La fonction ${nomF} a ajouté dans la feuille ${sheetName} l'entreprise ${extraction.entreprise || "Tesla"}`;
      writeLog(nomF, msgSucces, "Non", "");
      
    } else {
      writeLog(nomF, "L'IA n'a retourné aucune donnée", "Oui", "Échec de callGeminiCentral");
    }

  } catch (e) {
    writeLog(nomF, "Erreur d'exécution du script", "Oui", e.toString());
  }
}