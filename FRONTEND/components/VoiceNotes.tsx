'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useStore, VoiceNote } from '@/lib/store/useStore';
import {
  Mic, Square, Play, Pause, Trash2, FileText, Volume2,
  ArrowLeft, Check, X, Edit3, ChevronUp
} from 'lucide-react';
import confetti from 'canvas-confetti';
import EmptyState, { EmptyVoiceIllustration } from './EmptyState';
import { SpeechRecognition, SpeechRecognitionEvent } from '@/lib/speech';
import { formatShortDate } from '@/lib/utils';

interface VoiceNotesProps {
  onBack: () => void;
  onLinkToNote: (noteId: string) => void;
}

const WAVEFORM_BARS = 48;

function formatTime(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

interface AnimatedMicProps {
  active: boolean;
  level?: number;
}

function AnimatedMic({ active, level = 0 }: AnimatedMicProps) {
  const color = active ? '#EF4444' : 'var(--primary)';

  return (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
      <rect x="20" y="8" width="24" height="32" rx="12" fill={color} opacity={active ? 1 : 0.15} style={{ transition: 'all 0.15s' }}>
        <animate attributeName="opacity" values={active ? "1" : "0.15"} dur="0.3s" fill="freeze" />
      </rect>
      <path d="M32 44v8M26 52h12" stroke={color} strokeWidth="3" strokeLinecap="round" opacity={active ? 0.8 : 0.2} />
      {active && (
        <g>
          {[0, 1, 2, 3, 4].map((i) => (
            <line key={i} x1={10 + i * 2} y1={28 - level * 12 * Math.sin((i * 1.2) % Math.PI)} x2={10 + i * 2} y2={28} stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round" opacity={0.5 + level * 0.3}>
              <animate attributeName="y1" values={`${28 - level * 12};${28 + level * 12};${28 - level * 12}`} dur={`${0.3 + i * 0.1}s`} repeatCount="indefinite" />
            </line>
          ))}
          {[0, 1, 2, 3, 4].map((i) => (
            <line key={`r-${i}`} x1={50 + i * 2} y1={28 - level * 12 * Math.cos((i * 1.2) % Math.PI)} x2={50 + i * 2} y2={28} stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round" opacity={0.5 + level * 0.3}>
              <animate attributeName="y1" values={`${28 - level * 12};${28 + level * 12};${28 - level * 12}`} dur={`${0.4 + i * 0.08}s`} repeatCount="indefinite" />
            </line>
          ))}
        </g>
      )}
      <circle cx="32" cy="54" r="8" fill={color} opacity={active ? 0.12 : 0.06} />
    </svg>
  );
}

function WaveformBars({ levels, active, color }: { levels: number[]; active: boolean; color: string }) {
  return (
    <div className="waveform-container">
      {levels.map((level, i) => (
        <div
          key={i}
          className="waveform-bar"
          style={{
            height: `${Math.max(level * 100, 8)}%`,
            background: color,
            opacity: active ? 0.9 : 0.35,
            transition: 'height 0.08s ease, opacity 0.3s',
          }}
        />
      ))}
    </div>
  );
}

function NoiseMeter({ level }: { level: number }) {
  const segments = 8;
  const filled = Math.round(level * segments);

  return (
    <div className="noise-meter">
      <span className="noise-meter-label">Noise</span>
      <div className="noise-meter-bars">
        {Array.from({ length: segments }).map((_, i) => (
          <div
            key={i}
            className="noise-meter-segment"
            style={{
              background: i < filled
                ? i < segments * 0.5 ? '#10B981'
                  : i < segments * 0.75 ? '#F59E0B'
                    : '#EF4444'
                : 'var(--outline-variant)',
              opacity: i < filled ? 1 : 0.3,
            }}
          />
        ))}
      </div>
    </div>
  );
}

export default function VoiceNotes({ onBack, onLinkToNote }: VoiceNotesProps) {
  const voiceNotes = useStore((s) => s.voiceNotes);
  const notes = useStore((s) => s.notes);
  const addVoiceNote = useStore((s) => s.addVoiceNote);
  const deleteVoiceNote = useStore((s) => s.deleteVoiceNote);
  const updateNote = useStore((s) => s.updateNote);
  const addNote = useStore((s) => s.addNote);

  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [audioLevel, setAudioLevel] = useState(0);
  const [waveformLevels, setWaveformLevels] = useState<number[]>(new Array(WAVEFORM_BARS).fill(0.05));

  const [playingId, setPlayingId] = useState<string | null>(null);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [playbackProgress, setPlaybackProgress] = useState(0);

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const durationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const speechCtor = window as unknown as {
        SpeechRecognition?: new () => SpeechRecognition;
        webkitSpeechRecognition?: new () => SpeechRecognition;
      };
      const SpeechRecognitionCtor = speechCtor.SpeechRecognition || speechCtor.webkitSpeechRecognition;
      if (SpeechRecognitionCtor) {
        const rec = new SpeechRecognitionCtor();
        rec.continuous = true;
        rec.interimResults = true;
        rec.lang = 'en-IN';
        rec.onresult = (event: SpeechRecognitionEvent) => {
          let finalTranscript = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) finalTranscript += event.results[i][0].transcript;
          }
          if (finalTranscript) setTranscript(prev => prev + ' ' + finalTranscript.trim());
        };
        recognitionRef.current = rec;
      }
    }
  }, []);

  useEffect(() => {
    if (isRecording && !isPaused) {
      durationTimerRef.current = setInterval(() => setRecordingDuration(prev => prev + 1), 1000);
    } else {
      if (durationTimerRef.current) clearInterval(durationTimerRef.current);
    }
    return () => { if (durationTimerRef.current) clearInterval(durationTimerRef.current); };
  }, [isRecording, isPaused]);

  useEffect(() => {
    return () => {
      if (activeAudioRef.current) activeAudioRef.current.pause();
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (audioContextRef.current) audioContextRef.current.close();
      if (recognitionRef.current) recognitionRef.current.stop();
      if (streamRef.current) streamRef.current.getTracks().forEach(track => track.stop());
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const startAudioAnalysis = useCallback((stream: MediaStream) => {
    const audioCtx = new AudioContext();
    audioContextRef.current = audioCtx;
    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 128;
    source.connect(analyser);
    analyserRef.current = analyser;

    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    const animate = () => {
      analyser.getByteFrequencyData(dataArray);
      const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
      const level = Math.min(avg / 128, 1);
      setAudioLevel(level);

      const bars = new Array(WAVEFORM_BARS).fill(0);
      for (let i = 0; i < WAVEFORM_BARS; i++) {
        const idx = Math.floor((i / WAVEFORM_BARS) * dataArray.length);
        bars[i] = Math.min(dataArray[idx] / 128, 1);
      }
      setWaveformLevels(bars);

      animationRef.current = requestAnimationFrame(animate);
    };
    animate();
  }, []);

  const handleStartRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      audioChunksRef.current = [];

      startAudioAnalysis(stream);

      const mimeType = typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported
        ? (MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : (MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : ''))
        : '';
      const mediaRecorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorder.ondataavailable = (event) => { if (event.data.size > 0) audioChunksRef.current.push(event.data); };
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType || 'audio/webm' });
        const audioUrl = URL.createObjectURL(audioBlob);
        addVoiceNote({
          noteId: '',
          audioUrl,
          duration: recordingDuration,
          transcript: transcript.trim() || 'Voice note captured.',
        });
        setRecordingDuration(0);
        setTranscript('');
        setAudioLevel(0);
        setWaveformLevels(new Array(WAVEFORM_BARS).fill(0.05));
        if (animationRef.current) cancelAnimationFrame(animationRef.current);
        confetti({ particleCount: 40, colors: ['#0061A4', '#bdc7dc'] });
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
      setIsPaused(false);
      setTranscript('');
      if (recognitionRef.current) recognitionRef.current.start();
    } catch (err) {
      console.error("Mic Access failed:", err);
      alert("Failed to access microphone. Please grant permission.");
    }
  };

  const handlePauseRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      if (isPaused) {
        mediaRecorderRef.current.resume();
        setIsPaused(false);
        if (recognitionRef.current) recognitionRef.current.start();
      } else {
        mediaRecorderRef.current.pause();
        setIsPaused(true);
        if (recognitionRef.current) recognitionRef.current.stop();
      }
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      streamRef.current?.getTracks().forEach(track => track.stop());
      setIsRecording(false);
      setIsPaused(false);
      if (recognitionRef.current) recognitionRef.current.stop();
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    }
  };

  const handlePlayVoice = (vn: VoiceNote) => {
    if (playingId === vn.id) {
      if (activeAudioRef.current) {
        activeAudioRef.current.pause();
        setPlayingId(null);
        setPlaybackProgress(0);
      }
    } else {
      if (activeAudioRef.current) activeAudioRef.current.pause();
      const audio = new Audio(vn.audioUrl);
      audio.playbackRate = playbackSpeed;
      audio.ontimeupdate = () => setPlaybackProgress(Math.floor(audio.currentTime));
      audio.onended = () => {
        setPlayingId(null);
        setPlaybackProgress(0);
      };
      activeAudioRef.current = audio;
      setPlayingId(vn.id);
      setPlaybackProgress(0);
      audio.play();
    }
  };

  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
    if (activeAudioRef.current) activeAudioRef.current.playbackRate = speed;
  };

  const handleSeek = (vn: VoiceNote, e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const fraction = x / rect.width;
    const seekTime = fraction * vn.duration;
    if (activeAudioRef.current && playingId === vn.id) {
      activeAudioRef.current.currentTime = seekTime;
      setPlaybackProgress(Math.floor(seekTime));
    }
  };

  const handleSeekKeyDown = (vn: VoiceNote, e: React.KeyboardEvent<HTMLDivElement>) => {
    const step = Math.max(1, Math.round(vn.duration / 20));
    let next = playbackProgress;
    if (e.key === 'ArrowRight') next = Math.min(vn.duration, playbackProgress + step);
    else if (e.key === 'ArrowLeft') next = Math.max(0, playbackProgress - step);
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = vn.duration;
    else return;
    e.preventDefault();
    if (activeAudioRef.current && playingId === vn.id) {
      activeAudioRef.current.currentTime = next;
    }
    setPlaybackProgress(Math.floor(next));
  };

  const handleRename = (vn: VoiceNote) => {
    if (renameValue.trim() && renameValue !== vn.transcript) {
      const linkedNote = notes.find(n => n.id === vn.noteId);
      if (linkedNote) {
        updateNote(linkedNote.id, { title: renameValue.trim() });
      }
    }
    setRenamingId(null);
  };

  const handleCreateNoteFromVoice = (vn: VoiceNote) => {
    const created = addNote({
      title: vn.transcript?.substring(0, 40) || 'Voice Note',
      content: vn.transcript || 'Voice recording',
      tags: [],
      categoryId: null,
      folderId: null,
      isPinned: false,
      isFavorite: false,
      pinLock: null,
    });
    updateNote(created.id, { content: (vn.transcript || 'Voice recording') + '\n\n[Audio Recording]' });
    confetti({ particleCount: 30, colors: ['#10B981'] });
    onLinkToNote(created.id);
  };

  const recordingWaveform = isRecording && !isPaused ? waveformLevels : new Array(WAVEFORM_BARS).fill(0.05);

  return (
    <div className="voice-memos-container">
      {/* Header */}
      <div className="voice-memos-header">
        <button onClick={onBack} className="voice-memos-header-btn" aria-label="Back to notes">
          <ArrowLeft size={18} />
        </button>
        <h2 className="voice-memos-title">Voice Memos</h2>
        <span className="voice-memos-count">{voiceNotes.length}</span>
      </div>

      {/* Recording Area */}
      <div className={`voice-recording-area ${isRecording ? 'recording' : ''}`}>
        {isRecording && <NoiseMeter level={audioLevel} />}

        <div className="voice-mic-section">
          <div className={`voice-mic-ring ${isRecording ? (isPaused ? 'paused' : 'active') : ''}`}>
            <AnimatedMic active={isRecording && !isPaused} level={audioLevel} />
          </div>
        </div>

        <div className="voice-timer">{formatTime(recordingDuration)}</div>

        {isRecording && (
          <div className="voice-status-row">
            <div className={`voice-status-dot ${isPaused ? '' : 'recording'}`} />
            <span>{isPaused ? 'Paused' : 'Recording'}</span>
            {!isPaused && <div className="voice-status-waves"><div className="wave-bar" /><div className="wave-bar" /><div className="wave-bar" /></div>}
          </div>
        )}

        {/* Waveform */}
        <WaveformBars levels={recordingWaveform as number[]} active={isRecording && !isPaused} color={isRecording ? '#EF4444' : 'var(--primary)'} />

        {/* Real-time Transcript */}
        {isRecording && transcript && (
          <div className="voice-live-transcript">
            <p>{transcript}</p>
          </div>
        )}

        {/* Controls */}
        <div className="voice-controls">
          {isRecording ? (
            <>
              <button onClick={handlePauseRecording} className="voice-btn voice-btn-secondary" title={isPaused ? 'Resume' : 'Pause'} aria-label={isPaused ? 'Resume recording' : 'Pause recording'}>
                {isPaused ? <Play size={20} fill="currentColor" /> : <Pause size={20} />}
              </button>
              <button onClick={handleStopRecording} className="voice-btn voice-btn-stop" title="Stop" aria-label="Stop recording">
                <Square size={18} />
              </button>
            </>
          ) : (
            <button onClick={handleStartRecording} className="voice-btn voice-btn-record" title="Record" aria-label="Start recording">
              <Mic size={24} />
            </button>
          )}
        </div>

        {!isRecording && (
          <p className="voice-hint">Tap to record a voice memo</p>
        )}
      </div>

      {/* Recordings List */}
      <div className="voice-recordings-section">
        <h3 className="voice-recordings-heading">All Recordings</h3>

        {voiceNotes.length === 0 ? (
          <EmptyState
            illustration={<EmptyVoiceIllustration />}
            title="No Recordings Yet"
            message="Your voice is a powerful study tool. Record lectures, ideas, or revision notes on the go."
            action={{ label: 'Start Recording', onClick: handleStartRecording }}
            tip="Transcripts are generated automatically — review and link recordings to notes."
          />
        ) : (
          <div className="voice-recordings-list">
            {[...voiceNotes].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map((vn) => {
              const isPlaying = playingId === vn.id;
              const isExpanded = expandedId === vn.id;
              const isRenaming = renamingId === vn.id;

              return (
                <div key={vn.id} className={`voice-recording-card ${isPlaying ? 'playing' : ''}`}>
                  <div className="voice-recording-main" onClick={() => !isRenaming && setExpandedId(isExpanded ? null : vn.id)} role="button" tabIndex={0} aria-expanded={isExpanded} aria-label={isExpanded ? `Collapse ${vn.transcript?.substring(0, 40) || 'Voice note'}` : `Expand ${vn.transcript?.substring(0, 40) || 'Voice note'}`} onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !isRenaming) { e.preventDefault(); setExpandedId(isExpanded ? null : vn.id); } }}>
                    {/* Play Button */}
                    <button
                      onClick={(e) => { e.stopPropagation(); handlePlayVoice(vn); }}
                      className="voice-play-btn"
                      aria-label={isPlaying ? 'Stop playback' : 'Play recording'}
                    >
                      {isPlaying ? <Square size={14} /> : <Play size={18} style={{ marginLeft: '2px' }} fill="currentColor" />}
                    </button>

                    {/* Info */}
                    <div className="voice-recording-info">
                      {isRenaming ? (
                        <div className="voice-rename-row" onClick={e => e.stopPropagation()}>
                          <input
                            type="text"
                            value={renameValue}
                            onChange={e => setRenameValue(e.target.value)}
                            autoFocus
                            className="voice-rename-input"
                            onKeyDown={e => { if (e.key === 'Enter') handleRename(vn); if (e.key === 'Escape') setRenamingId(null); }}
                          />
                          <button onClick={() => handleRename(vn)} className="voice-rename-confirm" aria-label="Confirm rename"><Check size={14} /></button>
                          <button onClick={() => setRenamingId(null)} className="voice-rename-cancel" aria-label="Cancel rename"><X size={14} /></button>
                        </div>
                      ) : (
                        <div className="voice-recording-title">
                          {vn.transcript?.substring(0, 40) || `Voice ${formatTime(vn.duration)}`}
                        </div>
                      )}
                      <div className="voice-recording-meta">
                        <span>{formatTime(vn.duration)}</span>
                        <span className="voice-meta-dot">·</span>
                        <span>{formatShortDate(vn.createdAt)}</span>
                      </div>
                    </div>

                    {/* Speed + Actions */}
                    <div className="voice-recording-actions" onClick={e => e.stopPropagation()}>
                      {isPlaying && (
                        <div className="voice-speed-row">
                          {[0.5, 1, 1.5, 2].map(s => (
                            <button
                              key={s}
                              onClick={() => handleSpeedChange(s)}
                              className={`voice-speed-chip ${playbackSpeed === s ? 'active' : ''}`}
                            >
                              {s}x
                            </button>
                          ))}
                        </div>
                      )}
                      <button onClick={() => { setRenamingId(vn.id); setRenameValue(vn.transcript?.substring(0, 40) || `Voice ${formatTime(vn.duration)}`); }} className="voice-action-btn" title="Rename" aria-label="Rename recording">
                        <Edit3 size={14} />
                      </button>
                      <button onClick={() => { handleCreateNoteFromVoice(vn); }} className="voice-action-btn" title="Create Note" aria-label="Create note from recording">
                        <FileText size={14} />
                      </button>
                      <button onClick={() => deleteVoiceNote(vn.id)} className="voice-action-btn voice-action-delete" title="Delete" aria-label="Delete recording">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Playback Waveform / Progress */}
                  {isPlaying && (
                    <div className="voice-playback-bar" role="slider" tabIndex={0} aria-label="Seek position" aria-valuemin={0} aria-valuemax={vn.duration} aria-valuenow={playbackProgress} aria-valuetext={formatTime(playbackProgress)} onClick={(e) => handleSeek(vn, e)} onKeyDown={(e) => handleSeekKeyDown(vn, e)}>
                      <div className="voice-playback-track">
                        <div className="voice-playback-fill" style={{ width: `${vn.duration > 0 ? (playbackProgress / vn.duration) * 100 : 0}%` }} />
                      </div>
                      <div className="voice-playback-time">
                        <span>{formatTime(playbackProgress)}</span>
                        <span>{formatTime(vn.duration)}</span>
                      </div>
                    </div>
                  )}

                  {/* Expanded: Transcript + Waveform preview */}
                  {isExpanded && !isPlaying && (
                    <div className="voice-expanded-section">
                      <div className="voice-expanded-waveform">
                        {Array.from({ length: 60 }).map((_, i) => (
                          <div
                            key={i}
                            style={{
                              height: `${10 + Math.sin(i * 1.5) * 15 + Math.cos(i * 0.7) * 10 + 10}%`,
                              width: '3px',
                              borderRadius: '2px',
                              background: 'var(--outline-variant)',
                              opacity: 0.4,
                            }}
                          />
                        ))}
                      </div>
                      {vn.transcript && (
                        <div className="voice-transcript-panel">
                          <div className="voice-transcript-header">
                            <Volume2 size={13} />
                            <span>Transcript</span>
                          </div>
                          <p className="voice-transcript-text">{vn.transcript}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {isExpanded && (
                    <button className="voice-expand-toggle" onClick={() => setExpandedId(null)} aria-label="Collapse recording">
                      <ChevronUp size={16} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
