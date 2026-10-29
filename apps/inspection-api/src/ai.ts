import type { Inspection } from './types.js';

export async function createObservationSuggestion(
  inspection: Inspection,
  photoProvided: boolean
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

  const response = await fetch(providerUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: process.env.AI_MODEL,
      instruction: 'Provide a concise, non-definitive passive fire inspection observation draft. Never decide compliance. State that a qualified human must verify the result.',
      inspection: {
        building: inspection.building,
        location: inspection.location,
        notes: inspection.notes,
        observations: inspection.observations,
        photoProvided
      }
    })
  });
  if (!response.ok) {
    throw new Error(`AI provider request failed with status ${response.status}`);
  }
  const body = await response.json() as { summary?: string };
  return {
    summary: body.summary ?? 'The AI provider returned no summary. A qualified inspector must review the evidence.',
    source: 'provider',
    requiresReview: true
  };
}
