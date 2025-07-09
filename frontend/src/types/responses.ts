// Fanout question types and their display labels
export const FANOUT_QUESTION_TYPES = [
  'benchmark',
  'paraphrase',
  'comparison',
  'temporal',
  'topical',
  'entity_broader',
  'entity_narrower',
  'session_context',
  'user_profile',
  'vertical',
  'safety_probe'
] as const;

export type FanoutQuestionType = typeof FANOUT_QUESTION_TYPES[number];

export const FANOUT_DISPLAY_LABELS: Record<FanoutQuestionType, string> = {
  'benchmark': 'Benchmark',
  'paraphrase': 'Paraphrase',
  'comparison': 'Comparison',
  'temporal': 'Time-based',
  'topical': 'Related Topics',
  'entity_broader': 'Broader Category',
  'entity_narrower': 'Specific Focus',
  'session_context': 'Context',
  'user_profile': 'Personalized',
  'vertical': 'Media Search',
  'safety_probe': 'Safety Check'
}; 