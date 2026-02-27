/**
 * MOTEUR IA CENTRALISÉ (Version Stable Corrigée)
 */
function callGeminiCentral(promptText) {
  const props = PropertiesService.getScriptProperties();
  const apiKey = props.getProperty('GEMINI_KEY');
  const model = props.getProperty('MODEL_NAME');
  
  // Utilisation de v1beta pour un meilleur support du JSON mode
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  
  const payload = {
    "contents": [{ "parts": [{ "text": promptText }] }],
    "generationConfig": {
      "temperature": 0.1,
      "response_mime_type": "application/json" // CORRECTION : avec des underscores _
    }
  };

  const options = {
    "method": "post",
    "contentType": "application/json",
    "payload": JSON.stringify(payload),
    "muteHttpExceptions": true
  };

  try {
    const res = UrlFetchApp.fetch(url, options);
    const content = res.getContentText();
    const json = JSON.parse(content);
    
    if (res.getResponseCode() !== 200) {
      console.error("Erreur API : " + content);
      return null;
    }

    const rawText = json.candidates[0].content.parts[0].text.trim();
    // Nettoyage au cas où, même en mode JSON
    const cleanJson = rawText.replace(/```json|```/g, "").trim();
    return JSON.parse(cleanJson);
    
  } catch (e) {
    console.error("Erreur critique callGeminiCentral : " + e);
    return null;
  }
}