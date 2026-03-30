/**
 * SCRIPT 2 : Analyse des Réponses et Mise à jour du Suivi
 * Mise à jour : Full Sheet Config (getParam) et Blacklist dynamique.
 */
function analyserMailsReponsesRecues() {
    const nomF = "update_candidature";

    // ⚙️ Récupération des paramètres via l'onglet "config"
    const nomSheet = getParam('SHEET_NAME');
    const nomSheetConfig = getParam('SHEET_NEWSLETTER_CONFIG');

    let stats = {
        emailsVus: 0,
        count: 0,
        emailsScannes: 0,
        majEffectuees: 0,
        alertesEnvoyees: 0,
        details: []
    };
    let alertesManuelles = [];

    console.log(">>> [DEBUT] Lancement du chasseur de réponses...");

    try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const sheet = ss.getSheetByName(nomSheet);
        const sheetConfig = ss.getSheetByName(nomSheetConfig);

        if (!sheet) throw new Error(`Feuille "${nomSheet}" introuvable.`);
        if (!sheetConfig) throw new Error(`Feuille de configuration "${nomSheetConfig}" introuvable.`);

        // 1. RECUPERATION DE LA CONFIGURATION (Pour la Blacklist dynamique)
        const configSourcing = recupererConfiguration(sheetConfig);
        const blacklistDynamique = configSourcing.emails.map(e => e.toLowerCase().trim());
        console.log(`🚫 [BLACKLIST] ${blacklistDynamique.length} sources de newsletters ignorées.`);

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

                // Traitement avec la blacklist dynamique
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

        // Journalisation identique à l'original
        writeLog(nomF, messageExcel, "Non", msgErreurLien);

        if (alertesManuelles.length > 0 && typeof envoyerMailAlerteGroupee === "function") {
            envoyerMailAlerteGroupee(alertesManuelles);
        }

    } catch (e) {
        console.error("!!! [ERREUR S2] : " + e.toString());
        writeLog(nomF, "ERREUR EXECUTION", "Oui", e.toString());
    }
}

/**
 * COLLECTE : Filtre Gmail basé sur les noms d'entreprises du Sheet
 */
