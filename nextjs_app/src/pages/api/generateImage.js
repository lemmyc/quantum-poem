// src/pages/api/   .js
import OpenAI from "openai";

const openai = new OpenAI();
import fs from 'fs/promises';
import path from 'path';

const IMAGE_MODEL_NAME = process.env.OPENAI_IMAGE_MODEL_NAME || "gpt-image-1";

export default async function handler(req, res) {
  if (req.method === 'POST') {
    try {
      const { inputText, language, size = "1024x1536" } = req.body;

      if (!inputText || typeof inputText !== 'string' || inputText.trim() === '') {
        return res.status(400).json({ error: 'Missing or empty "inputText" in request body' });
      }

      const basePromptTemplate = process.env.OPENAI_IMAGE_GENERATOR;
      if (!basePromptTemplate) {
        console.error("OPENAI_IMAGE_GENERATOR not set in .env");
        return res.status(500).json({ error: 'Server configuration error: Image generator prompt missing.' });
      }

      let finalPrompt = basePromptTemplate.replace('{inputText}', inputText);
      if (language === "cn" || language === "ja") {
        finalPrompt += "\nplease also include the original poem text written in traditional calligraphy style on the image (for example, vertically or in a brushstroke style), as an artistic overlay. "
      }

      console.log(`Generating image with model: ${IMAGE_MODEL_NAME} and prompt: "${finalPrompt}"`);

      // API Call
      const result = await openai.images.generate({
        model: IMAGE_MODEL_NAME,
        prompt: finalPrompt,
        size: size,
        quality: "low"
      });

      // Response Handling
      const imageBase64 = result.data[0].b64_json;

      if (!imageBase64) {
        throw new Error("OpenAI API did not return an image.");
      }

      // Generate unique filename
      const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, '');
      const filename = `${timestamp}.png`;

      // Define image directory
      const imageDir = path.join(process.cwd(), 'public', 'generated');

      // Ensure directory exists
      await fs.mkdir(imageDir, { recursive: true });

      // Define full path
      const imagePath = path.join(imageDir, filename);

      // Decode base64 to buffer
      const imageBuffer = Buffer.from(imageBase64, 'base64');

      // Write buffer to file
      await fs.writeFile(imagePath, imageBuffer);

      console.log(`Image saved to: ${imagePath}`);

      // Generate public image URL
      const imageUrl = `/generated/${filename}`;

      // Return image and URL
      res.status(200).json({
        image_base64: imageBase64,
        imageUrl: imageUrl,
      });

    } catch (error) {
      console.error('Error generating image with OpenAI:', error);
      res.status(500).json({ error: `Failed to generate image: ${error.message || error.toString()}` });
    }
  } else {
    // Only allow POST
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
