/**
 * 🧹 FONCTION DE MAINTENANCE : Nettoyage des vieux logs
 * Supprime les entrées de plus de 30 jours et consigne un rapport unique.
 */
function maintenanceNettoyageLogs() {
    const nomF = "maintenanceNettoyageLogs";
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const logSheet = ss.getSheetByName("logs");

    if (!logSheet) {
        console.error("❌ [MAINTENANCE] Onglet 'logs' introuvable.");
        return;
    }

    const dateAujourdhui = new Date();
    const limiteRetention = 30; // Jours de conservation
    const logs = logSheet.getDataRange().getValues();
    
    let lignesSupprimees = 0;
    let detailsArchivage = [];

    console.log(">>> [MAINTENANCE] Début du nettoyage des logs...");

    // Parcours de bas en haut pour ne pas corrompre les index de lignes lors de la suppression
    for (let i = logs.length - 1; i >= 1; i--) {
        const dateLogRaw = logs[i][0]; // Colonne A : Date
        
        // Conversion sécurisée de la date (gère le format string ou Date object)
        let dateLog;
        if (dateLogRaw instanceof Date) {
            dateLog = dateLogRaw;
        } else {
            // Tente de parser si c'est une string dd/mm/yyyy
            const parts = String(dateLogRaw).split('/');
            if (parts.length === 3) {
                dateLog = new Date(parts[2], parts[1] - 1, parts[0]);
            } else {
                dateLog = new Date(dateLogRaw);
            }
        }

        if (isValidDate(dateLog)) {
            const differenceJours = (dateAujourdhui - dateLog) / (1000 * 60 * 60 * 24);

            if (differenceJours > limiteRetention) {
                lignesSupprimees++;
                // On garde une trace des fonctions supprimées pour le log final
                if (detailsArchivage.length < 5) {
                    detailsArchivage.push(`${logs[i][2]} (${logs[i][0]})`);
                }
                logSheet.deleteRow(i + 1);
            }
        }
    }

    // --- RÉSUMÉ ET LOG FINAL ---
    let messageFinal = "";
    if (lignesSupprimees > 0) {
        messageFinal = `Nettoyage réussi : ${lignesSupprimees} entrées supprimées (>30 jours).`;
        const detailTexte = `Exemples supprimés : ${detailsArchivage.join(", ")}...`;
        
        // On écrit le log APRES la suppression pour qu'il reste dans le sheet
        writeLog(nomF, messageFinal, "Non", detailTexte);
        console.log(`>>> [MAINTENANCE] ${messageFinal}`);
    } else {
        console.log(">>> [MAINTENANCE] Aucun log à supprimer.");
        // Optionnel : ne pas écrire de log si rien n'est fait pour ne pas remplir le sheet
    }
}

/**
 * Utilitaire pour vérifier la validité d'une date
 */
function isValidDate(d) {
    return d instanceof Date && !isNaN(d.getTime());
}