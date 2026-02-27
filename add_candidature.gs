/**
 * SCRIPT 1 : Détection, Ajout et Enrichissement de candidatures
 */
function analyserMailsCandidaturesEnvoyees() {
  const nomF = "add_candidature";
  const props = PropertiesService.getScriptProperties();
  const sheetName = props.getProperty('SHEET_NAME');
  
  let stats = { emailsVus: 0, count: 0, enrichis: 0, details: [] };

  console.log(">>> [DEBUT] Lancement du scan des nouvelles candidatures...");

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) throw new Error(`Feuille ${sheetName} introuvable.`);

    const threads = collecterNouvellesCandidatures();
    stats.emailsVus = threads.length;

    if (stats.emailsVus > 0) {
      threads.forEach((thread) => {
        // CHANGEMENT CRUCIAL : On recharge les noms d'entreprises à chaque itération 
        // pour détecter un ajout qui viendrait d'être fait dans la même boucle (ex: LinkedIn + Mail direct)
        const dataTableau = sheet.getRange(1, 1, Math.max(sheet.getLastRow(), 1), 1).getValues();
        
        const resultat = traiterNouvelEmail(thread, sheet, dataTableau);
        
        if (resultat.succes) {
          if (resultat.type === "ajout") {
            stats.count++;
          } else {
            stats.enrichis++;
          }
          stats.details.push(resultat.info);
        }
      });
    }

    // TES LOGS SONT BIEN ICI
    const resume = construireResumeFinal("Ajout/Enrichissement", stats);
    console.log(">>> [LOG EXCEL] Résumé final : " + resume);
    enregistrerLog(nomF, resume, false, "");

  } catch (e) {
    console.error("!!! [ERREUR] : " + e.toString());
    enregistrerLog(nomF, "Erreur Add", true, e.toString());
  }
}

/**
 * REQUÊTE AMÉLIORÉE : LinkedIn + Confirmations directes
 */
function collecterNouvellesCandidatures() {
  const labelName = "IA-Candidature-Ajoutée";
  // Mots-clés élargis pour LinkedIn ("candidature envoyée") et plateformes RH
  const keywords = '(confirmation OR received OR "votre candidature a été envoyée" OR "votre candidature chez" OR "thank you for applying")';
  
  const query = `newer_than:7d -label:${labelName} ${keywords}`;
  return GmailApp.search(query, 0, 15);
}

/**
 * TRAITEMENT : Matching intelligent par Nom et Domaine Email
 */
function traiterNouvelEmail(thread, sheet, dataTableau) {
  const label = GmailApp.getUserLabelByName("IA-Candidature-Ajoutée") || GmailApp.createLabel("IA-Candidature-Ajoutée");
  const message = thread.getMessages()[thread.getMessages().length - 1];
  const body = message.getPlainBody();
  const rawSender = message.getFrom().toLowerCase(); 
  
  // Extraction du domaine de l'expéditeur (ex: @talan.com)
  const domainMatch = rawSender.match(/@([\w.-]+)/);
  let domainSender = domainMatch ? domainMatch[1] : "";
  // Nettoyage pour les outils comme SmartRecruiters
  if (domainSender.includes("smartrecruiters")) domainSender = domainSender.split('.').slice(-2).join('.');

  const prompt = `Analyse ce mail. Est-ce une confirmation de candidature ?
  Réponds en JSON :
  {
    "est_candidature": true/false,
    "entreprise": "...",
    "poste": "...",
    "lieu": "...",
    "lien": "cherche l'URL du bouton 'Accéder à ma candidature' ou 'Suivre ma candidature'"
  }
  Mail : ${body}`;
  
  const data = callGeminiCentral(prompt);
  const safe = (val) => (val && val !== "null" && val !== "undefined") ? val.toString().trim() : "Inconnu";

  if (data && data.est_candidature === true && data.entreprise && data.entreprise.toLowerCase() !== "inconnu") {
    
    let ligneExistante = -1;
    const nomIA = data.entreprise.toLowerCase().trim();

    // LOGIQUE DE MATCHING AMÉLIORÉE (Nom OU Domaine Email)
    for (let i = 0; i < dataTableau.length; i++) {
      const nomCell = dataTableau[i][0].toString().toLowerCase().trim();
      if (nomCell === "") continue;

      const matchNom = nomCell.includes(nomIA) || nomIA.includes(nomCell);
      const matchDomaine = domainSender !== "" && domainSender.includes(nomCell) && !domainSender.includes("linkedin") && !domainSender.includes("gmail");

      if (matchNom || matchDomaine) {
        ligneExistante = i + 1;
        break;
      }
    }

    if (ligneExistante !== -1) {
      // DOUBLON DÉTECTÉ -> ENRICHISSEMENT
      console.log(`  |- [ENRICHIR] Doublon trouvé pour ${data.entreprise} ligne ${ligneExistante}`);
      
      // On ne remplace que si l'ancienne valeur était "Inconnu"
      const currentValues = sheet.getRange(ligneExistante, 1, 1, 8).getValues()[0];
      
      if (currentValues[2] === "Inconnu" && safe(data.poste) !== "Inconnu") sheet.getRange(ligneExistante, 3).setValue(safe(data.poste));
      if (currentValues[4] === "Inconnu" && safe(data.lieu) !== "Inconnu") sheet.getRange(ligneExistante, 5).setValue(safe(data.lieu));
      if ((currentValues[7] === "Inconnu" || currentValues[7] === "" || currentValues[7] === "Ajouté par script") && safe(data.lien) !== "Inconnu") {
        sheet.getRange(ligneExistante, 8).setValue(safe(data.lien));
      }
      
      const ancienneRemarque = sheet.getRange(ligneExistante, 6).getValue();
      sheet.getRange(ligneExistante, 6).setValue(ancienneRemarque + " | Infos enrichies par mail direct.");
      
      thread.addLabel(label);
      return { succes: true, type: "enrichissement", info: `Enrichi: ${data.entreprise}` };

    } else {
      // NOUVEL AJOUT
      const nextRow = sheet.getLastRow() + 1;
      const dateC = Utilities.formatDate(message.getDate(), "GMT+1", "dd/MM/yyyy");
      const formuleStatut = `=IF(G${nextRow}="oui"; IF(TODAY()-B${nextRow}>60; "Refusé"; "En attente"); "")`;

      sheet.getRange(nextRow, 1, 1, 8).setValues([[
        safe(data.entreprise), dateC, safe(data.poste), "", safe(data.lieu), "Ajouté par script", "oui", safe(data.lien)
      ]]);
      sheet.getRange(nextRow, 4).setFormula(formuleStatut);
      
      thread.addLabel(label);
      return { succes: true, type: "ajout", info: `Ajouté: ${data.entreprise} (Ligne ${nextRow})` };
    }
  } else {
    thread.addLabel(label);
    return { succes: false };
  }
}