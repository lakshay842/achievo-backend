export type AiPurpose =
  | 'analyze'
  | 'clarify'
  | 'roadmap'
  | 'replan'
  | 'chat'
  | 'explain'
  | 'evaluate';

export interface AiCompletionRequest {
  purpose: AiPurpose;
  system: string;
  user: string;
  json: boolean;
  temperature?: number;
  context?: Record<string, unknown>;
}

export interface AiProvider {
  readonly name: 'gemini' | 'mock';
  complete(request: AiCompletionRequest): Promise<string>;
}
