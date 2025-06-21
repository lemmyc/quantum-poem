---
base_model: dima806/facial_emotions_image_detection
library_name: transformers.js
---

https://huggingface.co/dima806/facial_emotions_image_detection with ONNX weights to be compatible with Transformers.js.
## Usage (Transformers.js)

If you haven't already, you can install the [Transformers.js](https://huggingface.co/docs/transformers.js) JavaScript library from [NPM](https://www.npmjs.com/package/@xenova/transformers) using:
```bash
npm i @xenova/transformers
```

**Example:** Perform emotion detection with `Xenova/facial_emotions_image_detection`:
```js
import { pipeline } from '@xenova/transformers';

// Create image classification pipeline
const classifier = await pipeline('image-classification', 'Xenova/facial_emotions_image_detection');

// Classify an image
const url = 'https://i.imgur.com/fhtXyYJ.png';
const output = await classifier(url);
// [{ label: 'disgust', score: 0.9915065169334412 }]
```

---

Note: Having a separate repo for ONNX weights is intended to be a temporary solution until WebML gains more traction. If you would like to make your models web-ready, we recommend converting to ONNX using [🤗 Optimum](https://huggingface.co/docs/optimum/index) and structuring your repo like this one (with ONNX weights located in a subfolder named `onnx`).