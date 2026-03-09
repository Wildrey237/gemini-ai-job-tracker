/**
 * UTILS : Fonctions partagées pour le Matching, Nettoyage et Labels
 */

/**
 * Normalise un texte pour comparaison (Matching souple)
 * - Passage en minuscules
 * - Suppression des accents (décomposition NFD)
 * - Retrait des suffixes d'entreprise (SAS, LTD, Team...)
 * - Retrait des caractères spéciaux
 */
function normaliserTexte(t) {
    if (!t) return "";
    return t.toString().toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Supprime les accents
        .replace(/(hiring team|team|group|sas|inc|corp|ltd|sarl|re:|fwd:)/gi, "") // Supprime les suffixes
        .replace(/[^\w\s]/gi, "") // Supprime la ponctuation
        .trim();
}

/**
 * Sécurise les valeurs extraites par l'IA
 */
function safeValue(val) {
    if (!val || val === "null" || val === "undefined" || val === "Inconnu") {
        return "Inconnu";
    }
    return val.toString().trim();
}

/**
 * Applique le label Gmail correspondant au verdict détecté
 */
function appliquerLabelVerdict(thread, verdict) {
    let nomLabel = "IA-Réponse-En-Cours"; // Par défaut

    const v = verdict.toLowerCase();
    if (v.includes("refus")) nomLabel = "IA-Réponse-Refusée";
    if (v.includes("entretien") || v.includes("interview")) nomLabel = "IA-Réponse-Entretien";
    if (v.includes("accepte") || v.includes("offre")) nomLabel = "IA-Réponse-Acceptée";

    const label = GmailApp.getUserLabelByName(nomLabel) || GmailApp.createLabel(nomLabel);
    thread.addLabel(label);
    return nomLabel;
}

/**
 * Extrait le domaine d'une adresse email (ex: talan.com)
 * Utile pour le matching du Script 1
 */
function extraireDomaine(email) {
    const match = email.toLowerCase().match(/@([\w.-]+)/);
    if (!match) return "";
    let domaine = match[1];
    // Nettoyage des domaines de sous-traitance RH courants
    const exclusions = ["smartrecruiters", "workday", "lever", "greenhouse"];
    exclusions.forEach(ex => {
        if (domaine.includes(ex)) {
            domaine = domaine.split('.').slice(-2).join('.');
        }
    });
    return domaine;
}

/**
 * Envoi d'un mail d'alerte groupé (Sécurité S2)
 */
function envoyerMailAlerteGroupee(alertes) {
    if (alertes.length === 0) return;

    const destinataire = Session.getActiveUser().getEmail();
    const sujet = "⚠️ Alerte : Réponses RH non répertoriées";
    const corps = "Bonjour,\n\nLe script a détecté des mails de recrutement importants, mais l'entreprise n'est pas marquée 'En attente' dans votre Sheet.\n\n" +
        "Détails :\n- " + alertes.join("\n- ") +
        "\n\nAucune modification n'a été faite dans votre tableau.";

    MailApp.sendEmail(destinataire, sujet, corps);
    console.log("[MAIL] Alerte envoyée à " + destinataire);
}

/**
 * Création de l'événement Calendrier pour les entretiens
 */
function creerEvenementCalendrier(entreprise, rdv, mailLink) {
    try {
        const start = new Date(`${rdv.date}T${rdv.heure}:00`);
        const end = new Date(start.getTime() + (rdv.duree || 60) * 60000);

        CalendarApp.getDefaultCalendar().createEvent(
            `Entretien : ${entreprise}`,
            start,
            end,
            {
                description: `Lien vers le mail : ${mailLink}`,
                location: entreprise
            }
        );
        console.log(`[CALENDAR] Événement créé pour ${entreprise} le ${rdv.date}`);
    } catch (e) {
        console.error("Erreur Calendrier: " + e);
    }
}

/**
 * Récupère une configuration depuis l'onglet "config" (Tableau Clé/Valeur)
 */
function getParam(cle) {
    try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const sheetConfig = ss.getSheetByName('config');
        if (!sheetConfig) return null;

        const data = sheetConfig.getDataRange().getValues();
        // On parcourt la colonne A pour trouver la clé et on renvoie la colonne B
        for (let i = 0; i < data.length; i++) {
            if (data[i][0] === cle) {
                return data[i][1];
            }
        }
    } catch (e) {
        console.error("Erreur lecture Param : " + cle);
    }
    return null;
}

/**
 * ÉCRITURE D'UN PARAMÈTRE (setParam)
 * Cherche la clé en colonne A et écrit la valeur en colonne B
 */
function setParam(cle, valeur) {
    try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const sheetConfig = ss.getSheetByName('config');
        if (!sheetConfig) return;

        const data = sheetConfig.getDataRange().getValues();
        for (let i = 0; i < data.length; i++) {
            if (data[i][0] === cle) {
                sheetConfig.getRange(i + 1, 2).setValue(valeur);
                return;
            }
        }
        // Si la clé n'existe pas encore, on l'ajoute
        sheetConfig.appendRow([cle, valeur]);
    } catch (e) {
        console.error("Erreur setParam : " + e.toString());
    }
}