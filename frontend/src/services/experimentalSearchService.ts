import apiClient from '../lib/apiClient';

export interface ModelAnswer {
  engine: string;
  answer: string;
  latencyMs: number;
}

// Hit backend endpoint to get answer from specified model
export const searchModels = async (question: string, modelId: string): Promise<ModelAnswer[]> => {
  const start = Date.now();
  const { data } = await apiClient.post('/search', { query: question, modelId });

  const latencyMs = Date.now() - start;

  // Fallback in case backend does not return latency
  const answer: ModelAnswer = {
    engine: data.engine ?? modelId,
    answer: data.answer ?? '',
    latencyMs: data.latencyMs ?? latencyMs,
  };

  return [answer];
}; 