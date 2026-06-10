/**
 * SCRIPT 1 : Détection et Ajout des Candidatures
 * Chaque email valide génère toujours une nouvelle ligne (pas d'enrichissement).
 */
function analyserMailsCandidaturesEnvoyees() {
    const nomF = "add_candidature";
    const sheetName = getParam('SHEET_NAME');
    let stats = {scannes: 0, ajouts: 0, details: []};

    console.log(">>> [DEBUT] Scan des candidatures...");

    try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const sheet = ss.getSheetByName(sheetName);
        if (!sheet) throw new Error(`Feuille ${sheetName} introuvable.`);

        const threads = collecterNouvellesCandidatures();
        stats.scannes = threads.length;

        if (stats.scannes > 0) {
            const label = GmailApp.getUserLabelByName("IA-Candidature-Ajoutée") || GmailApp.createLabel("IA-Candidature-Ajoutée");

            for (const thread of threads) {
                const resultat = traiterNouvelEmailAmeliore(thread, sheet);

                if (resultat && resultat.succes) {
                    stats.ajouts++;
                    stats.details.push(resultat.info);

                    SpreadsheetApp.flush();
                    thread.addLabel(label);
                }
            }
        }

        const resume = `Scan: ${stats.scannes} | Ajouts: ${stats.ajouts}`;
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
    const query = `newer_than:2d in:inbox -label:IA-Candidature-Ajoutée -label:IA-Réponse-En-Cours -label:IA-Réponse-Refusée -label:IA-Réponse-Entretien -label:IA-Réponse-Acceptée ${exclusionsStatiques} ${exclusionsDynamiques} ${motsCles}`;
    
    console.log(">>> Requête Gmail générée : " + query);
    
    return GmailApp.search(query, 0, 80);
}

/**
 * TRAITEMENT : Analyse IA et insertion
 */
function traiterNouvelEmailAmeliore(thread, sheet) {
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
Déterminer si ce mail est UNIQUEMENT un accusé de réception automatique confirmant que la candidature a bien été reçue/enregistrée, sans aucune décision.

Règles strictes :
- "est_candidature" = true SEULEMENT si le mail est un accusé de réception pur (la candidature vient d'être reçue/enregistrée, aucune décision n'a encore été prise).
- "est_candidature" = false si le mail contient une décision : refus, rejet, "nous n'avons pas retenu", "ne correspond pas", entretien proposé, offre acceptée, ou toute autre réponse RH.
- "est_candidature" = false si le mail mentionne "regret", "désolé", "malheureusement", "nous n'avons pas retenu", "pas retenu", "other candidates", "not selected", "unfortunately".
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

    const safe = (val) => (val && val !== "null" && val !== "undefined") ? val.toString().trim() : "Inconnu";
    const dateC = Utilities.formatDate(message.getDate(), "GMT+1", "dd/MM/yyyy");

    const urlLien = (data.lien && data.lien.includes("http")) ? data.lien : "";
    const boutonLien = urlLien ? `=HYPERLINK("${urlLien}"; "🔗 Accéder")` : "";

    // NOUVEL AJOUT
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

    return {succes: true, info: `Ajouté: ${data.entreprise}`};
}