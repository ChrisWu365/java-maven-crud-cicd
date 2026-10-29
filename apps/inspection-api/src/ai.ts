import path from 'node:path';
import { promises as fs } from 'node:fs';
import type { Inspection } from './types.js';

const uploadDirectory = path.resolve(process.env.UPLOAD_DIR ?? 'data/uploads');

async function photoToBase64(photoPath: string): Promise<string> {
  const fullPath = path.join(uploadDirectory, path.basename(photoPath));
  const buffer = await fs.readFile(fullPath);
  return buffer.toString('base64');
}

export async function createObservationSuggestion(
  inspection: Inspection,
  photoProvided: boolean,
  instruction: string = 'Provide a concise, non-definitive passive fire inspection observation draft. Never decide compliance. State that a qualified human must verify the result.'
): Promise<{ summary: string; source: 'mock' | 'provider'; requiresReview: true }> {
  const apiKey = process.env.AI_API_KEY;
  const providerUrl = process.env.AI_PROVIDER_URL;
  if (!apiKey || !providerUrl) {
    return {
      summary: `Demo suggestion: review the ${photoProvided ? 'uploaded site photo and ' : ''}notes for ${inspection.location}. Confirm the tested system, installation condition, penetration details, and required remedial action before issuing a report.`,
      source: 'mock',
      requiresReview: true
    };
  }

  const photoBase64List = await Promise.all(inspection.photos.map(photoToBase64));

  const response = await fetch(providerUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-goog-api-key': apiKey
    },
    body: JSON.stringify({
      model: process.env.AI_MODEL,
      input: [
        {
          type: 'text',
          text: instruction
        },
        ...photoBase64List.map(base64 => ({
          type: 'image',
          data: base64,
          mime_type: 'image/jpeg'
        }))
      ]
    })
  });
  if (!response.ok) {
    throw new Error(`AI provider request failed with status ${response.status}`);
  }
  const body = await response.json() as { steps?: Array<{ type: string; content?: Array<{ text: string }> }> };
  const modelOutputStep = body.steps?.find(step => step.type === 'model_output');
  const textContent = modelOutputStep?.content?.map(item => item.text).join(' ') ?? '';
  return {
    summary: textContent || 'The AI provider returned no summary. A qualified inspector must review the evidence.',
    source: 'provider',
    requiresReview: true
  };
}
