/**
 * 🕵️‍♂️ MOTEUR DE DÉTECTION DE NEWSLETTERS (Version Corrective Finale)
 * Force l'extraction du texte même pour les newsletters HTML complexes.
 */
function detecterEtConfigurerNewsletters() {
  const props = PropertiesService.getScriptProperties();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetConfig = ss.getSheetByName(props.getProperty('SHEET_NEWSLETTER_CONFIG') || 'config');
  
  if (!sheetConfig) {
    console.error("❌ [STOP] L'onglet de config est introuvable.");
    return;
  }

  // 1. CHARGEMENT DE LA MÉMOIRE (Liste blanche)
  const lastRow = sheetConfig.getLastRow();
  const emailsConfigures = lastRow > 1 
    ? sheetConfig.getRange(2, 4, lastRow - 1, 1).getValues().flat().map(e => String(e).toLowerCase().trim())
    : [];
  
  console.log(`🚀 [START] Analyse. ${emailsConfigures.length} sources déjà connues.`);

  // 2. REQUÊTE GMAIL (Scan 15 jours sans label de sourcing)
  const query = "newer_than:15d -is:chats -label:Newslatter-jobs-extraites";
  const threads = GmailApp.search(query, 0, 20); 
  console.log(`📬 [GMAIL] ${threads.length} fils de discussion trouvés.`);

  const suspects = {};

  // 3. EXTRACTION INTELLIGENTE DU TEXTE (Anti-Undefined)
  threads.forEach(thread => {
    const msg = thread.getMessages()[0];
    const from = msg.getFrom().replace(/.*<|>.*/g, "").toLowerCase().trim();

    if (emailsConfigures.includes(from)) return;

    if (!suspects[from]) {
      // --- FORCE BRUTE : On tente le texte brut, sinon on nettoie le HTML ---
      let content = msg.getPlainBody();
      
      if (!content || content.length < 100) {
        console.log(`⚠️ [CLEANING] Texte vide pour ${from}, extraction du HTML...`);
        // On récupère le HTML, on vire le CSS/Scripts et on garde le texte
        content = msg.getBody()
          .replace(/<style([\s\S]*?)<\/style>/gi, '')
          .replace(/<script([\s\S]*?)<\/script>/gi, '')
          .replace(/<[^>]*>/g, ' ')
          .replace(/\s+/g, ' '); 
      }

      suspects[from] = {
        sample: content.substring(0, 1500).trim() // On envoie un gros bloc pour l'analyse
      };
    }
  });

  // 4. JUGEMENT IA ET LOGS
  let ajouts = 0;
  Object.keys(suspects).forEach(email => {
    console.log(`🤖 [IA] Analyse de : ${email}...`);
    const verdict = demanderVerdictIA(email, suspects[email].sample);
    
    if (verdict.estValide) {
      console.log(`✅ [OUI] ${email} ajouté.`);
      sheetConfig.appendRow(["", "", "", email, "Flexible"]);
      ajouts++;
    } else {
      console.log(`❌ [NON] ${email} ignoré. Raison : ${verdict.justification}`);
    }

    // Log Excel systématique pour comprendre les décisions
    if (typeof enregistrerLog === "function") {
      const status = verdict.estValide ? "AJOUTÉ" : "REJETÉ";
      enregistrerLog("CONFIG", `${status} : ${email}`, !verdict.estValide, `IA : ${verdict.justification}`);
    }
  });

  return `Analyse terminée. ${ajouts} source(s) ajoutée(s).`;
}

/**
 * Appelle Gemini et parse la réponse proprement
 */
/**
 * Appelle Gemini et parse la réponse JSON structurée
 */
function demanderVerdictIA(email, texte) {
  // On adapte le prompt pour demander explicitement du JSON
  const prompt = `Analyse cet email de "${email}". Est-ce une newsletter d'offres d'emploi, de stages ou d'alternances ?
    
    TEXTE : "${texte}"
    
    Réponds au format JSON suivant :
    {
      "verdict": "OUI" ou "NON",
      "raison": "Une phrase courte expliquant pourquoi"
    }`;

  try {
    // callGeminiCentral renvoie déjà un objet JSON parsé grâce à ton code
    const resIA = callGeminiCentral(prompt);
    
    if (!resIA) {
      return { estValide: false, justification: "L'IA n'a pas répondu (Quota ou Erreur)." };
    }

    // On accède directement aux propriétés de l'objet
    const estValide = (resIA.verdict === "OUI");
    const justification = resIA.raison || "Aucune explication fournie par l'IA.";

    return { estValide: estValide, justification: justification };

  } catch (e) {
    console.error(`❌ Erreur dans demanderVerdictIA pour ${email} : ${e}`);
    return { estValide: false, justification: "Erreur technique de lecture JSON." };
  }
}