export interface SpeechRecognitionResult {
  0: { transcript: string };
  isFinal: boolean;
}

export interface SpeechRecognitionResultList {
  length: number;
  [index: number]: SpeechRecognitionResult;
}

export interface SpeechRecognitionEvent {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

export interface SpeechRecognitionErrorEvent {
  error: string;
}

export interface SpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: () => void;
  onresult: (event: SpeechRecognitionEvent) => void;
  onerror: (event: SpeechRecognitionErrorEvent) => void;
  onend: () => void;
  start: () => void;
  stop: () => void;
  abort?: () => void;
}

export interface SpeechRecognitionEventLike {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
}

export interface SpeechRecognitionInstance {
  lang: string;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  start(): void;
}

export type SpeechRecognitionCtor = new () => SpeechRecognitionInstance;

export function getSpeechRecognitionCtor(): SpeechRecognitionCtor | undefined {
  const w = window as Window & {
    webkitSpeechRecognition?: SpeechRecognitionCtor;
    SpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition;
}