/**
 * FONCTION DE MAINTENANCE : Nettoyage et Archivage des vieux logs
 * À exécuter une fois par jour (Trigger quotidien)
 */
function maintenanceNettoyageLogs() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const logSheet = ss.getSheetByName("logs");
  
  if (!logSheet) {
    console.error("Maintenance : Onglet 'logs' introuvable.");
    return;
  }

  const dateAujourdhui = new Date();
  const limiteRetention = 30; // Nombre de jours de conservation
  const logs = logSheet.getDataRange().getValues();
  
  // On commence à la ligne 2 pour garder l'en-tête (index 1 dans logs)
  let lignesASupprimer = 0;
  
  console.log(">>> [MAINTENANCE] Début du nettoyage des logs...");

  // On parcourt de bas en haut pour ne pas fausser les index lors de la suppression
  for (let i = logs.length - 1; i >= 1; i--) {
    const dateLog = new Date(logs[i][0]); // Colonne A : Date
    
    if (isValidDate(dateLog)) {
      const differenceJours = (dateAujourdhui - dateLog) / (1000 * 60 * 60 * 24);
      
      if (differenceJours > limiteRetention) {
        // Archivage symbolique dans la console avant suppression
        console.log(`Archivage : Log du ${logs[i][0]} - ${logs[i][2]} : ${logs[i][3]}`);
        
        logSheet.deleteRow(i + 1);
        lignesASupprimer++;
      }
    }
  }

  if (lignesASupprimer > 0) {
    console.log(`>>> [MAINTENANCE] Succès : ${lignesASupprimer} vieux logs supprimés.`);
  } else {
    console.log(">>> [MAINTENANCE] Aucun log à supprimer aujourd'hui.");
  }
}

/**
 * Utilitaire pour vérifier la validité d'une date
 */
function isValidDate(d) {
  return d instanceof Date && !isNaN(d);
}