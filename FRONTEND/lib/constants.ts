export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

export const DAYS_SHORT = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const;

export const DAILY_GOAL = 5;

export const PIN_LENGTH = 4;

export type RevisionRating = 'easy' | 'medium' | 'hard';

export const REVISION_INTERVAL_DAYS: Record<RevisionRating, number> = {
  easy: 7,
  medium: 3,
  hard: 1,
};

export const REVISION_RATING_COLORS: Record<RevisionRating, string> = {
  easy: '#10B981',
  medium: '#3B82F6',
  hard: '#EF4444',
};

export const AI_TOOLS = [
  {
    id: 'summarize',
    emoji: '📝',
    title: 'Summarize',
    desc: 'Create concise notes instantly.',
    gradient: 'linear-gradient(135deg, #0061A4, #3399FF)',
    prompt: 'Please summarize the key points of the following study material concisely and clearly.',
  },
  {
    id: 'mcq',
    emoji: '❓',
    title: 'MCQ Generator',
    desc: 'Generate practice questions.',
    gradient: 'linear-gradient(135deg, #7C3AED, #A78BFA)',
    prompt: 'Generate a set of multiple choice questions with answers to test my knowledge on this topic.',
  },
  {
    id: 'flashcards',
    emoji: '🧠',
    title: 'Flashcards',
    desc: 'Create smart flashcards.',
    gradient: 'linear-gradient(135deg, #EC4899, #F472B6)',
    prompt: 'Create a set of flashcards (question/answer pairs) from this study material for revision.',
  },
  {
    id: 'quiz',
    emoji: '🧩',
    title: 'Quiz Mode',
    desc: 'Test your knowledge.',
    gradient: 'linear-gradient(135deg, #F59E0B, #FBBF24)',
    prompt: 'Quiz me with interactive questions to test my understanding of this subject.',
  },
  {
    id: 'translate',
    emoji: '🌍',
    title: 'Translate',
    desc: 'Hindi ↔ English translation.',
    gradient: 'linear-gradient(135deg, #10B981, #34D399)',
    prompt: 'Translate the following content between Hindi and English as needed.',
  },
  {
    id: 'explain',
    emoji: '💡',
    title: 'Explain Simply',
    desc: 'Understand difficult topics easily.',
    gradient: 'linear-gradient(135deg, #06B6D4, #22D3EE)',
    prompt: 'Explain this concept in simple, easy-to-understand terms with examples.',
  },
  {
    id: 'mindmap',
    emoji: '🗺',
    title: 'Mind Map',
    desc: 'Visualize concepts.',
    gradient: 'linear-gradient(135deg, #F97316, #FB923C)',
    prompt: 'Create a mind map structure or outline that visualizes the key concepts and their relationships.',
  },
  {
    id: 'pdf',
    emoji: '📄',
    title: 'AI PDF Assistant',
    desc: 'Analyze PDFs with AI.',
    gradient: 'linear-gradient(135deg, #6366F1, #818CF8)',
    prompt: 'I have a PDF document. Please help me analyze, summarize, and extract key information from it.',
  },
] as const;
