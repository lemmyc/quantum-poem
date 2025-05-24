import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";

const apiKey = process.env.GOOGLE_API_KEY; // Hoặc GEMINI_API_KEY tùy bạn đặt
if (!apiKey) {
  throw new Error("GOOGLE_API_KEY (hoặc GEMINI_API_KEY) environment variable not set");
}

const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ 
  model: "gemini-2.5-flash-preview-05-20", 
});

const generationConfig = {
  temperature: 0.9, // Tăng tính sáng tạo
  topK: 1,
  topP: 1,
  maxOutputTokens: 2048,
  // Quan trọng: Yêu cầu output là JSON
  responseMimeType: "application/json", 
};

const safetySettings = [
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
];

export default async function handler(req, res) {
  if (req.method === 'POST') {
    try {
      const { inputText, emotion } = req.body;

      if (!inputText || !emotion) {
        return res.status(400).json({ error: 'Missing inputText or emotion in request body' });
      }

      const currentTime = new Date().toLocaleTimeString('ja-JP', { hour12: false }); // Thời gian dạng 24h

      // System instruction: Định nghĩa vai trò và cách hoạt động của AI
      const systemInstruction = `You are a highly creative keyword generator. Your task is to generate a diverse array of exactly 10 keywords. These keywords should be inspired by the user's input text, their detected emotion, and the current time of day. 
      
      Key guidelines:
      1.  The generated keywords should spark imagination and can be abstract or loosely connected to the original input text. They do NOT need to be directly or literally related. Prioritize creativity.
      2.  The language of the generated keywords MUST match the language of the 'User Input Text' provided below.
      3.  The output MUST be a JSON array containing exactly 10 strings. For example: ["keyword1", "keyword2", ..., "keyword10"]. Do NOT include any other text, explanations, or markdown formatting around the JSON array.
      `;

      // User prompt: Cung cấp dữ liệu cụ thể cho AI
      const userPrompt = `
      User Input Text: "${inputText}"
      Detected Emotion: "${emotion}"
      Current Time: "${currentTime}"

      Please generate 10 creative keywords based on this information, following all the guidelines in the system instruction.
      `;
      
      
      // Cách tiếp cận sử dụng `contents` với system instruction (khuyến nghị cho sự rõ ràng)
      const contents = [
        {
          role: 'model',
          parts: [{ text: systemInstruction }],
        },
        {
          role: 'user',
          parts: [{ text: userPrompt }],
        }
      ];

      const result = await model.generateContent({ contents, generationConfig, safetySettings });


      const response = result.response;
      const responseText = response.text();
      
      // Do đã yêu cầu responseMimeType: "application/json", model sẽ cố gắng trả về JSON hợp lệ
      // Tuy nhiên, vẫn nên parse và kiểm tra
      let keywordsArray;
      try {
        keywordsArray = JSON.parse(responseText);
        if (!Array.isArray(keywordsArray) || !keywordsArray.every(kw => typeof kw === 'string')) {
          throw new Error("Output from AI is not a valid JSON array of strings.");
        }
        // Đảm bảo chỉ lấy tối đa 10 từ khóa nếu AI trả về nhiều hơn
        keywordsArray = keywordsArray.slice(0, 10);

      } catch (parseError) {
        console.error("Error parsing JSON response from AI:", responseText, parseError);
        // Fallback: cố gắng tách từ responseText nếu không phải JSON chuẩn
        // Đây là phương án dự phòng, lý tưởng là AI luôn trả về JSON đúng yêu cầu
        keywordsArray = responseText.split(/[\n,]+/)
                                     .map(kw => kw.trim().replace(/^["']|["']$/g, '')) // Loại bỏ dấu ngoặc kép/đơn nếu có
                                     .filter(kw => kw.length > 0)
                                     .slice(0, 10);
        if (keywordsArray.length === 0) {
           throw new Error(`Failed to parse keywords from AI response. Response was: ${responseText}`);
        }
      }

      res.status(200).json({ keywords: keywordsArray });

    } catch (error) {
      console.error('Error generating keywords with Google GenAI:', error);
      res.status(500).json({ error: `Failed to generate keywords: ${error.message}` });
    }
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}