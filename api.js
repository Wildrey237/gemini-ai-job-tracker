/**
 * MOTEUR IA CENTRALISÉ (Version Stable Corrigée)
 */
function callGeminiCentral(promptText) {
  const props = PropertiesService.getScriptProperties();
  const apiKey = props.getProperty('GEMINI_KEY');
  const model = props.getProperty('MODEL_NAME');
  
  // Validation de la présence de la clé API
  if (!apiKey) {
    console.error("ERREUR : Clé API GEMINI_KEY manquante dans les propriétés.");
    return null; 
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  
  const payload = {
    "contents": [{ "parts": [{ "text": promptText }] }],
    "generationConfig": {
      "temperature": 0.1,
      "response_mime_type": "application/json"
    }
  };

  const options = {
    "method": "post",
    "contentType": "application/json",
    "payload": JSON.stringify(payload),
    "muteHttpExceptions": true // On garde à true pour gérer les codes d'erreur nous-mêmes
  };

  try {
    const res = UrlFetchApp.fetch(url, options);
    const code = res.getResponseCode();
    const content = res.getContentText();
    
    // --- GESTION DES ERREURS D'API (VERROU) ---
    if (code !== 200) {
      if (code === 429) {
        console.warn("⚠️ Quota dépassé (Rate Limit). Le script va s'arrêter pour sécurité.");
        console.warn(content)
      } else if (code === 401 || code === 403) {
        console.error("❌ Problème d'authentification ou Clé API invalide.");
      } else {
        console.error(`❌ Erreur API Gemini (Code ${code}) : ${content}`);
      }
      return null; // Déclenchera l'arrêt du script dans traiterUnFil
    }

    const json = JSON.parse(content);
    
    // Vérification de la structure de réponse
    if (!json.candidates || !json.candidates[0].content) {
      console.error("❌ Réponse Gemini vide ou bloquée par les filtres de sécurité.");
      return null;
    }

    let rawText = json.candidates[0].content.parts[0].text.trim();
    
    // Nettoyage de la chaîne (enlève les balises ```json si présentes malgré le mime_type)
    const cleanJson = rawText.replace(/^```json|```$/g, "").trim();
    
    return JSON.parse(cleanJson);
    
  } catch (e) {
    console.error("❌ Erreur critique callGeminiCentral : " + e.toString());
    return null; // Déclenchera l'arrêt du script
  }
}