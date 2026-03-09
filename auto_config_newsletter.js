/**
 * 🕵️‍♂️ MOTEUR DE DÉTECTION DE NEWSLETTERS (Version Pilotée par Onglet Config)
 * Utilise getParam pour la configuration et writeLog pour la journalisation.
 */
function detecterEtConfigurerNewsletters() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // ⚙️ Récupération du nom de l'onglet via getParam (au lieu de props)
    const sheetConfigName = getParam('SHEET_NEWSLETTER_CONFIG');
    const sheetConfig = ss.getSheetByName(sheetConfigName);

    if (!sheetConfig) {
        console.error(`❌ [STOP] L'onglet de config "${sheetConfigName}" est introuvable.`);
        writeLog("detecterEtConfigurerNewsletters", "Échec : Onglet de config introuvable", "Oui", `Vérifiez la clé SHEET_NEWSLETTER_CONFIG dans l'onglet config`);
        return;
    }

    // 1. CHARGEMENT DE LA MÉMOIRE (Sources déjà connues dans l'onglet config)
    // On suppose que les emails sont toujours en colonne D (index 4) du tableau de config
    const lastRow = sheetConfig.getLastRow();
    const emailsConfigures = lastRow > 1
        ? sheetConfig.getRange(2, 4, lastRow - 1, 1).getValues().flat().map(e => String(e).toLowerCase().trim())
        : [];

    console.log(`🚀 [START] Analyse. ${emailsConfigures.length} sources déjà connues.`);

    // 2. REQUÊTE GMAIL (Derniers 7 jours)
    const query = "newer_than:7d -is:chats -label:Newslatter-jobs-extraites";
    const threads = GmailApp.search(query, 0, 20);

    if (threads.length === 0) {
        writeLog("detecterEtConfigurerNewsletters", "Aucun nouveau mail à analyser (7 derniers jours).", "Non");
        return "Aucun nouveau mail.";
    }

    const suspects = {};

    // 3. EXTRACTION DU TEXTE
    threads.forEach(thread => {
        const msg = thread.getMessages()[0];
        const from = msg.getFrom().replace(/.*<|>.*/g, "").toLowerCase().trim();

        // Si l'email n'est pas encore dans notre liste blanche (colonne D)
        if (emailsConfigures.indexOf(from) === -1) {
            let content = msg.getPlainBody();
            if (!content || content.length < 100) {
                content = msg.getBody()
                    .replace(/<style([\s\S]*?)<\/style>/gi, '')
                    .replace(/<script([\s\S]*?)<\/script>/gi, '')
                    .replace(/<[^>]*>/g, ' ')
                    .replace(/\s+/g, ' ');
            }
            suspects[from] = {sample: content.substring(0, 1500).trim()};
        }
    });

    // --- VARIABLES POUR LE RÉSUMÉ FINAL ---
    let stats = {
        count: 0,        // Nombre d'ajouts réussis
        emailsVus: Object.keys(suspects).length,
        details: []      // Liste des emails ajoutés
    };
    let rejets = [];   // Liste des emails rejetés pour le log détaillé
    const listToAnalyze = Object.keys(suspects);

    // 4. JUGEMENT IA
    listToAnalyze.forEach(email => {
        console.log(`🤖 [IA] Analyse de : ${email}...`);
        const verdict = demanderVerdictIA(email, suspects[email].sample);

        if (verdict.estValide) {
            console.log(`✅ [OUI] ${email} ajouté.`);
            // Ajout de la nouvelle source dans l'onglet config (Colonne D: Email, E: Flexibilité)
            sheetConfig.appendRow(["", "", "", email, "Flexible"]);
            stats.count++;
            stats.details.push(email);
        } else {
            console.log(`❌ [NON] ${email} ignoré.`);
            rejets.push(`${email} (${verdict.justification})`);
        }
    });

    // 5. CONSTRUCTION ET ÉCRITURE DU LOG UNIQUE
    const messageAction = construireResumeFinal("Ajout", stats);
    let detailErreur = rejets.length > 0 ? `Rejets : ${rejets.join(" | ")}` : "";

    writeLog(
        "ConfigurerNewsletters",
        messageAction,
        "Non",
        detailErreur
    );

    return messageAction;
}

/**
 * Appelle Gemini via le moteur central et parse la réponse JSON
 */
function demanderVerdictIA(email, texte) {
    const prompt = `Analyse cet email de "${email}". Est-ce une newsletter d'offres d'emploi, de stages ou d'alternances ?
    
    TEXTE : "${texte}"
    
    Réponds au format JSON suivant :
    {
      "verdict": "OUI" ou "NON",
      "raison": "Une phrase courte expliquant pourquoi"
    }`;

    try {
        // Utilise ton moteur centralisé déjà mis à jour avec getParam
        const resIA = callGeminiCentral(prompt);
        if (!resIA) return {estValide: false, justification: "L'IA n'a pas répondu."};

        const estValide = (resIA.verdict === "OUI");
        const justification = resIA.raison || "Aucune explication.";

        return {estValide: estValide, justification: justification};
    } catch (e) {
        return {estValide: false, justification: "Erreur technique JSON."};
    }
}