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

    const MAX_TENTATIVES = 3;
    const DELAIS_RETRY = [30000, 60000]; // 30s puis 60s

    for (let tentative = 1; tentative <= MAX_TENTATIVES; tentative++) {
        try {
            const res = UrlFetchApp.fetch(url, options);
            const code = res.getResponseCode();
            const content = res.getContentText();

            if (code === 429) {
                if (tentative < MAX_TENTATIVES) {
                    const delai = DELAIS_RETRY[tentative - 1] || 60000;
                    console.warn(`⚠️ [API] Rate limit 429 — tentative ${tentative}/${MAX_TENTATIVES}. Attente ${delai / 1000}s...`);
                    Utilities.sleep(delai);
                    continue;
                } else {
                    console.error(`❌ [API] Quota épuisé après ${MAX_TENTATIVES} tentatives. Abandon.`);
                    return null;
                }
            }

            if (code !== 200) {
                console.error(`❌ [API] Erreur Gemini (${code}) : ${content}`);
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
                console.error("❌ [API] Réponse Gemini vide ou structure inattendue.");
                console.error(content);
                return null;
            }

            let rawText = json.candidates[0].content.parts[0].text.trim();

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
                console.error("❌ [API] JSON Gemini invalide après nettoyage.");
                console.error("RAW TEXT = " + rawText);
                return null;
            }

        } catch (e) {
            console.error("❌ [API] Erreur critique callGeminiCentral : " + e.toString());
            return null;
        }
    }

    return null;
}

/**
 * Vérifie que l'API Gemini est opérationnelle avant de lancer un pipeline.
 * Retourne true si l'API répond, false sinon.
 * Consomme 1 appel sur le quota — à appeler une seule fois par exécution.
 */
function verifierAPIGemini() {
    const apiKey = getParam('GEMINI_KEY');
    const model = getParam('MODEL_NAME') || 'gemini-2.5-flash';

    if (!apiKey) {
        console.error("❌ [API CHECK] Clé GEMINI_KEY manquante.");
        return false;
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const payload = {
        contents: [{ parts: [{ text: 'Réponds uniquement: {"ok":true}' }] }],
        generationConfig: { temperature: 0, response_mime_type: "application/json" }
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
        if (code === 200) {
            console.log("✅ [API CHECK] Gemini opérationnel.");
            return true;
        }
        console.error(`❌ [API CHECK] Gemini indisponible — code ${code} : ${res.getContentText()}`);
        return false;
    } catch (e) {
        console.error("❌ [API CHECK] Erreur réseau : " + e.toString());
        return false;
    }
}
