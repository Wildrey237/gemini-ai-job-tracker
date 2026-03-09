/**
 * SCRIPT 2 : Analyse des Réponses et Mise à jour du Suivi
 * Mise à jour : Blacklist dynamique via l'onglet Config.
 */
function analyserMailsReponsesRecues() {
    const nomF = "update_candidature";
    const props = PropertiesService.getScriptProperties();
    const nomSheet = props.getProperty('SHEET_NAME');
    const nomSheetConfig = props.getProperty('SHEET_NEWSLETTER_CONFIG') || 'config';

    let stats = {
        emailsVus: 0,
        count: 0,
        emailsScannes: 0,
        majEffectuees: 0,
        alertesEnvoyees: 0,
        details: []
    };
    let alertesManuelles = [];

    console.log(">>> [DEBUT] Lancement du chasseur de réponses (V4 - Config Dynamic Blacklist)...");

    try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const sheet = ss.getSheetByName(nomSheet);
        const sheetConfig = ss.getSheetByName(nomSheetConfig);

        if (!sheet) throw new Error(`Feuille ${nomSheet} introuvable.`);
        if (!sheetConfig) throw new Error(`Feuille de configuration ${nomSheetConfig} introuvable.`);

        // 1. RECUPERATION DE LA CONFIGURATION (Pour la Blacklist dynamique)
        const configSourcing = recupererConfiguration(sheetConfig);
        const blacklistDynamique = configSourcing.emails.map(e => e.toLowerCase().trim());
        console.log(`🚫 [BLACKLIST] ${blacklistDynamique.length} emails de newsletters seront ignorés.`);

        // 2. DATA : Récupérer les entreprises "En attente"
        const lastRow = sheet.getLastRow();
        if (lastRow < 2) {
            console.log("[DATA] Sheet vide ou seulement en-têtes. Fin.");
            return;
        }

        const fullData = sheet.getRange(1, 1, lastRow, 9).getValues();
        const entreprisesEnAttente = fullData
            .map((row, index) => ({nom: row[0].toString().trim(), statut: row[3], ligne: index + 1}))
            .filter(item => (item.statut === "En attente" || item.statut === "") && item.nom !== "" && item.nom !== "Entreprise");

        console.log(`[DATA] ${entreprisesEnAttente.length} entreprises "En attente" détectées.`);

        // 3. COLLECTE : Recherche Gmail
        const threads = collecterEmailsFiltres(entreprisesEnAttente);
        stats.emailsScannes = threads.length;
        stats.emailsVus = threads.length;

        if (stats.emailsScannes > 0) {
            for (const thread of threads) {
                Utilities.sleep(2000); // Anti-429

                // On passe la blacklist dynamique au traitement
                const resultat = traiterUnFilOptimise(thread, sheet, entreprisesEnAttente, blacklistDynamique);

                if (resultat && resultat.succes) {
                    stats.majEffectuees++;
                    stats.count++;
                    stats.details.push(`${resultat.info}`);
                    SpreadsheetApp.flush();
                } else if (resultat && resultat.alerteMail) {
                    stats.alertesEnvoyees++;
                    alertesManuelles.push(resultat.info);
                }
            }
        }

        const resumeConsole = `Scan: ${stats.emailsScannes} | MàJ: ${stats.majEffectuees} | Alertes: ${stats.alertesEnvoyees}`;
        console.log(">>> [RESUME FINAL] : " + resumeConsole);

        const messageExcel = construireResumeFinal("Mise à jour", stats);
        const msgErreurLien = alertesManuelles.length > 0 ? "Alertes : " + alertesManuelles.join(", ") : "";

        writeLog(nomF, messageExcel, "Non", msgErreurLien);

        if (alertesManuelles.length > 0 && typeof envoyerMailAlerteGroupee === "function") {
            envoyerMailAlerteGroupee(alertesManuelles);
        }

    } catch (e) {
        console.error("!!! [ERREUR] : " + e.toString());
        writeLog(nomF, "ERREUR EXECUTION", "Oui", e.toString());
    }
}

/**
 * COLLECTE : Filtre Gmail
 */
