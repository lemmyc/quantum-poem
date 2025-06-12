// src/pages/api/generatePoem.js
import OpenAI from "openai";

// --- Constants & Configuration ---
const openai = new OpenAI(); 
const MODEL_NAME = process.env.OPENAI_MODEL_NAME || "gpt-4.1";
const MAX_TOKENS = 8192;
const PYTHON_API_BASE_URL = process.env.PYTHON_API_URL || "http://localhost:8000";
const SEARCH_API_URL = PYTHON_API_BASE_URL + "/api/search-poem";
const SEARCH_API_TOP_K = 5;
const CUSTOM_SEPARATOR = "<SEP/>";

// --- Helper Functions ---

const detectLanguage = async (text) => {
  const normalizedText = text.trim().toLowerCase();
  if (
    /[àáạảãâầấậẩẫăằắặẳẵđèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹ]/i.test(
      normalizedText
    )
  ) {
    return "vietnamese";
  }
  if (/[一-龯ぁ-んァ-ン]/.test(normalizedText)) {
    return "japanese";
  }
  if (/[가-힣]/.test(normalizedText)) {
    return "korean";
  }
  return "english";
};

// CHANGE: Add `previousPoem` parameter
const getPoemPromptDetails = (
  language,
  mainWord,
  subWord,
  emotion,
  referencePoemsText = "",
  previousPoem = "" // NEW: Parameter for previously generated poem
) => {
  let styleInstruction = "";
  switch (language.toLowerCase()) {
    case "vietnamese":
      styleInstruction = process.env.OPENAI_LUCBAT_COMPOSER_STYLE_INSTRUCTION;
      break;
    case "japanese":
      styleInstruction = process.env.OPENAI_HAIKU_COMPOSER_STYLE_INSTRUCTION;
      break;
    case "korean":
      styleInstruction =
        process.env.OPENAI_SIJO_POEM_COMPOSER_STYLE_INSTRUCTION;
      break;
    case "english":
    default:
      styleInstruction =
        process.env.OPENAI_EN_HAIKU_COMPOSER_STYLE_INSTRUCTION;
      break;
  }
  
  // NEW: Create regeneration instruction if `previousPoem` exists
  let regenerateInstruction = "";
  if (previousPoem && previousPoem.trim() !== "") {
    regenerateInstruction = `
---
This is the poem you generated in the previous turn:
"""
${previousPoem}
"""
Now, please generate a new and different poem. The new poem should be thematically related to or a continuation of the previous one, but do not simply copy or make minor edits to it.
---
`;
  }

  // CHANGE: Insert `regenerateInstruction` at {UPDATE_HERE}
  const inputPrompt = `${styleInstruction}
  
${referencePoemsText}
${styleInstruction}
Let the ideas and imagery of "${mainWord}" and "${subWord}" inspire the main theme of the poem, but you do not need to use these exact words in the poem.
Generate a poem with the following emotion: ${emotion}.
${regenerateInstruction}
Follow these steps:
1. Generate poem.
2. Self-evaluate with the rule of the poem and re-generate until it matches the rule.
3. Keep the final poem in JSON block at the end.

Output format:
... (text from step 1, 2) ...
${CUSTOM_SEPARATOR}
{
  "poem": "Line 1 of the poem\\nLine 2 of the poem\\nLine 3..."
}
`;
  return inputPrompt.trim();
};

// CHANGE: Add `topK` parameter for customization
const fetchReferencePoems = async (query, languageCode, topK) => {
  try {
    const response = await fetch(SEARCH_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        top_k: topK, // CHANGE: Use the `topK` value passed in
        language: languageCode,
      }),
    });

    if (!response.ok) {
      console.warn(
        `Search API request failed with status: ${response.status}. Proceeding without reference poems.`
      );
      return "";
    }

    const data = await response.json();
    if (data && Array.isArray(data.results) && data.results.length > 0) {
      const poemsFormatted = data.results
        .map(
          (result, index) =>
            `Reference Poem ${index + 1}:\n"""\n${result.content}\n"""`
        )
        .join("\n\n---\n\n");

      return `
REFERENCE POEMS SECTION
For inspiration, you can refer to the soul, color, and style of the following poems. 
Do not copy them; use them only to shape the style of the poem you are about to compose.


${poemsFormatted}

END OF REFERENCE POEMS SECTION 
`;
    }
  } catch (searchError) {
    console.warn(
      `Could not fetch reference poems. Proceeding without them. Error: ${searchError.message}`
    );
  }
  return "";
};

