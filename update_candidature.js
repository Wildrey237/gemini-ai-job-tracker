/**
 * SCRIPT 2 : Mise à jour, Sécurité Fallback et Gestion Calendrier
 */
function analyserMailsReponsesRecues() {
  const nomF = "update_candidature";
  const props = PropertiesService.getScriptProperties();
  const nomSheet = props.getProperty('SHEET_NAME');
  
  let stats = { emailsVus: 0, count: 0, details: [] };
  let alertesManuelles = [];

  console.log(">>> [DEBUT] Lancement de l'analyse globale...");

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(nomSheet);
    if (!sheet) throw new Error(`Feuille ${nomSheet} introuvable.`);

    // --- CORRECTION : La fonction collecterEmailsATraiter est définie plus bas ---
    const threads = collecterEmailsATraiter();
    stats.emailsVus = threads.length;

    if (stats.emailsVus > 0) {
      const dataTableau = sheet.getRange(1, 1, sheet.getLastRow(), 1).getValues();

      threads.forEach((thread) => {
        const resultat = traiterUnFil(thread, sheet, dataTableau);
        
        if (resultat.succes) {
          stats.count++;
          stats.details.push(resultat.info);
        } else if (resultat.erreurIA || resultat.nonTrouve) {
          alertesManuelles.push(resultat.info);
          stats.details.push(`⚠️ ${resultat.info}`);
        }
      });
    }

    const resume = construireResumeFinal("Mise à jour", stats);
    console.log(">>> [LOG EXCEL] : " + resume);
    enregistrerLog(nomF, resume, false, "");

    if (alertesManuelles.length > 0) {
      envoyerMailAlerteGroupee(alertesManuelles);
    }

  } catch (e) {
    console.error("!!! [ERREUR] : " + e.toString());
    // Vérifie si la fonction enregistrerLog existe dans ton fichier de logs
    if (typeof enregistrerLog === "function") {
      enregistrerLog(nomF, "Échec du scan", true, e.toString());
    }
  }
}

/**
 * FONCTION DE COLLECTE (Celle qui manquait)
 */
function collecterEmailsATraiter() {
  console.log("[COLLECTE] Recherche Gmail en cours...");
  const labelSource = "IA-Candidature-Ajoutée";
  const labelTraite = "IA-Réponse-Traitée";
  
  const keywords = '(entretien OR interview OR invitation OR "follow up" OR "next steps" OR application OR candidacy OR candidature OR "hiring process" OR "moving forward")';
  
  const queryFils = `label:${labelSource} -label:${labelTraite}`;
  const queryRH = `newer_than:2d -label:${labelSource} -label:${labelTraite} ${keywords}`;

  const threadsFils = GmailApp.search(queryFils);
  const threadsRH = GmailApp.search(queryRH);
  
  const allThreads = threadsFils.concat(threadsRH);
  return allThreads.filter((t, i) => allThreads.findIndex(t2 => t2.getId() === t.getId()) === i);
}

/**
 * SOUS-FONCTION : Analyse, Mise à jour et Calendrier
 */
