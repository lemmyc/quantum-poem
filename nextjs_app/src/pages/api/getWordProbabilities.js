// src/pages/api/getWordProbabilities.js
import fetch from 'node-fetch'; // Required for making API calls in a Node.js environment
const PYTHON_API_BASE_URL = process.env.PYTHON_API_URL || "http://localhost:8000";
const SHUFFLE_API_URL = PYTHON_API_BASE_URL + "/api/shuffle";

export default async function handler(req, res) {
    if (req.method === 'POST') {
      try {
        const { keywords } = req.body;
  
        // Validate input keywords
        if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
          return res.status(400).json({ error: 'Missing, invalid, or empty keywords array in request body' });
        }
  
        // --- Call external API to get word frequency data ---
        let distributionFromApi = {}; 

        try {
            // Make a POST request to the shuffle API
            const apiResponse = await fetch(SHUFFLE_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ data: keywords }), 
            });

            // Handle cases where the shuffle API returns an error
            if (!apiResponse.ok) {
                let errorMsg = `Failed to fetch from shuffle API: ${apiResponse.status} ${apiResponse.statusText}`;
                try {
                    const errorData = await apiResponse.json();
                    if (errorData && (errorData.error || errorData.detail)) {
                         errorMsg += ` - ${errorData.error || errorData.detail}`;
                    }
                } catch (parseError) { /* Ignore parsing error if error response is not JSON */ }
                console.error(errorMsg);
                return res.status(502).json({ error: 'Error communicating with the shuffle service.' }); // Bad Gateway
            }

            // Extract the distribution data from the shuffle API's response
            const responseData = await apiResponse.json();
            if (responseData && responseData.distribution) {
                distributionFromApi = responseData.distribution;
            } else {
                console.warn('Shuffle API response did not contain a "distribution" object or was malformed.');
                // If no distribution, it will be treated as no words having frequency
            }

        } catch (fetchError) {
            // Handle network errors when calling the shuffle API (e.g., service down)
            console.error('Error calling shuffle API:', fetchError);
            return res.status(503).json({ error: `Service unavailable: Cannot connect to shuffle service. ${fetchError.message}` }); // Service Unavailable
        }
        // --- End of external API call ---

        // --- Calculate probabilities for each keyword based on data from the API ---
        // Calculate the total sum of counts from the received distribution
        const counts = Object.values(distributionFromApi);
        const totalSumOfCounts = counts.reduce((sum, count) => sum + Number(count), 0); // Ensure count is a number

        // Create the result array, calculating probability for each input keyword
        const wordsWithProbabilities = keywords.map(word => {
            const countForWord = distributionFromApi[word] || 0; // Get count for the word, or 0 if not found
            
            // Calculate probability. If totalSumOfCounts is 0, probability is 0 to avoid division by zero.
            const probability = totalSumOfCounts > 0 ? (Number(countForWord) / totalSumOfCounts) : 0;
            
            return {
                word: word,
                probability: probability
            };
        });
  
        // Return the successful result
        res.status(200).json({ results: wordsWithProbabilities });
  
      } catch (error) {
        // Handle general errors within the getWordProbabilities API
        console.error('Error in getWordProbabilities API:', error);
        res.status(500).json({ error: `Failed to process keywords: ${error.message}` });
      }
    } else {
      // Handle cases where the HTTP method is not allowed
      res.setHeader('Allow', ['POST']);
      res.status(405).end(`Method ${req.method} Not Allowed`);
    }
  }