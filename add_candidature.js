/**
 * CONFIGURATION : Blacklist pour ignorer les publicités/alertes jobs
 */
const CONFIG_S1 = {
  "blacklist": [
    "jobalerts-noreply@linkedin.com",
    "jobs-listings@linkedin.com",
    "notifications-noreply@linkedin.com",
    "no-reply@glassdoor.com"
  ]
};

/**
 * SCRIPT 1 : Détection, Ajout et Enrichissement avec Logs détaillés
 */
function analyserMailsCandidaturesEnvoyees() {
  const nomF = "add_candidature";
  const props = PropertiesService.getScriptProperties();
  const sheetName = props.getProperty('SHEET_NAME');
  
  let stats = { scannes: 0, ajouts: 0, enrichis: 0, details: [] };

  console.log(">>> [DEBUT] Scan des candidatures avec Audit Logs...");

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) throw new Error(`Feuille ${sheetName} introuvable.`);

    const threads = collecterNouvellesCandidatures();
    stats.scannes = threads.length;

    if (stats.scannes > 0) {
      for (const thread of threads) {
        // On récupère le tableau à chaque fois pour voir les ajouts immédiats
        const dataTableau = sheet.getRange(1, 1, Math.max(sheet.getLastRow(), 1), 8).getValues();
        
        const resultat = traiterNouvelEmailAmeliore(thread, sheet, dataTableau);
        
        if (resultat && resultat.succes) {
          if (resultat.type === "ajout") stats.ajouts++;
          if (resultat.type === "enrichissement") stats.enrichis++;
          stats.details.push(resultat.info);
          
          SpreadsheetApp.flush();
          // LABELLISATION UNIQUEMENT SI ACTION REUSSIE
          const label = GmailApp.getUserLabelByName("IA-Candidature-Ajoutée") || GmailApp.createLabel("IA-Candidature-Ajoutée");
          thread.addLabel(label);
        }
      }
    }

    const resume = `Scan: ${stats.scannes} | Ajouts: ${stats.ajouts} | Enrichis: ${stats.enrichis}`;
    console.log(">>> [RESUME FINAL] : " + resume);
    enregistrerLog(nomF, resume, false, stats.details.join("\n"));

  } catch (e) {
    console.error("!!! [ERREUR S1] : " + e.toString());
    if (typeof enregistrerLog === "function") {
      enregistrerLog(nomF, "Erreur Add", true, e.toString());
    }
  }
}

/**
 * COLLECTE : Recherche Gmail (1 jours)
 */
function collecterNouvellesCandidatures() {
  const query = 'newer_than:1d -label:IA-Candidature-Ajoutée (confirmation OR received OR "candidature envoyée" OR "thank you for applying")';
  return GmailApp.search(query, 0, 15);
}

/**
 * TRAITEMENT : Analyse avec logs de contenu
 */
function traiterNouvelEmailAmeliore(thread, sheet, dataTableau) {
  const message = thread.getMessages().pop();
  const rawSender = message.getFrom().toLowerCase();
  const subject = message.getSubject();
  const body = message.getPlainBody();
  const snippet = body.substring(0, 100).replace(/\n/g, " "); // Bribe du mail pour les logs

  console.log(`[SCAN] Sujet: "${subject}" | Expéditeur: ${rawSender}`);
  console.log(`       |_ Bribe: "${snippet}..."`);

  // 1. FILTRE BLACKLIST
  if (CONFIG_S1.blacklist.some(b => rawSender.includes(b))) {
    console.log(`| - [IGNORE] Blacklist détectée (${rawSender}). Pas de label posé.`);
    return { succes: false };
  }

  // 2. ANALYSE IA
  const prompt = `Analyse ce mail. Est-ce une confirmation de candidature ?
  Expéditeur : "${rawSender}" | Sujet : "${subject}"
  Réponds en JSON :
  {"est_candidature": true, "entreprise": "...", "poste": "...", "lieu": "...", "lien": "URL"}
  Mail : ${body}`;
  
  const data = callGeminiCentral(prompt);
  if (!data || !data.est_candidature || !data.entreprise) {
    console.log(`| - [IA] Verdict: Ce n'est pas une candidature valide.`);
    return { succes: false };
  }

  // 3. MATCHING NORMALISÉ
  let ligneExistante = -1;
  const nomIA = normaliserS1(data.entreprise);
  const domainSender = rawSender.match(/@([\w.-]+)/) ? rawSender.match(/@([\w.-]+)/)[1] : "";

  for (let i = 0; i < dataTableau.length; i++) {
    const nomCell = normaliserS1(dataTableau[i][0].toString());
    if (nomCell === "") continue;

    const matchNom = nomCell.includes(nomIA) || nomIA.includes(nomCell);
    const matchDomaine = domainSender !== "" && domainSender.includes(nomCell) && !domainSender.includes("linkedin") && !domainSender.includes("gmail");

    if (matchNom || matchDomaine) {
      ligneExistante = i + 1;
      console.log(`| - [LOGIQUE] Match trouvé pour "${data.entreprise}" (Ligne ${ligneExistante}) via ${matchDomaine ? 'Domaine' : 'Nom'}.`);
      break;
    }
  }

  const safe = (val) => (val && val !== "null" && val !== "undefined") ? val.toString().trim() : "Inconnu";

  if (ligneExistante !== -1) {
    // --- ENRICHISSEMENT ---
    const current = dataTableau[ligneExistante-1];
    let modifications = [];

    if (current[2] === "Inconnu" && safe(data.poste) !== "Inconnu") {
      sheet.getRange(ligneExistante, 3).setValue(safe(data.poste));
      modifications.push("Poste");
    }
    if (current[4] === "Inconnu" && safe(data.lieu) !== "Inconnu") {
      sheet.getRange(ligneExistante, 5).setValue(safe(data.lieu));
      modifications.push("Lieu");
    }
    if ((current[7] === "" || current[7] === "Inconnu") && safe(data.lien) !== "Inconnu") {
      sheet.getRange(ligneExistante, 8).setValue(safe(data.lien));
      modifications.push("Lien");
    }
    
    console.log(`| - [ACTION] Enrichissement effectué: ${modifications.length > 0 ? modifications.join(", ") : "Aucune info manquante"}`);
    return { succes: true, type: "enrichissement", info: `Enrichi: ${data.entreprise}` };
    
  } else {
    // --- NOUVEL AJOUT ---
    const nextRow = sheet.getLastRow() + 1;
    const dateC = Utilities.formatDate(message.getDate(), "GMT+1", "dd/MM/yyyy");
    const formuleStatut = `=IF(G${nextRow}="oui"; IF(TODAY()-B${nextRow}>60; "Refusé"; "En attente"); "")`;

    console.log(`| - [ACTION] Ajout d'une nouvelle ligne pour "${data.entreprise}" à la ligne ${nextRow}.`);
    sheet.appendRow([safe(data.entreprise), dateC, safe(data.poste), "", safe(data.lieu), "Ajouté par script", "oui", safe(data.lien)]);
    sheet.getRange(nextRow, 4).setFormula(formuleStatut);
    
    return { succes: true, type: "ajout", info: `Ajouté: ${data.entreprise}` };
  }
}

/**
 * UTILS : Normalisation (Minuscules, sans accents)
 */
function normaliserS1(t) {
  if (!t) return "";
  return t.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/(hiring team|team|group|sas|inc|corp|ltd)/gi, "")
    .trim();
}