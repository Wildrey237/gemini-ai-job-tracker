/**
 * SCRIPT 3 : Sourcing Universel d'Opportunités
 * LOGIQUE : Scan des newsletters, extraction multi-offres par IA, filtrage, archivage.
 * Utilise writeLog pour une journalisation condensée.
 */
function analyserNewslettersOpportunites() {
    const nomF = "analyserNewsletters";
    const props = PropertiesService.getScriptProperties();
    const nomSheetDest = props.getProperty('SHEET_NEWSLETTER');
    const nomSheetConfig = props.getProperty('SHEET_NEWSLETTER_CONFIG');

    let stats = { mailsTraites: 0, count: 0, emailsVus: 0, details: [] };
    let erreursLocales = [];

    console.log(">>> [DEBUT] Lancement du Sourcing Universel (Nettoyage Systématique)...");

    try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const sheetDest = ss.getSheetByName(nomSheetDest);
        const sheetConfig = ss.getSheetByName(nomSheetConfig);

        if (!sheetDest || !sheetConfig) throw new Error("Onglets destination ou config introuvables.");

        const config = recupererConfiguration(sheetConfig);
        if (config.emails.length === 0) return;

        const threads = collecterMailsNewsletters(config.emails);
        stats.mailsTraites = threads.length;
        stats.emailsVus = threads.length;

        if (stats.mailsTraites > 0) {
            const labelNom = "Newslatter-jobs-extraites";
            const label = GmailApp.getUserLabelByName(labelNom) || GmailApp.createLabel(labelNom);

            for (const thread of threads) {
                try {
                    Utilities.sleep(2000);
                    const resultat = traiterUneNewsletter(thread, sheetDest, config);

                    thread.addLabel(label);
                    thread.moveToArchive();
                    console.log(`| - [NETTOYAGE] Mail "${thread.getFirstMessageSubject()}" labellisé et archivé.`);
                    
                    if (resultat && resultat.nbOffres > 0) {
                        stats.count += resultat.nbOffres;
                        stats.details.push(`${resultat.nbOffres} offres (${thread.getFirstMessageSubject().substring(0,30)}...)`);
                    }
                } catch (err) {
                    erreursLocales.push(`Mail "${thread.getFirstMessageSubject()}" : ${err.toString()}`);
                }
                SpreadsheetApp.flush();
            }
        }

          const messageAction = construireResumeFinal("Ajout", stats);
          console.log(">>> [RESUME FINAL] : " + messageAction);
          writeLog(nomF, messageAction, erreursLocales.length > 0 ? "Oui" : "Non", erreursLocales.join(" | "));
        

    } catch (e) {
        writeLog(nomF, "Erreur critique Sourcing", "Oui", e.toString());
        console.error("!!! [ERREUR S3] : " + e.toString());
    }
}

/**
 * SOUS-FONCTION : Analyse d'un mail avec Détection de Langue
 */
function traiterUneNewsletter(thread, sheetDest, config) {
    const message = thread.getMessages().pop();
    const corps = message.getPlainBody();
    const sujet = message.getSubject();

    // --- DETECTION DE LA LANGUE (Basée sur le contenu du mail) ---
    // On cherche des mots clés anglais fréquents dans les newsletters de job
    const keywordsEN = ["job", "apply", "hiring", "location", "salary", "full-time", "remote"];
    const textSnippet = (sujet + " " + corps).toLowerCase();
    const isEnglish = keywordsEN.some(word => textSnippet.includes(word));
    
    console.log(`| - [LANGUE] ${isEnglish ? "Anglais détecté" : "Français détecté"} pour : ${sujet}`);

    // --- ADAPTATION DU PROMPT ---
    let prompt = "";
    const flexStr = config.flexibilite === "Strict" ? "STRICT" : "FLEXIBLE";

    if (isEnglish) {
        prompt = `You are a recruitment expert. Analyze this email and extract ALL job offers matching these criteria:
        - JOB TITLES: ${config.cibles.join(", ")}
        - CONTRACT TYPES (Strict): ${config.contrats.join(", ")}
        - SKILLS: ${config.competences.join(", ")}
        
        RULES:
        1. Mode: ${flexStr}. If Flexible, accept synonyms.
        2. Important: Always translate the 'lieu' (location) and 'stack' into French in the JSON.
        3. Respond ONLY in JSON format: {"offres": [{"entreprise": "Name", "poste": "Title", "lieu": "City/Remote", "stack": "Tech", "lien": "URL"}]}
        
        Mail content: ${corps.substring(0, 4000)}`;
    } else {
        prompt = `Tu es un expert en recrutement. Analyse ce mail et extrais TOUTES les offres correspondant à :
        - MÉTIERS : ${config.cibles.join(", ")}
        - CONTRATS (Strict) : ${config.contrats.join(", ")}
        - COMPÉTENCES : ${config.competences.join(", ")}
        
        RÈGLES :
        1. Mode : ${flexStr}. Si Flexible, accepte les synonymes (ex: Développeur = Software Engineer).
        2. Réponds UNIQUEMENT en JSON : {"offres": [{"entreprise": "Nom", "poste": "Titre", "lieu": "Ville/Remote", "stack": "Technos", "lien": "URL"}]}
        
        Mail : ${corps.substring(0, 4000)}`;
    }

    const analyse = callGeminiCentral(prompt);
    if (!analyse || !analyse.offres || analyse.offres.length === 0) return {nbOffres: 0};

    let count = 0;
    analyse.offres.forEach(offre => {
        if (!estDoublonSourcing(sheetDest, offre.entreprise, offre.poste)) {
            const dateJ = Utilities.formatDate(new Date(), "GMT+1", "dd/MM/yyyy");
            const urlPropre = (offre.lien && offre.lien !== "null") ? offre.lien : "#";
            const formuleLien = `=HYPERLINK("${urlPropre}"; "Accéder au lien")`;

            sheetDest.appendRow([
                offre.entreprise || "Inconnu",
                offre.poste || "Inconnu",
                offre.lieu || "Inconnu",
                offre.stack || "Inconnu",
                formuleLien,
                dateJ,
                "À analyser"
            ]);
            count++;
        }
    });

    return {nbOffres: count, info: `${count} offres dans "${sujet}"`};
}

// Les autres sous-fonctions (recupererConfiguration, collecterMailsNewsletters, estDoublonSourcing) restent inchangées.

/**
 * HELPER : Vérification des doublons (Entreprise + Poste)
 */
function estDoublonSourcing(sheet, entreprise, poste) {
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return false;
    const data = sheet.getRange(Math.max(1, lastRow - 100), 1, Math.min(lastRow, 100), 2).getValues();
    const entN = String(entreprise).toLowerCase().trim();
    const posN = String(poste).toLowerCase().trim();
    return data.some(row => row[0].toString().toLowerCase().trim() === entN && row[1].toString().toLowerCase().trim() === posN);
}

/**
 * SOUS-FONCTION : Lecture de l'onglet Config (Structure d'origine conservée)
 */
function recupererConfiguration(sheet) {
    const data = sheet.getDataRange().getValues();
    let config = {cibles: [], contrats: [], competences: [], emails: [], flexibilite: "Flexible"};

    for (let i = 1; i < data.length; i++) {
        if (data[i][0]) config.cibles.push(data[i][0]);
        if (data[i][1]) config.contrats.push(data[i][1]);
        if (data[i][2]) config.competences.push(data[i][2]);
        if (data[i][3]) config.emails.push(data[i][3]);
        if (i === 1 && data[i][4]) config.flexibilite = data[i][4];
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
    return GmailApp.search(query, 0, 10);
}
