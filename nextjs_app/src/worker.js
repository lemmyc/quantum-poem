import { pipeline, env } from '@xenova/transformers';

// Set TensorFlow logging level
env.TF_CPP_MIN_LOG_LEVEL = 1;
env.allowLocalModels = false;
env.useBrowserCache = false;

console.log(env);

class MyEmotionDetectionPipeline {
    static task = 'image-classification';
    static model = 'Xenova/facial_emotions_image_detection';
    static instance = null;

    static async getInstance(progress_callback = null) {
        if (this.instance === null) {
            this.instance = pipeline(this.task, this.model, { progress_callback });
        }

        return this.instance;
    }
}

// Listen for messages from the main thread
self.addEventListener('message', async (event) => {
    console.log(event);
    // Load the pipeline
    const classifier = await MyEmotionDetectionPipeline.getInstance((x) => {
        self.postMessage(x);
    });

    // Perform classification on the provided image (base64 data URL)
    const { image } = event.data;
    if (image) {
        const output = await classifier(image);
        self.postMessage({ status: 'complete', output });
    }
});