function collecterEmailsFiltres(entreprises) {
    const periode = "1d";
    const labelAjoute = "IA-Candidature-Ajoutée";
    const labelsResultats = '(-label:IA-Réponse-Refusée -label:IA-Réponse-Entretien -label:IA-Réponse-En-Cours -label:IA-Réponse-Acceptée)';

    const listeNoms = entreprises.map(e => `"${e.nom}"`).join(" OR ");
    const query = `newer_than:${periode} -label:${labelAjoute} ${labelsResultats} (${listeNoms})`;

    console.log(`[QUERY GMAIL] : ${query}`);
    return GmailApp.search(query, 0, 15);
}

/**
 * SOUS-FONCTION : Analyse et Matching avec Blacklist Dynamique
 */
function traiterUnFilOptimise(thread, sheet, entreprisesEnAttente, blacklist) {
    const messages = thread.getMessages();
    const lastMessage = messages[messages.length - 1];
    const emailExpediteur = lastMessage.getFrom().toLowerCase();
    const sujet = lastMessage.getSubject();
    const corps = lastMessage.getPlainBody();

    // --- FILTRE : BLACKLIST DYNAMIQUE (Depuis Config) ---
    const estBlackliste = blacklist.some(email => emailExpediteur.includes(email));
    if (estBlackliste) {
        console.log(`| - [SKIP] Blacklist Config détectée : ${emailExpediteur}`);
        return {succes: false};
    }

    console.log(`[ANALYSE] Mail de : ${emailExpediteur} | Sujet : ${sujet}`);

    // A. IA : Extraction du Verdict
    const prompt = `Analyse ce mail de recrutement. 
  1. Identifie l'entreprise (ignore les plateformes type LinkedIn). 
  2. Verdict : "Refusé", "Entretien", "Accepté" ou "En cours".
  Expéditeur : ${emailExpediteur} | Sujet : ${sujet}
  Mail : ${corps}
  Réponds UNIQUEMENT en JSON : {"entreprise": "Nom", "verdict": "Statut", "details": "Résumé court"}`;

    const analyse = callGeminiCentral(prompt);
    if (!analyse || !analyse.entreprise) return {succes: false};

    // B. MATCHING NORMALISÉ
    let cible = null;
    const nomIA = normaliser(analyse.entreprise);
    const sujetN = normaliser(sujet);
    const expN = normaliser(emailExpediteur);

    for (let item of entreprisesEnAttente) {
        const nomS = normaliser(item.nom);
        const match = nomIA.includes(nomS) || nomS.includes(nomIA) || sujetN.includes(nomS) || expN.includes(nomS);

        if (match) {
            cible = item;
            console.log(`| - [DEBUG] MATCH TROUVÉ : IA("${analyse.entreprise}") <-> Sheet("${item.nom}")`);
            break;
        }
    }

    const dateJ = Utilities.formatDate(new Date(), "GMT+1", "dd/MM/yyyy");

    // C. ACTIONS
    if (cible) {
        sheet.getRange(cible.ligne, 4).setValue(analyse.verdict);
        sheet.getRange(cible.ligne, 9).setValue(dateJ);

        let note = `[${dateJ}] ${analyse.details}`;

        const rangeLigne = sheet.getRange(cible.ligne, 1, 1, 9);
        if (analyse.verdict === "Entretien") {
            const rdv = extraireDateCalendrier(corps);
            if (rdv && rdv.date !== "inconnu") {
                creerEvenementCalendrier(analyse.entreprise, rdv, thread.getPermalink());
                note += ` | 📅 RDV : ${rdv.date} à ${rdv.heure}`;
            }
            rangeLigne.setBackground("#cfe2ff");
        } else if (analyse.verdict === "Refusé") {
            rangeLigne.setBackground("#f8d7da");
        } else if (analyse.verdict === "Accepté") {
            rangeLigne.setBackground("#d4edda");
        }

        const oldNote = sheet.getRange(cible.ligne, 6).getValue();
        sheet.getRange(cible.ligne, 6).setValue(oldNote ? `${oldNote} | ${note}` : note);

        appliquerLabelVerdict(thread, analyse.verdict);

        return {succes: true, info: `${analyse.entreprise} (Ligne ${cible.ligne})`};
    } else {
        return {
            alerteMail: true,
            info: `Entreprise: ${analyse.entreprise} | Verdict: ${analyse.verdict} | Lien: ${thread.getPermalink()}`
        };
    }
}