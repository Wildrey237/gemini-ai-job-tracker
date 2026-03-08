/**
 * CONFIGURATION DES FILTRES (Facile à modifier)
 */
const CONFIG_FILTRES = {
    "blacklist_emails": [
        "jobs-listings@linkedin.com",
        "jobalerts-noreply@linkedin.com"
    ]
};

/**
 * SCRIPT 2 : Analyse des Réponses et Mise à jour du Suivi
 */
function analyserMailsReponsesRecues() {
    const nomF = "update_candidature";
    const props = PropertiesService.getScriptProperties();
    const nomSheet = props.getProperty('SHEET_NAME');

    let stats = {emailsScannes: 0, majEffectuees: 0, alertesEnvoyees: 0, details: []};
    let alertesManuelles = [];

    console.log(">>> [DEBUT] Lancement du chasseur de réponses (V3 - Blacklist & Flush)...");

    try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const sheet = ss.getSheetByName(nomSheet);
        if (!sheet) throw new Error(`Feuille ${nomSheet} introuvable.`);

        // 1. DATA : Récupérer les entreprises "En attente" (Colonne A et D)
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

        // 2. COLLECTE : Recherche Gmail avec exclusion des labels existants
        const threads = collecterEmailsFiltres(entreprisesEnAttente);
        stats.emailsScannes = threads.length;

        if (stats.emailsScannes > 0) {
            for (const thread of threads) {
                // PAUSE DE SÉCURITÉ (Anti-429)
                Utilities.sleep(2000);

                const resultat = traiterUnFilOptimise(thread, sheet, entreprisesEnAttente);

                if (resultat && resultat.succes) {
                    stats.majEffectuees++;
                    stats.details.push(`✅ ${resultat.info}`);
                    // FORCE L'ECRITURE DANS LE SHEET IMMEDIATEMENT
                    SpreadsheetApp.flush();
                } else if (resultat && resultat.alerteMail) {
                    stats.alertesEnvoyees++;
                    alertesManuelles.push(resultat.info);
                    stats.details.push(`📩 Alerte : ${resultat.info}`);
                }
            }
        }

        const resume = `Scan: ${stats.emailsScannes} | MàJ: ${stats.majEffectuees} | Alertes: ${stats.alertesEnvoyees}`;
        console.log(">>> [RESUME FINAL] : " + resume);
        enregistrerLog(nomF, resume, false, stats.details.join("\n"));

        if (alertesManuelles.length > 0) {
            envoyerMailAlerteGroupee(alertesManuelles);
        }

    } catch (e) {
        console.error("!!! [ERREUR] : " + e.toString());
        if (typeof enregistrerLog === "function") {
            enregistrerLog(nomF, "ERREUR EXECUTION", true, e.toString());
        }
    }
}

/**
 * COLLECTE : Filtre Gmail (7 jours pour tests)
 */
function collecterEmailsFiltres(entreprises) {
    const periode = "1d"; // MODIFIER ICI : "2d" pour la prod
    const labelAjoute = "IA-Candidature-Ajoutée";
    const labelsResultats = '(-label:IA-Réponse-Refusée -label:IA-Réponse-Entretien -label:IA-Réponse-En-Cours -label:IA-Réponse-Acceptée)';

    const listeNoms = entreprises.map(e => `"${e.nom}"`).join(" OR ");
    const query = `newer_than:${periode} -label:${labelAjoute} ${labelsResultats} (${listeNoms})`;

    console.log(`[QUERY GMAIL] : ${query}`);
    return GmailApp.search(query, 0, 15);
}

/**
 * SOUS-FONCTION : Analyse et Matching avec Blacklist
 */
function traiterUnFilOptimise(thread, sheet, entreprisesEnAttente) {
    const messages = thread.getMessages();
    const lastMessage = messages[messages.length - 1];
    const emailExpediteur = lastMessage.getFrom().toLowerCase();
    const sujet = lastMessage.getSubject();
    const corps = lastMessage.getPlainBody();

    // --- FILTRE : BLACKLIST JSON ---
    const estBlackliste = CONFIG_FILTRES.blacklist_emails.some(email => emailExpediteur.includes(email.toLowerCase()));
    if (estBlackliste) {
        console.log(`| - [SKIP] Blacklist détectée : ${emailExpediteur}`);
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

    // B. MATCHING NORMALISÉ (Sans accents)
    let cible = null;
    const nomIA = normaliser(analyse.entreprise);
    const sujetN = normaliser(sujet);
    const expN = normaliser(emailExpediteur);

    for (let item of entreprisesEnAttente) {
        const nomS = normaliser(item.nom);

        // Comparaison croisée
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
        // 1. MISE À JOUR SHEET
        sheet.getRange(cible.ligne, 4).setValue(analyse.verdict);
        sheet.getRange(cible.ligne, 9).setValue(dateJ);

        let note = `[${dateJ}] ${analyse.details}`;

        if (analyse.verdict === "Entretien") {
            const rdv = extraireDateCalendrier(corps);
            if (rdv && rdv.date !== "inconnu") {
                creerEvenementCalendrier(analyse.entreprise, rdv, thread.getPermalink());
                note += ` | 📅 RDV : ${rdv.date} à ${rdv.heure}`;
            }
            sheet.getRange(cible.ligne, 1, 1, 9).setBackground("#cfe2ff");
        } else if (analyse.verdict === "Refusé") {
            sheet.getRange(cible.ligne, 1, 1, 9).setBackground("#f8d7da");
        } else if (analyse.verdict === "Accepté") {
            sheet.getRange(cible.ligne, 1, 1, 9).setBackground("#d4edda");
        }

        const oldNote = sheet.getRange(cible.ligne, 6).getValue();
        sheet.getRange(cible.ligne, 6).setValue(oldNote ? `${oldNote} | ${note}` : note);

        // 2. LABELS GMAIL
        appliquerLabelVerdict(thread, analyse.verdict);

        return {succes: true, info: `${analyse.entreprise} (Match Ligne ${cible.ligne})`};
    } else {
        // 3. ALERTE MAIL
        return {
            alerteMail: true,
            info: `Entreprise: ${analyse.entreprise} | Verdict: ${analyse.verdict} | Lien: ${thread.getPermalink()}`
        };
    }
}