"use client";

import { useState } from "react";

type DemoTab = "summary" | "flashcard" | "quiz" | "voice";

export default function InteractiveDemo() {
  const [activeTab, setActiveTab] = useState<DemoTab>("summary");
  const [flipped, setFlipped] = useState(false);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [audioPlaying, setAudioPlaying] = useState(false);

  return (
    <div className="demo-showcase-container">
      {/* Tab Navigation */}
      <div className="demo-tabs-bar" role="tablist" aria-label="Interactive StudySnap Feature Demos">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "summary"}
          className={`demo-tab-btn ${activeTab === "summary" ? "active" : ""}`}
          onClick={() => setActiveTab("summary")}
        >
          <span className="demo-tab-icon">📝</span>
          <span>AI Summary</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "flashcard"}
          className={`demo-tab-btn ${activeTab === "flashcard" ? "active" : ""}`}
          onClick={() => {
            setActiveTab("flashcard");
            setFlipped(false);
          }}
        >
          <span className="demo-tab-icon">🃏</span>
          <span>Smart Flashcards</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "quiz"}
          className={`demo-tab-btn ${activeTab === "quiz" ? "active" : ""}`}
          onClick={() => {
            setActiveTab("quiz");
            setSelectedOption(null);
          }}
        >
          <span className="demo-tab-icon">🎯</span>
          <span>Active Recall Quiz</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "voice"}
          className={`demo-tab-btn ${activeTab === "voice" ? "active" : ""}`}
          onClick={() => setActiveTab("voice")}
        >
          <span className="demo-tab-icon">🎙️</span>
          <span>Voice Transcription</span>
        </button>
      </div>

      {/* Demo Screen Window */}
      <div className="demo-window">
        {/* Browser Chrome Header */}
        <div className="demo-window-header">
          <div className="demo-window-dots">
            <span className="dot dot-red" />
            <span className="dot dot-yellow" />
            <span className="dot dot-green" />
          </div>
          <div className="demo-window-title">
            <span>studysnap.app</span> / <span>ai-study-engine</span> / <span>live-demo</span>
          </div>
          <div className="demo-window-badge">
            <span className="live-dot" /> Live Preview
          </div>
        </div>

        {/* Tab 1: AI Summary */}
        {activeTab === "summary" && (
          <div className="demo-body demo-summary-view">
            <div className="demo-source-pill">
              <span className="pill-tag">Input Source:</span> 📄 Neurobiology-Lecture-04.pdf (28 Pages)
            </div>
            <div className="demo-result-card">
              <div className="demo-result-header">
                <h4>⚡ Executive AI Summary: Long-Term Potentiation (LTP)</h4>
                <span className="speed-badge">Generated in 0.64s</span>
              </div>
              <ul className="demo-summary-list">
                <li>
                  <strong>Core Mechanism:</strong> Persistent strengthening of synapses based on high-frequency stimulations, forming the cellular basis of learning and memory.
                </li>
                <li>
                  <strong>Receptor Dynamics:</strong> Glutamate release activates <em>AMPA receptors</em>, causing depolarization that dislodges the Mg²⁺ block from <em>NMDA receptors</em>.
                </li>
                <li>
                  <strong>Calcium Influx:</strong> Ca²⁺ activates CaMKII enzymes, driving insertion of additional AMPA receptors into the postsynaptic membrane.
                </li>
              </ul>
              <div className="demo-action-bar">
                <span className="tag-pill">#Neuroscience</span>
                <span className="tag-pill">#MedicalPrep</span>
                <span className="demo-keynote">💡 3 Key Takeaways • 15 Flashcards Auto-Created</span>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Smart Flashcards */}
        {activeTab === "flashcard" && (
          <div className="demo-body demo-flashcard-view">
            <div className="flashcard-instruction">
              Click the card to reveal the answer & simulate Spaced Repetition (SM-2):
            </div>
            <button
              type="button"
              className={`demo-flashcard ${flipped ? "is-flipped" : ""}`}
              onClick={() => setFlipped(!flipped)}
              aria-label="Study flashcard. Click to flip"
            >
              <div className="flashcard-inner">
                <div className="flashcard-front">
                  <div className="flashcard-meta">
                    <span className="flashcard-tag">BIOLOGY 101</span>
                    <span className="flashcard-diff">Card 4 of 18</span>
                  </div>
                  <p className="flashcard-question">
                    How does the Na⁺/K⁺-ATPase pump preserve resting membrane potential across the neuronal membrane?
                  </p>
                  <div className="flashcard-hint">
                    <span>👆 Click to flip and check answer</span>
                  </div>
                </div>
                <div className="flashcard-back">
                  <div className="flashcard-meta">
                    <span className="flashcard-tag correct">VERIFIED ANSWER</span>
                    <span className="flashcard-diff">Active Transport</span>
                  </div>
                  <p className="flashcard-answer">
                    It actively exports <strong>3 Na⁺ ions</strong> out of the cell for every <strong>2 K⁺ ions</strong> imported, utilizing 1 ATP molecule. This net loss of positive charge maintains intracellular negativity (-70mV).
                  </p>
                  <div className="flashcard-hint">
                    <span>👆 Click to flip back</span>
                  </div>
                </div>
              </div>
            </button>

            {flipped && (
              <div className="demo-sm2-rating">
                <span className="sm2-label">Rate recall difficulty:</span>
                <div className="sm2-buttons">
                  <button type="button" className="sm2-btn again">Again (1d)</button>
                  <button type="button" className="sm2-btn hard">Hard (3d)</button>
                  <button type="button" className="sm2-btn good">Good (7d)</button>
                  <button type="button" className="sm2-btn easy">Easy (14d)</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Active Recall Quiz */}
        {activeTab === "quiz" && (
          <div className="demo-body demo-quiz-view">
            <div className="quiz-header">
              <span className="quiz-difficulty">🔥 Exam-Style Practice MCQ</span>
              <span className="quiz-score">Question 1 / 5</span>
            </div>
            <h4 className="quiz-question-text">
              Which brain region is essential for consolidating short-term declarative memories into permanent long-term storage?
            </h4>
            <div className="quiz-options-list">
              {[
                { id: 0, text: "A) Amygdala", correct: false, reason: "Responsible for emotional processing and fear conditioning." },
                { id: 1, text: "B) Hippocampus", correct: true, reason: "Correct! Crucial for consolidating declarative episodic memories." },
                { id: 2, text: "C) Cerebellum", correct: false, reason: "Primarily coordinates motor control and procedural memory." },
                { id: 3, text: "D) Medulla Oblongata", correct: false, reason: "Controls autonomic functions like heart rate and respiration." },
              ].map((opt) => {
                const isSelected = selectedOption === opt.id;
                const isCorrect = opt.correct;
                let stateClass = "";
                if (isSelected) {
                  stateClass = isCorrect ? "option-correct" : "option-wrong";
                }

                return (
                  <button
                    key={opt.id}
                    type="button"
                    className={`quiz-option-btn ${stateClass}`}
                    onClick={() => setSelectedOption(opt.id)}
                  >
                    <span className="option-text">{opt.text}</span>
                    {isSelected && (
                      <span className="option-feedback">
                        {isCorrect ? "✅ " : "❌ "}
                        {opt.reason}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            {selectedOption !== null && (
              <div className="quiz-footer-msg">
                <span>🎯 Instant Groq AI explanation attached to your revision queue!</span>
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Voice Transcription */}
        {activeTab === "voice" && (
          <div className="demo-body demo-voice-view">
            <div className="voice-player-card">
              <div className="voice-controls">
                <button
                  type="button"
                  className={`voice-play-btn ${audioPlaying ? "playing" : ""}`}
                  onClick={() => setAudioPlaying(!audioPlaying)}
                  aria-label={audioPlaying ? "Pause simulated lecture" : "Play simulated lecture"}
                >
                  {audioPlaying ? "⏸" : "▶"}
                </button>
                <div className="voice-info">
                  <div className="voice-title">🎙️ Organic Chemistry Lecture 12.m4a</div>
                  <div className="voice-time">04:12 / 48:00 • 98.4% Confidence Score</div>
                </div>
                <div className={`voice-waveform ${audioPlaying ? "active" : ""}`} aria-hidden="true">
                  <span className="wave-bar bar-1" />
                  <span className="wave-bar bar-2" />
                  <span className="wave-bar bar-3" />
                  <span className="wave-bar bar-4" />
                  <span className="wave-bar bar-5" />
                  <span className="wave-bar bar-6" />
                  <span className="wave-bar bar-7" />
                  <span className="wave-bar bar-8" />
                </div>
              </div>

              <div className="voice-transcript-box">
                <div className="transcript-speaker">
                  <span className="speaker-avatar">👨‍🏫</span>
                  <span className="speaker-name">Prof. Henderson</span>
                  <span className="timestamp">[04:12]</span>
                </div>
                <p className="transcript-text">
                  &ldquo;...Notice how electrophilic aromatic substitution requires a strong Lewis acid catalyst like aluminum chloride (AlCl₃). The catalyst generates an extraordinarily electrophilic carbocation intermediate...&rdquo;
                </p>
                <div className="transcript-extracted-note">
                  <div className="note-badge">✨ Auto-Extracted Study Note</div>
                  <p><strong>Reaction Type:</strong> Electrophilic Aromatic Substitution (EAS)</p>
                  <p><strong>Required Catalyst:</strong> AlCl₃ (Lewis Acid) to generate the carbocation.</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
