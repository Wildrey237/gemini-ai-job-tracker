/**
 * MOTEUR IA CENTRALISÉ (Version Pilotée par l'onglet Config)
 */
function callGeminiCentral(promptText) {
    const apiKey = getParam('GEMINI_KEY');
    const model = getParam('MODEL_NAME') || 'gemini-2.5-flash';

    if (!apiKey) {
        console.error("ERREUR : Clé API GEMINI_KEY manquante.");
        return null;
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const payload = {
        contents: [
            {
                parts: [{ text: promptText }]
            }
        ],
        generationConfig: {
            temperature: 0.1,
            response_mime_type: "application/json"
        }
    };

    const options = {
        method: "post",
        contentType: "application/json",
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
    };

    try {
        const res = UrlFetchApp.fetch(url, options);
        const code = res.getResponseCode();
        const content = res.getContentText();

        if (code !== 200) {
            console.error(`❌ Erreur API Gemini (${code}) : ${content}`);
            return null;
        }

        const json = JSON.parse(content);

        if (
            !json.candidates ||
            !json.candidates[0] ||
            !json.candidates[0].content ||
            !json.candidates[0].content.parts ||
            !json.candidates[0].content.parts[0] ||
            !json.candidates[0].content.parts[0].text
        ) {
            console.error("❌ Réponse Gemini vide ou structure inattendue.");
            console.error(content);
            return null;
        }

        let rawText = json.candidates[0].content.parts[0].text.trim();

        // Nettoyage plus robuste
        rawText = rawText
            .replace(/^```json\s*/i, "")
            .replace(/^```\s*/i, "")
            .replace(/\s*```$/i, "")
            .trim();

        try {
            const parsed = JSON.parse(rawText);
            console.log("[DEBUG GEMINI PARSED] " + JSON.stringify(parsed));
            return parsed;
        } catch (parseError) {
            console.error("❌ JSON Gemini invalide après nettoyage.");
            console.error("RAW TEXT = " + rawText);
            return null;
        }

    } catch (e) {
        console.error("❌ Erreur critique callGeminiCentral : " + e.toString());
        return null;
    }
}