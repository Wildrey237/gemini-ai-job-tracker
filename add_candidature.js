/**
 * SCRIPT 1 : Détection, Ajout et Enrichissement des Candidatures
 * Version Finale Nettoyée - Sécurité Anti-Bruit & Boutons Liens
 */
function analyserMailsCandidaturesEnvoyees() {
    const nomF = "add_candidature";
    const sheetName = getParam('SHEET_NAME');
    let stats = {scannes: 0, ajouts: 0, enrichis: 0, details: []};

    console.log(">>> [DEBUT] Scan des candidatures...");

    try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const sheet = ss.getSheetByName(sheetName);
        if (!sheet) throw new Error(`Feuille ${sheetName} introuvable.`);

        const threads = collecterNouvellesCandidatures();
        stats.scannes = threads.length;

        if (stats.scannes > 0) {
            for (const thread of threads) {
                // On recharge les données à chaque passage pour détecter les ajouts faits durant la même exécution
                const lastRow = Math.max(sheet.getLastRow(), 1);
                const dataTableau = sheet.getRange(1, 1, lastRow, 8).getValues();

                const resultat = traiterNouvelEmailAmeliore(thread, sheet, dataTableau);

                if (resultat && resultat.succes) {
                    if (resultat.type === "ajout") stats.ajouts++;
                    if (resultat.type === "enrichissement") stats.enrichis++;
                    stats.details.push(resultat.info);

                    SpreadsheetApp.flush();
                    const label = GmailApp.getUserLabelByName("IA-Candidature-Ajoutée") || GmailApp.createLabel("IA-Candidature-Ajoutée");
                    thread.addLabel(label);
                }
            }
        }

        const resume = `Scan: ${stats.scannes} | Ajouts: ${stats.ajouts} | Enrichis: ${stats.enrichis}`;
        console.log(">>> [RESUME FINAL] : " + resume);
        writeLog(nomF, resume, "Non", stats.details.join("\n"));

    } catch (e) {
        console.error("!!! [ERREUR S1] : " + e.toString());
        writeLog(nomF, "Erreur Add", "Oui", e.toString());
    }
}

/**
 * COLLECTE : Recherche Gmail (2 jours)
 * Requête bilingue et exclusion dynamique basée sur la liste noire.
 */
function collecterNouvellesCandidatures() {
    // 1. Récupération dynamique de la liste noire depuis l'onglet Parametres
    let exclusionsDynamiques = "";
    try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const paramSheetName = getParam('SHEET_NEWSLETTER_CONFIG') || "Parametres";
        const paramSheet = ss.getSheetByName(paramSheetName);

        if (paramSheet) {
            const lastRow = paramSheet.getLastRow();
            if (lastRow >= 2) {
                const emails = paramSheet.getRange(2, 4, lastRow - 1, 1).getValues()
                    .flat()
                    .filter(email => email && email.toString().includes('@'));

                exclusionsDynamiques = emails.map(e => `-${e.trim()}`).join(' ');
            }
        }
    } catch (e) {
        console.warn("Impossible de charger la liste noire dynamique : " + e.message);
    }

    // 2. Exclusions statiques (bruit publicitaire et spam)
    const exclusionsStatiques = '-promotion -publicité -achat -facture -meeting -invitation -calendar -event -zoom -teams -meet -newsletter -"Fitness Park" -Cofidis -in:spam -category:promotions -category:social';

    // 3. Mots-clés de recherche bilingues
    const motsCles = '(confirmation OR received OR reçu OR candidature OR application OR "Thank you" OR submitted OR "candidature envoyée")';

    // 4. Construction de la requête finale
    const query = `newer_than:2d in:inbox -label:IA-Candidature-Ajoutée -label:IA-Réponse-En-Cours ${exclusionsStatiques} ${exclusionsDynamiques} ${motsCles}`;
    
    console.log(">>> Requête Gmail générée : " + query);
    
    return GmailApp.search(query, 0, 80);
}

/**
 * TRAITEMENT : Analyse IA et insertion/enrichissement
 */
