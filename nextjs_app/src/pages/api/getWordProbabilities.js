// src/pages/api/getWordProbabilities.js
export default async function handler(req, res) {
    if (req.method === 'POST') {
      try {
        const { keywords } = req.body;
  
        if (!keywords || !Array.isArray(keywords)) {
          return res.status(400).json({ error: 'Missing or invalid keywords array in request body' });
        }
  
        // Mockup the probability generation
        // Tạo một mảng các object, mỗi object có từ và một xác suất ngẫu nhiên
        const wordsWithProbabilities = keywords.map(word => ({
          word: word,
          probability: Math.random() // Tạo xác suất ngẫu nhiên từ 0 đến 1
        }));
  
        // Giả lập độ trễ mạng
        await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 500));
  
        res.status(200).json({ results: wordsWithProbabilities });
  
      } catch (error) {
        console.error('Error in getWordProbabilities API:', error);
        res.status(500).json({ error: `Failed to process keywords: ${error.message}` });
      }
    } else {
      res.setHeader('Allow', ['POST']);
      res.status(405).end(`Method ${req.method} Not Allowed`);
    }
  }