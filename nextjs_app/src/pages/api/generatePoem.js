// src/pages/api/generatePoem.js
import OpenAI from "openai";

const openai = new OpenAI();
const MODEL_NAME = process.env.OPENAI_MODEL_NAME || "gpt-3.5-turbo";
const CUSTOM_SEPARATOR = "<SEP/>";

const detectLanguage = async (text) => {
    const normalizedText = text.trim().toLowerCase();
    if (/[àáạảãâầấậẩẫăằắặẳẵđèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹ]/i.test(normalizedText)) {
        return 'vietnamese';
    }
    if (/[一-龯ぁ-んァ-ン]/.test(normalizedText)) {
        return 'japanese';
    }
    if (/[가-힣]/.test(normalizedText)) {
        return 'korean';
    }

    return 'english';
};

// This function creates a prompt based on input parameters
const getPoemPromptDetails = (language, mainWord, subWord, emotion) => {
    let styleInstruction = "";
    switch (language.toLowerCase()) {
        case 'vietnamese':
            styleInstruction = process.env.OPENAI_LUCBAT_COMPOSER_STYLE_INSTRUCTION;
            break;
        case 'japanese':
            styleInstruction = process.env.OPENAI_HAIKU_COMPOSER_STYLE_INSTRUCTION;
            break;
        case 'english':
        default:
            styleInstruction = process.env.OPENAI_ENGLISH_FREEVERSE_COMPOSER_STYLE_INSTRUCTION;
            break;
    }

    const inputPrompt = `${styleInstruction}
    Using the words "${mainWord}" and "${subWord}" as the main theme of the poem.
    Generate a poem with the following emotion: ${emotion}.
    Follow these steps:
    1. Generate poem.
    2. Self-evaluate with the rule of the poem and re-generate until it matches the rule 
    3. Keep the final poem in JSON block at the end.

    Output format:
    ... (text from step 1, 2) ...
    ${CUSTOM_SEPARATOR}
    {
      "poem": "Line 1 of the poem\\nLine 2 of the poem\\nLine 3..."
    }
    `;
    return inputPrompt;
};

export default async function handler(req, res) {
    if (req.method === 'POST') {
        try {
            const { mainWord, subWord, emotion } = req.body;

            // Validate required fields (language removed)
            if (!mainWord || !subWord || !emotion) {
                return res.status(400).json({ error: 'Missing required fields for poem generation: mainWord, subWord, emotion.' });
            }

            // Detect language for mainWord and subWord
            const mainWordLanguage = await detectLanguage(mainWord);
            const subWordLanguage = await detectLanguage(subWord);

            // Prioritize subWord's language if they differ
            const detectedLanguage = mainWordLanguage !== subWordLanguage ? subWordLanguage : mainWordLanguage;

            // Generate prompt with detected language
            const inputPrompt = getPoemPromptDetails(detectedLanguage, mainWord, subWord, emotion);

            console.log("--- Generating Poem ---");
            console.log("Params:", { mainWord, subWord, emotion, detectedLanguage });

            const completion = await openai.chat.completions.create({
                model: MODEL_NAME,
                max_tokens: 1000,
                messages: [
                    { role: "user", content: inputPrompt }
                ],
            });

            let rawResponseContent = completion.choices[0].message.content;
            if (!rawResponseContent || rawResponseContent.trim() === "") {
                console.warn("OpenAI returned empty or whitespace-only content.");
                return res.status(500).json({ error: 'The model returned an empty response. Please try again.' });
            }

            rawResponseContent = rawResponseContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
            console.log("Raw OpenAI Response Content:\n", rawResponseContent);

            const parts = rawResponseContent.split(CUSTOM_SEPARATOR);
            let jsonData = null;

            if (parts.length > 1) {
                const jsonStringCandidate = parts[parts.length - 1].trim();
                if (jsonStringCandidate.startsWith("{") && jsonStringCandidate.endsWith("}")) {
                    try {
                        jsonData = JSON.parse(jsonStringCandidate);
                    } catch (e) {
                        console.warn(`Failed to parse JSON string after separator: "${jsonStringCandidate}"`, e.message);
                    }
                } else {
                    console.warn(`Content after separator "${CUSTOM_SEPARATOR}" does not look like JSON: "${jsonStringCandidate}"`);
                }
            } else {
                console.warn(`Custom separator "${CUSTOM_SEPARATOR}" not found in the model's response.`);
            }

            if (!jsonData || typeof jsonData.poem !== 'string') {
                console.error("Failed to extract valid JSON with 'poem' key using the custom separator.");
                console.error("Original raw content was:", rawResponseContent);
                console.error("Attempted JSON data was:", jsonData);
                return res.status(500).json({
                    error: `The model's response did not contain the poem in the expected JSON format after the "${CUSTOM_SEPARATOR}" separator. Please check server logs.`,
                    rawResponse: rawResponseContent
                });
            }

            const poemText = jsonData.poem;

            if (poemText.trim() === "") {
                console.warn("Extracted poem from JSON is empty.");
                return res.status(500).json({ error: 'The model returned an empty poem within the JSON. Please try again.' });
            }

            res.status(200).json({ poem: poemText });

        } catch (error) {
            console.error('Error in /api/generatePoem handler:', error);
            let errorMessage = `Failed to generate poem: ${error.message || error.toString()}`;
            if (error.response && error.response.data) {
                errorMessage += ` - OpenAI Error: ${JSON.stringify(error.response.data)}`;
            }
            res.status(500).json({ error: errorMessage });
        }
    } else {
        res.setHeader('Allow', ['POST']);
        res.status(405).end(`Method ${req.method} Not Allowed`);
    }
}