function traiterNouvelEmailAmeliore(thread, sheet, dataTableau) {
    const message = thread.getMessages().pop();
    const rawSender = message.getFrom().toLowerCase();
    const subject = message.getSubject();
    const body = message.getPlainBody() || "";
    
    // On utilise les 2500 premiers caractères pour l'IA (suffisant pour une détection)
    const contentToAnalyze = body.substring(0, 2500);

    console.log(`[SCAN] Sujet: "${subject}" | Expéditeur: ${rawSender}`);

    // 1. FILTRE BLACKLIST CONFIG
    const emailsConfig = getParam('EMAILS_NEWSLETTERS') || "";
    const blacklist = emailsConfig.split(',').map(e => e.trim().toLowerCase());

    if (blacklist.some(b => b !== "" && rawSender.includes(b))) {
        console.log(`| - [IGNORE] Expéditeur blacklisté.`);
        return {succes: false};
    }

    // 2. ANALYSE IA GEMINI
  const prompt = `
Analyse ce mail de recrutement.

Objectif :
Déterminer si ce mail est un accusé de réception ou une confirmation liée à une candidature envoyée par l'utilisateur.

Consignes :
- "est_candidature" = true si le mail confirme qu'une candidature a bien été reçue ou enregistrée.
- Extrais le nom réel de l'entreprise.
- Extrais le poste si visible.
- Extrais le lieu si visible, sinon "Inconnu".
- Extrais le lien de l'offre si visible, sinon "".
- Réponds UNIQUEMENT en JSON valide, sans texte autour.

Format attendu :
{
  "est_candidature": true,
  "entreprise": "Nom exact de l'entreprise",
  "poste": "Titre du poste",
  "lieu": "Ville ou Inconnu",
  "lien": "URL ou vide"
}

Expéditeur : "${rawSender}"
Sujet : "${subject}"
Contenu :
${contentToAnalyze}
`;

    const data = callGeminiCentral(prompt);
    
    if (!data || !data.est_candidature || !data.entreprise || data.entreprise === "Inconnu") {
        console.log(`| - [IA] Verdict: Pas une candidature valide.`);
        return {succes: false};
    }

    // 3. LOGIQUE DE MATCHING
    let ligneExistante = -1;
    const nomIA = normaliserS1(data.entreprise);

    for (let i = 0; i < dataTableau.length; i++) {
        const nomCell = normaliserS1(dataTableau[i][0].toString());
        if (nomCell === "") continue;

        if (nomCell.includes(nomIA) || nomIA.includes(nomCell)) {
            ligneExistante = i + 1;
            break;
        }
    }

    const safe = (val) => (val && val !== "null" && val !== "undefined") ? val.toString().trim() : "Inconnu";
    const dateC = Utilities.formatDate(message.getDate(), "GMT+1", "dd/MM/yyyy");
    
    // Création du bouton lien stylisé
    const urlLien = (data.lien && data.lien.includes("http")) ? data.lien : "";
    const boutonLien = urlLien ? `=HYPERLINK("${urlLien}"; "🔗 Accéder")` : "";

    // 4. DECISION : ENRICHISSEMENT OU NOUVEL AJOUT
    if (ligneExistante !== -1) {
        const statutActuel = dataTableau[ligneExistante - 1][3]; // Colonne D

        if (statutActuel === "En attente" || statutActuel === "" || statutActuel.toString().includes("IF")) {
            console.log(`| - [ACTION] Enrichissement ligne ${ligneExistante}.`);
            
            if (dataTableau[ligneExistante - 1][2] === "Inconnu") sheet.getRange(ligneExistante, 3).setValue(safe(data.poste));
            if (dataTableau[ligneExistante - 1][4] === "Inconnu") sheet.getRange(ligneExistante, 5).setValue(safe(data.lieu));
            if ((dataTableau[ligneExistante - 1][7] === "" || dataTableau[ligneExistante - 1][7] === "Inconnu") && boutonLien !== "") {
                sheet.getRange(ligneExistante, 8).setValue(boutonLien);
            }
            
            return {succes: true, type: "enrichissement", info: `Enrichi: ${data.entreprise}`};
        }
    }

    // --- NOUVEL AJOUT ---
    const nextRow = sheet.getLastRow() + 1;
    const formuleStatut = `=IF(G${nextRow}="oui"; IF(TODAY()-B${nextRow}>60; "Refusé"; "En attente"); "")`;

    console.log(`| - [ACTION] Ajout d'une nouvelle ligne pour "${data.entreprise}".`);
    
    sheet.appendRow([
        safe(data.entreprise), 
        dateC, 
        safe(data.poste), 
        "", 
        safe(data.lieu), 
        "IA Auto-Détection", 
        "oui", 
        boutonLien
    ]);
    
    sheet.getRange(nextRow, 4).setFormula(formuleStatut);

    return {succes: true, type: "ajout", info: `Ajouté: ${data.entreprise}`};
}