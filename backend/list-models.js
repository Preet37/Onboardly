const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function listModels() {
  try {
    const models = await genAI.listModels();

    console.log('Available Gemini models with vision support:\n');

    for await (const model of models) {
      const methods = model.supportedGenerationMethods || [];
      if (methods.includes('generateContent')) {
        console.log(`✓ ${model.name}`);
        console.log(`  Description: ${model.description || 'N/A'}`);
        console.log(`  Methods: ${methods.join(', ')}`);
        console.log('');
      }
    }
  } catch (error) {
    console.error('Error listing models:', error.message);
  }
}

listModels();
