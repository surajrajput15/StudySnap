import Groq from 'groq-sdk';
import type { ChatCompletionMessageParam } from 'groq-sdk/resources/chat/completions';
import { env } from '../config/env';
import { AI_MODEL } from '../config/constants';

interface MockMcq {
  question: string;
  options: string[];
  answer: number;
  explanation: string;
}

interface MockFlashcard {
  question: string;
  answer: string;
}

let groq: Groq | null = null;

if (env.GROQ_API_KEY) {
  groq = new Groq({ apiKey: env.GROQ_API_KEY });
  console.log('[ai] ✅ Groq SDK initialized with live API key');
} else {
  console.warn('[ai] ⚠️ GROQ_API_KEY not set — AI will return mock responses');
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export async function chatCompletion(messages: ChatCompletionMessageParam[]) {
  if (!groq) {
    console.log('[ai] mock → chatCompletion');
    return mockChatReply(messages);
  }
  try {
    console.log('[ai] groq → chatCompletion', { messages: messages.length });
    const response = await groq.chat.completions.create({
      model: AI_MODEL,
      messages: [
        {
          role: 'system',
          content: 'You are StudyBot, an AI study assistant for students. Explain topics simply, offer study tips, and draft revision schedules. Keep responses concise in Markdown.'
        },
        ...messages
      ],
      temperature: 0.7,
      max_tokens: 1024,
    });
    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error('Groq returned empty response');
    console.log(`[ai] groq → chatCompletion ✓ ${content.length} chars`);
    return content;
  } catch (error) {
    console.error('[ai] groq → chatCompletion ❌', getErrorMessage(error, 'Groq request failed'));
    throw new Error(getErrorMessage(error, 'Groq AI request failed'), { cause: error });
  }
}

export async function summarizeNote(title: string, content: string) {
  if (!groq) {
    console.log('[ai] mock → summarizeNote');
    return mockSummary(title);
  }
  try {
    console.log('[ai] groq → summarizeNote', { title: title.substring(0, 40), contentLength: content.length });
    const response = await groq.chat.completions.create({
      model: AI_MODEL,
      messages: [
        {
          role: 'system',
          content: 'You are an expert summarizer. Generate a concise, structured, bulleted summary. Highlight key definitions, formulas, and main points. Use Markdown.'
        },
        { role: 'user', content: `Title: ${title}\n\nContent:\n${content}` }
      ],
      temperature: 0.3,
    });
    return response.choices[0]?.message?.content || 'Could not generate summary.';
  } catch (error) {
    console.error('[ai] groq → summarizeNote ❌', getErrorMessage(error, 'Summary generation failed'));
    throw new Error(getErrorMessage(error, 'Summary generation failed'), { cause: error });
  }
}

export async function generateMcqs(title: string, content: string): Promise<MockMcq[]> {
  if (!groq) {
    console.log('[ai] mock → generateMcqs');
    return mockMcqs();
  }
  try {
    console.log('[ai] groq → generateMcqs', { label: title, contentLength: content.length });
    const response = await groq.chat.completions.create({
      model: AI_MODEL,
      messages: [
        {
          role: 'system',
          content: 'Generate exactly 3 MCQs in JSON array format. Each: {"question": "...", "options": ["","","",""], "answer": 0, "explanation": "..."}. Return ONLY valid JSON.'
        },
        { role: 'user', content: `Text:\n${content}` }
      ],
      temperature: 0.5,
    });
    return parseJsonArray<MockMcq>(response.choices[0]?.message?.content);
  } catch (error) {
    console.error('[ai] groq → generateMcqs ❌', getErrorMessage(error, 'MCQ generation failed'));
    throw new Error(getErrorMessage(error, 'MCQ generation failed'), { cause: error });
  }
}

export async function generateFlashcards(title: string, content: string): Promise<MockFlashcard[]> {
  if (!groq) {
    console.log('[ai] mock → generateFlashcards');
    return mockFlashcards();
  }
  try {
    console.log('[ai] groq → generateFlashcards', { label: title, contentLength: content.length });
    const response = await groq.chat.completions.create({
      model: AI_MODEL,
      messages: [
        {
          role: 'system',
          content: 'Generate exactly 3 flashcards in JSON array format. Each: {"question": "...", "answer": "..."}. Return ONLY valid JSON.'
        },
        { role: 'user', content: `Text:\n${content}` }
      ],
      temperature: 0.5,
    });
    return parseJsonArray<MockFlashcard>(response.choices[0]?.message?.content);
  } catch (error) {
    console.error('[ai] groq → generateFlashcards ❌', getErrorMessage(error, 'Flashcard generation failed'));
    throw new Error(getErrorMessage(error, 'Flashcard generation failed'), { cause: error });
  }
}

export async function translateText(content: string, lang: 'hindi' | 'english') {
  if (!groq) {
    console.log('[ai] mock → translateText', { lang });
    return mockTranslation(content, lang);
  }
  try {
    const label = lang === 'hindi' ? 'Hindi' : 'English';
    console.log('[ai] groq → translateText', { lang, contentLength: content.length });
    const response = await groq.chat.completions.create({
      model: AI_MODEL,
      messages: [
        {
          role: 'system',
          content: `Translate the text exactly into ${label}. Retain formatting. Return only the translated text.`
        },
        { role: 'user', content }
      ],
      temperature: 0.2,
    });
    return response.choices[0]?.message?.content || 'Translation failed.';
  } catch (error) {
    console.error('[ai] groq → translateText ❌', getErrorMessage(error, 'Translation failed'));
    throw new Error(getErrorMessage(error, 'Translation failed'), { cause: error });
  }
}

function parseJsonArray<T>(raw: string | null | undefined): T[] {
  const match = (raw || '[]').match(/\[\s*\{[\s\S]*\}\s*\]/);
  return JSON.parse(match ? match[0] : '[]') as T[];
}

function mockChatReply(messages: ChatCompletionMessageParam[]) {
  const last = messages[messages.length - 1]?.content;
  const text = (typeof last === 'string' ? last : '').toLowerCase();
  if (text.includes('hello') || text.includes('hi')) {
    return 'Hello! I am StudyBot. Ask me to summarize notes, generate flashcards, or explain any topic!';
  }
  if (text.includes('summarize')) {
    return 'Send me notes text and I will generate a structured summary for you.';
  }
  if (text.includes('explain') || text.includes('what')) {
    return 'In simple terms, think of it like building blocks. Each concept stacks on the previous one. What specific topic would you like me to break down?';
  }
  return 'I can help you study better! Try asking me to explain a concept, generate quiz questions, or create a revision schedule. (Set GROQ_API_KEY for full AI power)';
}

function mockSummary(title: string) {
  return `### Summary: ${title || 'Study Note'}\n\n**Core Concepts:** Key definitions and relationships from the material.\n**Takeaway:** Regular review improves retention.\n**Next:** Test yourself with flashcards.`;
}

function mockMcqs(): MockMcq[] {
  return [
    { question: 'What is the best way to retain study material?', options: ['Passive reading', 'Active recall', 'Cramming', 'Skipping'], answer: 1, explanation: 'Active recall forces retrieval, strengthening memory pathways.' },
    { question: 'What does spaced repetition prevent?', options: ['Overlearning', 'Forgetting curve', 'Burnout', 'Procrastination'], answer: 1, explanation: 'It schedules reviews right before forgetting would occur.' },
    { question: 'Which study method is most effective long-term?', options: ['Re-reading', 'Highlighting', 'Practice testing', 'Summarizing'], answer: 2, explanation: 'Practice testing has the highest effect size for long-term retention.' }
  ];
}

function mockFlashcards(): MockFlashcard[] {
  return [
    { question: 'What is active recall?', answer: 'A learning method where you actively retrieve information from memory.' },
    { question: 'What is spaced repetition?', answer: 'Reviewing material at increasing intervals to combat the forgetting curve.' },
    { question: 'Why teach others what you learn?', answer: 'Teaching forces you to organize knowledge and fill gaps in understanding.' }
  ];
}

function mockTranslation(content: string, lang: string) {
  if (lang === 'hindi') {
    return `[हिंदी अनुवाद]\n\nयह आपके नोट्स का अनुवाद है। GROQ_API_KEY सेट करें वास्तविक अनुवाद के लिए।\n\nमूल: ${content.substring(0, 100)}...`;
  }
  return `[English Translation]\n\nThis is a translation of your notes. Set GROQ_API_KEY for real AI translation.\n\nOriginal: ${content.substring(0, 100)}...`;
}