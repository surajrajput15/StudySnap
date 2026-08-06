'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useStore, Note } from '@/lib/store/useStore';
import { API, apiFetch } from '@/lib/config';
import { useAuth } from '@clerk/nextjs';
import { 
  Send, Sparkles, AlertCircle, HelpCircle, Languages, LayoutGrid, FileText
} from 'lucide-react';
import confetti from 'canvas-confetti';
import EmptyState, { EmptyAiIllustration, EmptyMcqIllustration, EmptyFlashcardIllustration } from './EmptyState';

export default function AiHelper() {
  const { getToken } = useAuth();
  const { notes, activeNoteId } = useStore();
  const activeNote = notes.find(n => n.id === activeNoteId);

  const friendlyError = (err: any) => {
    const msg = err?.message || '';
    if (msg.includes('session') || msg.includes('expired') || msg.includes('401')) {
      return 'Your session has expired. Please sign in again.';
    }
    return 'SnapAI could not complete your request. Please try again.';
  };

  const [activeSubTab, setActiveSubTab] = useState<'chat' | 'summarize' | 'mcq' | 'flashcard' | 'translate'>('chat');

  const [chatMessages, setChatMessages] = useState<any[]>([
    { role: 'assistant', content: 'Hello! I am your AI Study Companion. How can I help you today? You can ask me to explain concepts, draft revision schedules, or quiz you!' }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);

  const [summary, setSummary] = useState('');
  const [isSummarizing, setIsSummarizing] = useState(false);

  const [mcqs, setMcqs] = useState<any[]>([]);
  const [selectedAnswers, setSelectedAnswers] = useState<{ [key: number]: number }>({});
  const [showExplanation, setShowExplanation] = useState<{ [key: number]: boolean }>({});
  const [isMcqLoading, setIsMcqLoading] = useState(false);

  const [flashcards, setFlashcards] = useState<any[]>([]);
  const [flippedCards, setFlippedCards] = useState<{ [key: number]: boolean }>({});
  const [isFlashcardLoading, setIsFlashcardLoading] = useState(false);

  const [translatedText, setTranslatedText] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);

  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatMessages]);

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isChatLoading) return;
    const userMsg = { role: 'user', content: chatInput.trim() };
    const updatedMessages = [...chatMessages, userMsg];
    setChatMessages(updatedMessages);
    setChatInput('');
    setIsChatLoading(true);
    try {
      const data = await apiFetch(API.ai.chat, { method: 'POST', body: JSON.stringify({ messages: updatedMessages }), token: (await getToken()) ?? undefined });
      if (data.success) setChatMessages([...updatedMessages, data.message]);
      else throw new Error(data.error);
    } catch (err: any) {
      setChatMessages([...updatedMessages, { role: 'assistant', content: friendlyError(err) }]);
    } finally { setIsChatLoading(false); }
  };

  const handleSummarizeNote = async () => {
    if (!activeNote || isSummarizing) return;
    setIsSummarizing(true);
    setSummary('');
    try {
      const data = await apiFetch(API.ai.summarize, { method: 'POST', body: JSON.stringify({ title: activeNote.title, content: activeNote.content }), token: (await getToken()) ?? undefined });
      if (data.success) { setSummary(data.summary); confetti({ particleCount: 30, colors: ['#0061A4'] }); }
      else throw new Error(data.error);
    } catch (err: any) { setSummary(friendlyError(err)); }
    finally { setIsSummarizing(false); }
  };

  const handleGenerateMcqs = async () => {
    if (!activeNote || isMcqLoading) return;
    setIsMcqLoading(true);
    setMcqs([]);
    setSelectedAnswers({});
    setShowExplanation({});
    try {
      const data = await apiFetch(API.ai.mcqs, { method: 'POST', body: JSON.stringify({ title: activeNote.title, content: activeNote.content, type: 'mcq' }), token: (await getToken()) ?? undefined });
      if (data.success) { setMcqs(data.mcqs); confetti({ particleCount: 40, colors: ['#10B981', '#3B82F6'] }); }
      else throw new Error(data.error);
    } catch (err: any) { setMcqs([]); alert(friendlyError(err)); }
    finally { setIsMcqLoading(false); }
  };

  const handleGenerateFlashcards = async () => {
    if (!activeNote || isFlashcardLoading) return;
    setIsFlashcardLoading(true);
    setFlashcards([]);
    setFlippedCards({});
    try {
      const data = await apiFetch(API.ai.mcqs, { method: 'POST', body: JSON.stringify({ title: activeNote.title, content: activeNote.content, type: 'flashcard' }), token: (await getToken()) ?? undefined });
      if (data.success) { setFlashcards(data.flashcards); confetti({ particleCount: 40, colors: ['#EC4899'] }); }
      else throw new Error(data.error);
    } catch (err: any) { setFlashcards([]); alert(friendlyError(err)); }
    finally { setIsFlashcardLoading(false); }
  };

  const handleTranslateNote = async (lang: 'hindi' | 'english') => {
    if (!activeNote || isTranslating) return;
    setIsTranslating(true);
    setTranslatedText('');
    try {
      const data = await apiFetch(API.ai.translate, { method: 'POST', body: JSON.stringify({ content: activeNote.content, targetLanguage: lang }), token: (await getToken()) ?? undefined });
      if (data.success) { setTranslatedText(data.translatedText); confetti({ particleCount: 30, colors: ['#8B5CF6'] }); }
      else throw new Error(data.error);
    } catch (err: any) { setTranslatedText(friendlyError(err)); }
    finally { setIsTranslating(false); }
  };

  const tabs = [
    { id: 'chat', label: 'AI Chat', icon: Sparkles },
    { id: 'summarize', label: 'Summarize', icon: FileText },
    { id: 'mcq', label: 'MCQ Quiz', icon: HelpCircle },
    { id: 'flashcard', label: 'Flashcards', icon: LayoutGrid },
    { id: 'translate', label: 'Translate', icon: Languages },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%' }}>
      
      <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px' }}>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button key={tab.id} onClick={() => setActiveSubTab(tab.id as any)}
              className="md3-chip" style={{ cursor: 'pointer', background: activeSubTab === tab.id ? 'var(--primary)' : 'var(--surface)', color: activeSubTab === tab.id ? '#fff' : 'var(--on-surface)', fontWeight: 600, boxShadow: 'var(--elevation-1)', border: 'none' }}>
              <Icon size={14} /> {tab.label}
            </button>
          );
        })}
      </div>

      {activeSubTab !== 'chat' && !activeNote && (
        <EmptyState
          illustration={<EmptyAiIllustration />}
          title="No Note Selected"
          message="Open a study note to unlock AI tools — summarize, quiz, and translate your content."
          tip="You can also chat with SnapAI freely without selecting a note."
        />
      )}

      <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
        
        {activeSubTab === 'chat' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', height: '100%', flexGrow: 1 }}>
            <div className="md3-card" style={{ flexGrow: 1, overflowY: 'auto', maxHeight: '380px', display: 'flex', flexDirection: 'column', gap: '10px', padding: '16px' }}>
              {chatMessages.map((msg, idx) => (
                <div key={idx} style={{ alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%', padding: '10px 16px', borderRadius: '16px', borderBottomRightRadius: msg.role === 'user' ? '4px' : '16px', borderBottomLeftRadius: msg.role !== 'user' ? '4px' : '16px', backgroundColor: msg.role === 'user' ? 'var(--primary)' : 'var(--surface-variant)', color: msg.role === 'user' ? '#fff' : 'var(--on-surface)', fontSize: '13px', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                  {msg.content}
                </div>
              ))}
              {isChatLoading && (
                <div style={{ alignSelf: 'flex-start', padding: '10px 16px', borderRadius: '16px', backgroundColor: 'var(--surface-variant)', fontSize: '13px' }}>
                  <div style={{ display: 'flex', gap: '3px' }}>
                    <div className="wave-bar" style={{ height: '8px' }} /><div className="wave-bar" style={{ height: '8px' }} /><div className="wave-bar" style={{ height: '8px' }} />
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
            <form onSubmit={handleSendChat} style={{ display: 'flex', gap: '8px' }}>
              <input type="text" placeholder="Ask your AI tutor..." value={chatInput} onChange={(e) => setChatInput(e.target.value)} className="md3-input" style={{ borderRadius: '100px' }} />
              <button type="submit" className="md3-btn md3-btn-primary" style={{ borderRadius: '50%', padding: '12px', flexShrink: 0 }}>
                <Send size={16} />
              </button>
            </form>
          </div>
        )}

        {activeSubTab === 'summarize' && activeNote && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <button onClick={handleSummarizeNote} className="md3-btn md3-btn-primary" disabled={isSummarizing} style={{ width: 'fit-content' }}>
              {isSummarizing ? 'Summarizing...' : 'Summarize Note'}
            </button>
            {summary ? (
              <div className="md3-card" style={{ fontSize: '14px', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                  <FileText size={16} style={{ color: 'var(--primary)' }} />
                  <span style={{ fontWeight: 600, fontSize: '13px' }}>Summary</span>
                </div>
                {summary}
              </div>
            ) : (
              <EmptyState
                illustration={<EmptyAiIllustration />}
                title="Waiting to Summarize"
                message="SnapAI will condense your note into clear, bite-sized key points."
                action={!isSummarizing ? { label: 'Summarize Now', onClick: handleSummarizeNote } : undefined}
                tip="Summaries help with last-minute revision before exams."
              />
            )}
          </div>
        )}

        {activeSubTab === 'mcq' && activeNote && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <button onClick={handleGenerateMcqs} className="md3-btn md3-btn-primary" disabled={isMcqLoading} style={{ width: 'fit-content' }}>
              {isMcqLoading ? 'Generating...' : 'Generate 3 MCQs'}
            </button>
            {mcqs.length === 0 ? (
              <EmptyState
                illustration={<EmptyMcqIllustration />}
                title="No Quiz Generated"
                message="Test your understanding — SnapAI creates MCQs from your note content."
                action={!isMcqLoading ? { label: 'Generate Quiz', onClick: handleGenerateMcqs } : undefined}
                tip="MCQs improve retention and highlight areas you need to revise more."
              />
            ) : mcqs.map((mcq, idx) => {
              const answered = selectedAnswers[idx] !== undefined;
              return (
                <div key={idx} className="md3-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '20px' }}>
                  <h4 style={{ fontSize: '14px' }}>Q{idx+1}. {mcq.question}</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {mcq.options.map((option: string, optIdx: number) => {
                      const isCorrect = optIdx === mcq.answer;
                      const isSelected = selectedAnswers[idx] === optIdx;
                      let bg = 'var(--surface-variant)';
                      let textCol = 'var(--on-surface)';
                      if (answered) {
                        if (isCorrect) { bg = '#10B98118'; textCol = '#10B981'; }
                        else if (isSelected) { bg = '#EF444418'; textCol = '#EF4444'; }
                      }
                      return (
                        <button key={optIdx} disabled={answered}
                          onClick={() => { setSelectedAnswers({ ...selectedAnswers, [idx]: optIdx }); setShowExplanation({ ...showExplanation, [idx]: true }); if (isCorrect) confetti({ particleCount: 20, colors: ['#10B981'] }); }}
                          style={{ padding: '10px 14px', borderRadius: '10px', border: '1.5px solid var(--outline-variant)', textAlign: 'left', fontSize: '13px', cursor: answered ? 'default' : 'pointer', backgroundColor: bg, color: textCol, fontWeight: isSelected ? 600 : 400, transition: 'all 0.15s' }}>
                          {option}
                        </button>
                      );
                    })}
                  </div>
                  {showExplanation[idx] && mcq.explanation && (
                    <p style={{ fontSize: '12px', color: 'var(--secondary)', borderTop: '1px solid var(--outline-variant)', paddingTop: '10px', fontStyle: 'italic' }}>
                      {mcq.explanation}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {activeSubTab === 'flashcard' && activeNote && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <button onClick={handleGenerateFlashcards} className="md3-btn md3-btn-primary" disabled={isFlashcardLoading} style={{ width: 'fit-content' }}>
              {isFlashcardLoading ? 'Creating...' : 'Create Flashcards'}
            </button>
            {flashcards.length === 0 ? (
              <EmptyState
                illustration={<EmptyFlashcardIllustration />}
                title="No Flashcards Yet"
                message="Turn your notes into interactive flashcards for quick, spaced revision."
                action={!isFlashcardLoading ? { label: 'Create Flashcards', onClick: handleGenerateFlashcards } : undefined}
                tip="Flashcards are proven to boost memory retention through active recall."
              />
            ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' }}>
              {flashcards.map((fc, idx) => {
                const isFlipped = flippedCards[idx] || false;
                return (
                  <div key={idx} onClick={() => setFlippedCards({ ...flippedCards, [idx]: !isFlipped })}
                    className="md3-card-sm" style={{ height: '150px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', cursor: 'pointer', background: isFlipped ? 'var(--primary-container)' : 'var(--surface)' }}>
                    {!isFlipped ? (
                      <div>
                        <span style={{ fontSize: '10px', color: 'var(--outline)', textTransform: 'uppercase', letterSpacing: '1px' }}>Question</span>
                        <h4 style={{ fontSize: '14px', marginTop: '8px', fontWeight: 600 }}>{fc.question}</h4>
                      </div>
                    ) : (
                      <div>
                        <span style={{ fontSize: '10px', color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '1px' }}>Answer</span>
                        <p style={{ fontSize: '13px', marginTop: '8px', color: 'var(--on-primary-container)' }}>{fc.answer}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            )}
          </div>
        )}

        {activeSubTab === 'translate' && activeNote && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => handleTranslateNote('hindi')} className="md3-btn md3-btn-primary" disabled={isTranslating}>
                Translate to Hindi
              </button>
              <button onClick={() => handleTranslateNote('english')} className="md3-btn md3-btn-secondary" disabled={isTranslating}>
                Translate to English
              </button>
            </div>
            {translatedText ? (
              <div className="md3-card" style={{ fontSize: '14px', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                  <Languages size={16} style={{ color: 'var(--primary)' }} />
                  <span style={{ fontWeight: 600, fontSize: '13px' }}>Translation</span>
                </div>
                {translatedText}
              </div>
            ) : (
              <EmptyState
                illustration={<EmptyAiIllustration />}
                title="Ready to Translate"
                message="Break language barriers — translate your notes between Hindi and English instantly."
                action={{ label: 'Translate to Hindi', onClick: () => handleTranslateNote('hindi') }}
                tip="Bilingual notes help with better understanding and revision in your preferred language."
              />
            )}
          </div>
        )}

      </div>

    </div>
  );
}
