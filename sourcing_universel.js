/**
 * SCRIPT 3 : Sourcing Universel d'Opportunités
 * LOGIQUE : Scan des newsletters (LinkedIn, Indeed...), extraction multi-offres par IA,
 * filtrage sémantique selon la config, archivage et labellisation.
 * MODIFICATION : Labellisation et archivage systématiques, même si 0 offre trouvée.
 */
function analyserNewslettersOpportunites() {
    const nomF = "sourcing_jobs";
    const props = PropertiesService.getScriptProperties();
    const nomSheetDest = props.getProperty('SHEET_NEWSLETTER');
    const nomSheetConfig = props.getProperty('SHEET_NEWSLETTER_CONFIG');

    let stats = {mailsTraites: 0, offresAjoutees: 0, details: []};

    console.log(">>> [DEBUT] Lancement du Sourcing Universel (Nettoyage Systématique)...");

    try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const sheetDest = ss.getSheetByName(nomSheetDest);
        const sheetConfig = ss.getSheetByName(nomSheetConfig);

        if (!sheetDest || !sheetConfig) throw new Error("Onglets introuvables.");

        const config = recupererConfiguration(sheetConfig);
        if (config.emails.length === 0) return;

        const threads = collecterMailsNewsletters(config.emails);
        stats.mailsTraites = threads.length;

        if (stats.mailsTraites > 0) {
            const labelNom = "Newslatter-jobs-extraites";
            const label = GmailApp.getUserLabelByName(labelNom) || GmailApp.createLabel(labelNom);

            for (const thread of threads) {
                Utilities.sleep(2000);

                // 1. ANALYSE DU MAIL
                const resultat = traiterUneNewsletter(thread, sheetDest, config);

                // 2. ACTIONS SYSTEMATIQUES (Peu importe le succès de l'IA)
                thread.addLabel(label);
                thread.moveToArchive();
                console.log(`| - [NETTOYAGE] Mail "${thread.getFirstMessageSubject()}" labellisé et archivé.`);

                if (resultat && resultat.nbOffres > 0) {
                    stats.offresAjoutees += resultat.nbOffres;
                    stats.details.push(`✅ ${resultat.info}`);
                } else {
                    stats.details.push(`⚪ Aucun match dans : ${thread.getFirstMessageSubject()}`);
                }

                SpreadsheetApp.flush();
            }
        }

        const resume = `Mails: ${stats.mailsTraites} | Offres: ${stats.offresAjoutees}`;
        console.log(">>> [RESUME FINAL] : " + resume);
        if (typeof enregistrerLog === "function") {
            enregistrerLog(nomF, resume, false, stats.details.join("\n"));
        }

    } catch (e) {
        console.error("!!! [ERREUR S3] : " + e.toString());
        if (typeof enregistrerLog === "function") {
            enregistrerLog(nomF, "ERREUR SOURCING", true, e.toString());
        }
    }
}

/**
 * SOUS-FONCTION : Lecture de l'onglet Config
 */
function recupererConfiguration(sheet) {
    const data = sheet.getDataRange().getValues();
    // On saute l'en-tête (ligne 0)
    let config = {cibles: [], contrats: [], competences: [], emails: [], flexibilite: "Flexible"};

    for (let i = 1; i < data.length; i++) {
        if (data[i][0]) config.cibles.push(data[i][0]);
        if (data[i][1]) config.contrats.push(data[i][1]);
        if (data[i][2]) config.competences.push(data[i][2]);
        if (data[i][3]) config.emails.push(data[i][3]);
        if (i === 1 && data[i][4]) config.flexibilite = data[i][4]; // Niveau pris sur la première ligne de données
    }
    return config;
}

/**
 * SOUS-FONCTION : Recherche Gmail ciblée
 */
function collecterMailsNewsletters(emails) {
    const queryEmails = emails.map(e => `from:${e}`).join(" OR ");
    const labelExclu = "Newslatter-jobs-extraites";
    const query = `newer_than:1d -label:${labelExclu} (${queryEmails})`;

    console.log(`[QUERY GMAIL] : ${query}`);
    return GmailApp.search(query, 0, 10); // Limite à 10 threads pour éviter les timeouts
}

/**
 * SOUS-FONCTION : Analyse d'un mail et extraction multi-offres
 * MODIFICATION : Le type de contrat est désormais imposé comme STRICT.
 */
function traiterUneNewsletter(thread, sheetDest, config) {
    const message = thread.getMessages().pop();
    const corps = message.getPlainBody();
    const sujet = message.getSubject();

    const flexConsigne = config.flexibilite === "Strict"
        ? "Sois strict sur TOUS les critères."
        : `Sois flexible sur le MÉTIER (accepte les synonymes EN/FR), mais reste STRICT sur le TYPE DE CONTRAT (${config.contrats.join(", ")}).`;

    const prompt = `Tu es un expert en recrutement bilingue. Analyse ce mail et extrais TOUTES les offres qui correspondent à ces critères :
  - MÉTIERS : ${config.cibles.join(", ")}
  - TYPES DE CONTRAT (Strict) : ${config.contrats.join(", ")}
  - COMPÉTENCES : ${config.competences.join(", ")}
  
  RÈGLES :
  1. ${flexConsigne}
  2. Si l'offre est en anglais, traduis les informations clés pour le JSON mais garde le titre original.
  3. Si le type de contrat ne match pas la liste, ignore l'offre.
  4. Réponds UNIQUEMENT en JSON : {"offres": [{"entreprise": "Nom", "poste": "Titre", "lieu": "Ville/Remote", "stack": "Technos", "lien": "URL direct"}]}
  
  Mail : ${corps}`;

    const analyse = callGeminiCentral(prompt);
    if (!analyse || !analyse.offres || analyse.offres.length === 0) return {nbOffres: 0};

    let count = 0;
    analyse.offres.forEach(offre => {
        if (!estDoublonSourcing(sheetDest, offre.entreprise, offre.poste)) {
            const dateJ = Utilities.formatDate(new Date(), "GMT+1", "dd/MM/yyyy");

            // --- NOUVEAU FORMATAGE DU LIEN ---
            const urlPropre = safeValue(offre.lien);
            const formuleLien = `=HYPERLINK("${urlPropre}"; "Accéder au lien")`;

            sheetDest.appendRow([
                safeValue(offre.entreprise),
                safeValue(offre.poste),
                safeValue(offre.lieu),
                safeValue(offre.stack),
                formuleLien, // On insère la formule ici (Colonne E)
                dateJ,
                "À analyser"
            ]);
            count++;
        }
    });

    return {nbOffres: count, info: `${count} offres dans "${sujet}"`};
}

/**
 * HELPER : Vérification des doublons (Entreprise + Poste)
 */
function estDoublonSourcing(sheet, entreprise, poste) {
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return false;

    const data = sheet.getRange(Math.max(1, lastRow - 100), 1, Math.min(lastRow, 100), 2).getValues();
    const entNormalise = normaliserTexte(entreprise);
    const posteNormalise = normaliserTexte(poste);

    return data.some(row => {
        return normaliserTexte(row[0]) === entNormalise && normaliserTexte(row[1]) === posteNormalise;
    });
}