function traiterUnFil(thread, sheet, dataTableau) {
  const messages = thread.getMessages();
  const lastMessage = messages[messages.length - 1];
  const sujet = lastMessage.getSubject();
  const corpsMail = lastMessage.getPlainBody();
  
  const labelTraite = GmailApp.getUserLabelByName("IA-Réponse-Traitée") || GmailApp.createLabel("IA-Réponse-Traitée");
  const labelAlerte = GmailApp.getUserLabelByName("IA-A-VÉRIFIER") || GmailApp.createLabel("IA-A-VÉRIFIER");

  if (messages.length < 2 && !sujet.toLowerCase().includes("re:")) return { succes: false };

  // A. ANALYSE VERDICT
  console.log(`  |- Analyse IA pour : ${sujet}`);
  const prompt = `Analyse ce mail. Identifie l'entreprise et le verdict ("Refusé" ou "Entretien"). Réponds en JSON : {"entreprise": "nom", "verdict": "statut", "details": "..."}. Mail : ${corpsMail}`;
  const analyse = callGeminiCentral(prompt);

  if (!analyse || !analyse.entreprise || analyse.entreprise === "Inconnu") {
    thread.addLabel(labelAlerte);
    ajouterLigneTemporaire(sheet, "A VERIFIER (IA ECHEC)", sujet, "#fff3cd");
    return { succes: false, erreurIA: true, info: `Analyse échouée (${sujet})` };
  }

  // B. MATCHING
  let ligneIndex = -1;
  const nomIA = analyse.entreprise.toLowerCase().trim();
  for (let i = 0; i < dataTableau.length; i++) {
    const nomCell = dataTableau[i][0].toString().toLowerCase().trim();
    if (nomCell !== "" && (nomCell.includes(nomIA) || nomIA.includes(nomCell))) {
      ligneIndex = i + 1;
      break;
    }
  }

  // C. ACTIONS SI MATCH
  if (ligneIndex !== -1) {
    const dateJour = Utilities.formatDate(new Date(), "GMT+1", "dd/MM/yyyy");
    sheet.getRange(ligneIndex, 4).setValue(analyse.verdict);
    sheet.getRange(ligneIndex, 9).setValue(dateJour);
    
    const ancienneRemarque = sheet.getRange(ligneIndex, 6).getValue();
    let nouvelleRemarque = `[${dateJour}] ${analyse.details}`;

    if (analyse.verdict.includes("Entretien")) {
      const rdvInfo = extraireDateCalendrier(corpsMail);
      if (rdvInfo && rdvInfo.date !== "inconnu") {
        creerEvenementCalendrier(analyse.entreprise, rdvInfo, thread.getPermalink());
        nouvelleRemarque += ` | 📅 RDV : ${rdvInfo.date} à ${rdvInfo.heure}`;
      }
    }

    sheet.getRange(ligneIndex, 6).setValue(ancienneRemarque ? `${ancienneRemarque} | ${nouvelleRemarque}` : nouvelleRemarque);
    sheet.getRange(ligneIndex, 1, 1, 9).setBackground(analyse.verdict.includes("Entretien") ? "#cfe2ff" : "#f8d7da");
    
    thread.addLabel(labelTraite);
    return { succes: true, info: `${analyse.entreprise} (Ligne ${ligneIndex})` };
  } else {
    thread.addLabel(labelAlerte);
    ajouterLigneTemporaire(sheet, analyse.entreprise, `Non trouvé. Verdict: ${analyse.verdict}`, "#f8d7da");
    return { succes: false, nonTrouve: true, info: `${analyse.entreprise} (Non trouvé)` };
  }
}

/**
 * HELPERS
 */
function extraireDateCalendrier(corps) {
  const prompt = `Extrais la date et l'heure d'entretien. Réponds UNIQUEMENT en JSON : {"date": "YYYY-MM-DD", "heure": "HH:MM", "duree": 60}. Si pas de date précise, {"date": "inconnu"}. Mail : ${corps}`;
  return callGeminiCentral(prompt);
}

function creerEvenementCalendrier(entreprise, rdv, mailLink) {
  try {
    const start = new Date(`${rdv.date}T${rdv.heure}:00`);
    const end = new Date(start.getTime() + (rdv.duree || 60) * 60000);
    CalendarApp.getDefaultCalendar().createEvent(
      `Entretien : ${entreprise}`,
      start,
      end,
      { description: `Lien vers le mail : ${mailLink}`, location: entreprise }
    );
  } catch(e) { console.error("Erreur Calendrier: " + e); }
}

function ajouterLigneTemporaire(sheet, entreprise, note, couleur) {
  const row = sheet.getLastRow() + 1;
  sheet.appendRow([entreprise, "", "", "A VERIFIER", "", note, "non", ""]);
  sheet.getRange(row, 1, 1, 8).setBackground(couleur);
}

function envoyerMailAlerteGroupee(alertes) {
  const destinataire = Session.getActiveUser().getEmail();
  const corps = "Bonjour,\n\nLe script a détecté des réponses à vérifier :\n\n- " + 
                alertes.join("\n- ") + 
                "\n\nLignes ajoutées en bas du tableau.";
  MailApp.sendEmail(destinataire, "⚠️ Action requise : Réponses candidatures", corps);
}