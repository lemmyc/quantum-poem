// src/pages/api/filterWordsByEmotion.js
import OpenAI from "openai";

const openai = new OpenAI(); // API key from OPENAI_API_KEY env var
const MODEL_NAME = process.env.OPENAI_MODEL_NAME || "gpt-3.5-turbo";

export default async function handler(req, res) {
  if (req.method === 'POST') {
    try {
      const { words, emotion } = req.body;

      if (!words || !Array.isArray(words) || words.length === 0 || !emotion) {
        return res.status(400).json({ error: 'Missing "words" (array) or "emotion" in request body' });
      }

      // Limit the number of words to avoid overly long prompts or high costs
      const wordsToFilter = words.slice(0, 15); // Max 15 words to filter from

      const systemPrompt = `You are an AI assistant. Your task is to select words from a given list that are most semantically related to a specified emotion.
Return your response strictly as a JSON object with a single key "filteredWords", which is an array of strings.
The "filteredWords" array should contain words from the original list that are relevant to the emotion.
If multiple words are relevant, return them. Aim for 3 words.
If no words from the list are relevant, return an empty array: { "filteredWords": [] }.
Do NOT include any words not present in the original input list.
Do NOT add any explanatory text outside the JSON object.`;

      const userPromptContent = `
      Word List: ${JSON.stringify(wordsToFilter)}
      Emotion: "${emotion}"

      Based on the emotion "${emotion}", select the most relevant words from the provided "Word List".
      `;

      const completion = await openai.chat.completions.create({
        model: MODEL_NAME,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPromptContent }
        ],
        temperature: 0.2, // Lower temperature for more focused filtering
        max_tokens: 200, // Enough for a list of words in JSON
        response_format: { type: "json_object" },
      });

      const responseContent = completion.choices[0].message.content;
      
      let parsedResponse;
      try {
        parsedResponse = JSON.parse(responseContent);
        if (!parsedResponse || !Array.isArray(parsedResponse.filteredWords)) {
          console.warn("AI response for word filtering is not in the expected JSON format { \"filteredWords\": [...] }.", responseContent);
          // Attempt to find an array if it's slightly malformed but contains one
          if (typeof parsedResponse === 'object' && parsedResponse !== null) {
            const keys = Object.keys(parsedResponse);
            for (const key of keys) {
                if (Array.isArray(parsedResponse[key])) {
                    parsedResponse.filteredWords = parsedResponse[key];
                    break;
                }
            }
          }
          if(!Array.isArray(parsedResponse.filteredWords)){ // check again
            throw new Error("AI response is not in the expected JSON format: { \"filteredWords\": [...] } or recovery failed.");
          }
        }
      } catch (parseError) {
        console.error("Error parsing JSON response from OpenAI for word filtering:", responseContent, parseError);
        // Basic fallback: try to extract an array string using regex if JSON.parse fails completely
        const match = responseContent.match(/"filteredWords"\s*:\s*(\[.*?\])/);
        if (match && match[1]) {
            try {
                const extractedArray = JSON.parse(match[1]);
                parsedResponse = { filteredWords: extractedArray };
                 console.log("Fallback regex extraction successful for filteredWords.");
            } catch (regexParseError) {
                console.error("Fallback regex parsing error:", regexParseError);
                throw new Error(`Failed to parse filtered words from AI response. Response was: ${responseContent}`);
            }
        } else {
            throw new Error(`Failed to parse filtered words from AI response. Response was: ${responseContent}`);
        }
      }

      // Ensure filtered words are actually strings and were part of the input (case-insensitive check for robustness)
      const lowerCaseWordsToFilter = wordsToFilter.map(w => w.toLowerCase());
      const validatedFilteredWords = parsedResponse.filteredWords.filter(fw => 
        typeof fw === 'string' && lowerCaseWordsToFilter.includes(fw.toLowerCase())
      ).map(fw => {
        // Return the original casing from wordsToFilter
        const originalIndex = lowerCaseWordsToFilter.indexOf(fw.toLowerCase());
        return wordsToFilter[originalIndex];
      });


      if (validatedFilteredWords.length === 0 && parsedResponse.filteredWords.length > 0) {
        console.warn("OpenAI suggested words not in the original list or not strings. Original suggestions:", parsedResponse.filteredWords, "Original list:", wordsToFilter);
      }
      
      console.log("Filtered words by emotion:", validatedFilteredWords);
      res.status(200).json({ filteredWords: parsedResponse.filteredWords });

    } catch (error) {
      console.error('Error filtering words with OpenAI:', error);
      res.status(500).json({ error: `Failed to filter words: ${error.message || error.toString()}` });
    }
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}