// src/pages/api/generateKeywords.js
import OpenAI from "openai";

const openai = new OpenAI(); // API key is read from OPENAI_API_KEY env var

const MODEL_NAME = process.env.OPENAI_MODEL_NAME;

export default async function handler(req, res) {
  if (req.method === 'POST') {
    try {
      const { inputText, emotion } = req.body;

      if (!inputText || !emotion) {
        return res.status(400).json({ error: 'Missing inputText or emotion in request body' });
      }

      const currentTime = new Date().toLocaleTimeString('ja-JP', { hour12: false });

      const systemPrompt = process.env.OPENAI_KEYWORD_GENERATOR_SYSTEM_PROMPT;
      if (!systemPrompt) {
        console.error("OPENAI_KEYWORD_GENERATOR_SYSTEM_PROMPT not set in .env");
        return res.status(500).json({ error: 'Server configuration error: Keyword generator prompt missing.' });
      }

      const userPromptContent = `
      User Input Text: "${inputText}"
      Detected Emotion: "${emotion}"
      Current Time: "${currentTime}"

      Please generate 10 creative keywords based on this information, following all the guidelines in the system instruction. Ensure the output is a JSON object with a 'keywords' array.
      `;

      const completion = await openai.chat.completions.create({
        model: MODEL_NAME,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPromptContent }
        ],
        temperature: 0.9,
        max_tokens: 250, // Adjusted for keyword generation
        response_format: { type: "json_object" }, // Ensure JSON output
      });

      const responseContent = completion.choices[0].message.content;
      
      let keywordsArray;
      try {
        const parsedJson = JSON.parse(responseContent);
        if (parsedJson && Array.isArray(parsedJson.keywords) && parsedJson.keywords.every(kw => typeof kw === 'string')) {
          keywordsArray = parsedJson.keywords.slice(0, 10); // Ensure max 10
        } else {
          throw new Error("AI response is not in the expected JSON format: { \"keywords\": [...] }");
        }
      } catch (parseError) {
        console.error("Error parsing JSON response from OpenAI for keywords:", responseContent, parseError);
        // Fallback attempt (less reliable)
        keywordsArray = responseContent.match(/"(.*?)"/g)?.map(kw => kw.replace(/"/g, ''))?.slice(0,10) || [];
        if (keywordsArray.length === 0) {
            throw new Error(`Failed to parse keywords from AI response. Response was: ${responseContent}`);
        }
      }

      res.status(200).json({ keywords: keywordsArray });

    } catch (error) {
      console.error('Error generating keywords with OpenAI:', error);
      res.status(500).json({ error: `Failed to generate keywords: ${error.message || error.toString()}` });
    }
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}