const parsePoemFromResponse = (rawContent) => {
  if (!rawContent || rawContent.trim() === "") {
    console.warn("OpenAI returned empty or whitespace-only content.");
    return null;
  }

  const normalizedContent = rawContent
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
  const parts = normalizedContent.split(CUSTOM_SEPARATOR);

  if (parts.length < 2) {
    console.warn(
      `Custom separator "${CUSTOM_SEPARATOR}" not found in the model's response.`
    );
    return null;
  }

  const jsonStringCandidate = parts[parts.length - 1].trim();
  const jsonStartIndex = jsonStringCandidate.indexOf("{");
  const jsonEndIndex = jsonStringCandidate.lastIndexOf("}");

  if (jsonStartIndex === -1 || jsonEndIndex === -1) {
    console.warn(
      `Content after separator does not look like JSON: "${jsonStringCandidate}"`
    );
    return null;
  }

  try {
    const jsonString = jsonStringCandidate.substring(
      jsonStartIndex,
      jsonEndIndex + 1
    );
    const jsonData = JSON.parse(jsonString);

    if (
      jsonData &&
      typeof jsonData.poem === "string" &&
      jsonData.poem.trim() !== ""
    ) {
      return jsonData.poem;
    } else {
      console.warn(
        "Extracted poem from JSON is empty or key 'poem' is missing/invalid.",
        { jsonData }
      );
      return null;
    }
  } catch (e) {
    console.warn(
      `Failed to parse JSON string: "${jsonStringCandidate}"`,
      e.message
    );
    return null;
  }
};

// --- API Handler ---

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    const { mainWord, subWord, emotion, previousPoem } = req.body;

    if (!mainWord || !subWord || !emotion) {
      return res.status(400).json({
        error: "Missing required fields: mainWord, subWord, emotion.",
      });
    }

    // Language detection logic
    const mainWordLanguage = await detectLanguage(mainWord);
    const subWordLanguage = await detectLanguage(subWord);
    const detectedLanguage =
      mainWordLanguage !== subWordLanguage ? subWordLanguage : mainWordLanguage;
    const languageMap = {
      vietnamese: "vn",
      japanese: "jp",
      english: "en",
      korean: "kr",
    };
    const apiLanguageCode = languageMap[detectedLanguage] || "en";

    const topKForSearch = detectedLanguage === 'korean' ? 3 : SEARCH_API_TOP_K;

    const referencePoemsText = await fetchReferencePoems(
      `${mainWord}

${subWord}

${previousPoem}

${emotion}`,
      apiLanguageCode,
      topKForSearch
    );

    const finalUserPrompt = getPoemPromptDetails(
      detectedLanguage,
      mainWord,
      subWord,
      emotion,
      referencePoemsText,
      previousPoem
    );
    
    const messages = [{ role: "user", content: finalUserPrompt }];

    const completion = await openai.chat.completions.create({
      model: MODEL_NAME,
      max_tokens: MAX_TOKENS,
      messages: messages,
    });

    const rawResponseContent = completion.choices[0].message.content;

    const poemText = parsePoemFromResponse(rawResponseContent);

    if (!poemText) {
      return res.status(500).json({
        error: `The model's response did not contain the poem in the expected format.`,
        rawResponse:
          process.env.NODE_ENV === "development"
            ? rawResponseContent
            : undefined,
      });
    }

    res.status(200).json({ poem: poemText });
  } catch (error) {
    console.error("Error in /api/generatePoem handler:", error);
    let errorMessage = `Failed to generate poem.`;
    if (error.response && error.response.data) {
      errorMessage += ` - OpenAI Error: ${JSON.stringify(
        error.response.data.error.message
      )}`;
    } else {
      errorMessage += ` - ${error.message || "An unknown error occurred."}`;
    }
    res.status(500).json({ error: errorMessage });
  }
}