function collecterEmailsFiltres(entreprises) {
    const periode = "5d";
    const labelsResultats = '(-label:IA-Réponse-Refusée -label:IA-Réponse-Entretien -label:IA-Réponse-En-Cours -label:IA-Réponse-Acceptée)';

    const noms = entreprises
        .map(e => e.nom && e.nom.toString().trim())
        .filter(Boolean);

    if (noms.length === 0) {
        console.log("[QUERY GMAIL] Aucun nom d'entreprise à chercher.");
        return [];
    }

    const listeNoms = noms.map(n => `"${n}"`).join(" OR ");

    const query = `newer_than:${periode} ${labelsResultats} (${listeNoms})`;

    console.log(`[QUERY GMAIL] : ${query}`);
    return GmailApp.search(query, 0, 30);
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

    // FILTRE : BLACKLIST DYNAMIQUE
    const estBlackliste = blacklist.some(email => emailExpediteur.includes(email));
    if (estBlackliste) {
        console.log(`| - [SKIP] Blacklist Config détectée : ${emailExpediteur}`);
        return {succes: false};
    }

    console.log(`[ANALYSE] Mail de : ${emailExpediteur} | Sujet : ${sujet}`);

    const prompt = `Analyse ce mail de recrutement.

1. Identifie l'entreprise réelle.
2. Classe ce mail dans UNE SEULE catégorie parmi :
   - "Refusé" = rejet clair
   - "Entretien" = proposition ou convocation à un entretien
   - "Accepté" = offre, sélection finale, acceptance claire
   - "Confirmation" = accusé de réception, candidature reçue, dossier en cours d'étude, patience, traitement en cours
   - "Autre" = tout le reste

Expéditeur : ${emailExpediteur}
Sujet : ${sujet}
Mail : ${corps}

Réponds UNIQUEMENT en JSON valide :
{"entreprise":"Nom","verdict":"Categorie","details":"Résumé court"}`;
    
    const analyse = callGeminiCentral(prompt);
    if (!analyse || !analyse.entreprise || !analyse.verdict) {
        console.log("[SKIP] Analyse IA vide ou incomplète.");
        return {succes: false};
    }

    const verdict = normaliserTexte(analyse.verdict);

    // RÈGLE MÉTIER : on ignore totalement les confirmations / en cours / autres
    const verdictsIgnorer = ["confirmation", "en cours", "autre"];
    if (verdictsIgnorer.includes(verdict)) {
        console.log(`[SKIP] Mail ignoré car verdict = ${analyse.verdict}`);
        return {
            succes: false,
            ignore: true,
            info: `Mail ignoré (${analyse.verdict}) : ${analyse.entreprise}`
        };
    }

    // On n'autorise les mises à jour QUE pour ces cas
    const verdictsAutorises = ["refuse", "refusé", "entretien", "accepte", "accepté"];
    const verdictValide = verdictsAutorises.includes(verdict);

    if (!verdictValide) {
        console.log(`[SKIP] Verdict non autorisé : ${analyse.verdict}`);
        return {succes: false};
    }

    // MATCHING NORMALISÉ
    let cible = null;
    const nomIA = normaliserTexte(analyse.entreprise);
    const sujetN = normaliserTexte(sujet);
    const expN = normaliserTexte(emailExpediteur);

    for (let item of entreprisesEnAttente) {
        const nomS = normaliserTexte(item.nom);
        const match = nomIA.includes(nomS) || nomS.includes(nomIA) || sujetN.includes(nomS) || expN.includes(nomS);

        if (match) {
            cible = item;
            console.log(`| - [DEBUG] MATCH TROUVÉ : IA("${analyse.entreprise}") <-> Sheet("${item.nom}")`);
            break;
        }
    }

    if (!cible) {
        console.log(`[ALERTE] Aucune ligne trouvée pour ${analyse.entreprise}`);
        return {
            alerteMail: true,
            info: `Entreprise: ${analyse.entreprise} | Verdict: ${analyse.verdict} | Lien: ${thread.getPermalink()}`
        };
    }

    const dateJ = Utilities.formatDate(new Date(), "GMT+1", "dd/MM/yyyy");

    // Harmonisation des valeurs écrites dans la sheet
    let statutFinal = analyse.verdict;
    if (verdict === "refuse" || verdict === "refusé") statutFinal = "Refusé";
    if (verdict === "entretien") statutFinal = "Entretien";
    if (verdict === "accepte" || verdict === "accepté") statutFinal = "Accepté";

    // Écriture UNIQUEMENT pour Refusé / Entretien / Accepté
    sheet.getRange(cible.ligne, 4).setValue(statutFinal);
    sheet.getRange(cible.ligne, 9).setValue(dateJ);

    let note = `[${dateJ}] ${analyse.details}`;

    const rangeLigne = sheet.getRange(cible.ligne, 1, 1, 9);

    if (statutFinal === "Entretien") {
        const rdv = extraireDateCalendrier(corps);
        if (rdv && rdv.date !== "inconnu") {
            creerEvenementCalendrier(analyse.entreprise, rdv, thread.getPermalink());
            note += ` | RDV : ${rdv.date} à ${rdv.heure}`;
        }
        rangeLigne.setBackground("#cfe2ff");
        appliquerLabelVerdict(thread, statutFinal);
    } else if (statutFinal === "Refusé") {
        rangeLigne.setBackground("#f8d7da");
        appliquerLabelVerdict(thread, statutFinal);
    } else if (statutFinal === "Accepté") {
        rangeLigne.setBackground("#d4edda");
        appliquerLabelVerdict(thread, statutFinal);
    }

    const oldNote = sheet.getRange(cible.ligne, 6).getValue();
    sheet.getRange(cible.ligne, 6).setValue(oldNote ? `${oldNote} | ${note}` : note);

    appliquerLabelVerdict(thread, statutFinal);

    return {succes: true, info: `${analyse.entreprise} (${statutFinal}) - Ligne ${cible.ligne}`};
}