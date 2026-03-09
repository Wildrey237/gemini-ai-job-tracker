/**
 * 🕵️‍♂️ MOTEUR DE DÉTECTION DE NEWSLETTERS (Version Logs Condensés)
 * Utilise writeLog pour une journalisation propre à 6 colonnes.
 */
function detecterEtConfigurerNewsletters() {
    const props = PropertiesService.getScriptProperties();
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetConfig = ss.getSheetByName(props.getProperty('SHEET_NEWSLETTER_CONFIG'));

    if (!sheetConfig) {
        console.error("❌ [STOP] L'onglet de config est introuvable.");
        writeLog("detecterEtConfigurerNewsletters", "Échec : Onglet de config introuvable", "Oui", "Vérifiez SHEET_NEWSLETTER_CONFIG");
        return;
    }

    // 1. CHARGEMENT DE LA MÉMOIRE (Liste blanche)
    const lastRow = sheetConfig.getLastRow();
    const emailsConfigures = lastRow > 1
        ? sheetConfig.getRange(2, 4, lastRow - 1, 1).getValues().flat().map(e => String(e).toLowerCase().trim())
        : [];

    console.log(`🚀 [START] Analyse. ${emailsConfigures.length} sources déjà connues.`);

    // 2. REQUÊTE GMAIL
    const query = "newer_than:7d -is:chats -label:Newslatter-jobs-extraites";
    const threads = GmailApp.search(query, 0, 20);

    if (threads.length === 0) {
        writeLog("detecterEtConfigurerNewsletters", "Aucun nouveau mail à analyser (15 derniers jours).", "Non");
        return "Aucun nouveau mail.";
    }

    const suspects = {};

    // 3. EXTRACTION DU TEXTE (Anti-Undefined & Force Brute HTML)
    threads.forEach(thread => {
        const msg = thread.getMessages()[0];
        const from = msg.getFrom().replace(/.*<|>.*/g, "").toLowerCase().trim();

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
            sheetConfig.appendRow(["", "", "", email, "Flexible"]);
            stats.count++;
            stats.details.push(email);
        } else {
            console.log(`❌ [NON] ${email} ignoré.`);
            rejets.push(`${email} (${verdict.justification})`);
        }
    });

    // 5. CONSTRUCTION ET ÉCRITURE DU LOG UNIQUE
    // On utilise ta fonction de construction de résumé
    const messageAction = construireResumeFinal("Ajout", stats);

    // On prépare le message d'erreur (optionnel) pour lister les rejets si besoin
    let detailErreur = rejets.length > 0 ? `Rejets : ${rejets.join(" | ")}` : "";

    // Appel de ta fonction writeLog à 6 colonnes
    writeLog(
        "ConfigurerNewsletters", // Fonction
        messageAction,                     // Message (Résumé dynamique)
        rejets.length > 0 ? "Non" : "Non", // Erreur (Ici "Non" car le script a fonctionné même si rejet)
        detailErreur                       // Message d'erreur (Détail des rejets)
    );

    return messageAction;
}

/**
 * Appelle Gemini et parse la réponse JSON structurée
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
        const resIA = callGeminiCentral(prompt);
        if (!resIA) return {estValide: false, justification: "L'IA n'a pas répondu."};

        const estValide = (resIA.verdict === "OUI");
        const justification = resIA.raison || "Aucune explication.";

        return {estValide: estValide, justification: justification};
    } catch (e) {
        return {estValide: false, justification: "Erreur technique JSON."};
    }
}