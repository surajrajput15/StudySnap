'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import {
  fetchAdminAiFeatures,
  fetchAdminAiAnalytics,
  updateAdminAiFeature,
  killAllAiFeatures,
  restoreAllAiFeatures,
  FeatureStatus,
  FeatureFlagState,
  AiFeatureAnalyticsItem,
} from '@/lib/admin';

interface FeatureDef {
  key: string;
  name: string;
  description: string;
  endpoint: string;
}

const AI_FEATURES_CATALOG: FeatureDef[] = [
  {
    key: 'ai_summary',
    name: 'Note Summarizer',
    description: 'Generates structured bullet-point summaries and key takeaways from student notes.',
    endpoint: '/api/ai/summarize',
  },
  {
    key: 'ai_mcq',
    name: 'Multiple Choice Generator',
    description: 'Generates multiple choice questions with answers and explanations from note materials.',
    endpoint: '/api/ai/mcqs',
  },
  {
    key: 'ai_flashcards',
    name: 'Flashcard Generator',
    description: 'Extracts question-answer pairs and converts study material into spaced repetition decks.',
    endpoint: '/api/user/flashcards',
  },
  {
    key: 'ai_mindmap',
    name: 'SVG Mind Map Generator',
    description: 'Generates hierarchical JSON mind maps rendered as interactive SVG trees.',
    endpoint: '/api/ai/mindmap',
  },
  {
    key: 'ai_quiz',
    name: 'Interactive Quiz Player',
    description: 'Creates 4-option multiple-choice quizzes with distractor explanations.',
    endpoint: '/api/ai/quiz',
  },
  {
    key: 'ai_translate',
    name: 'Language Translator',
    description: 'Translates academic notes between English and Hindi with educational context.',
    endpoint: '/api/ai/translate',
  },
  {
    key: 'ai_assistant',
    name: 'AI Study Tutor Chat',
    description: 'Interactive conversational tutor grounded in the student’s personal notes.',
    endpoint: '/api/ai/chat',
  },
  {
    key: 'ai_pdf',
    name: 'PDF Document Studio',
    description: 'Extracts structured knowledge and visual flashcards from uploaded student PDFs.',
    endpoint: '/api/ai/pdf',
  },
  {
    key: 'voice_transcription',
    name: 'Voice Memo Transcription',
    description: 'Converts recorded audio notes into text transcripts using speech models.',
    endpoint: '/api/voice-notes/transcribe',
  },
];

export default function AdminAiPage() {
  const { getToken } = useAuth();
  const [flags, setFlags] = useState<Record<string, FeatureFlagState>>({});
  const [telemetry, setTelemetry] = useState<Record<string, AiFeatureAnalyticsItem>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingKey, setUpdatingKey] = useState<string | null>(null);

  // Modals for high-risk bulk operations
  const [showKillAllModal, setShowKillAllModal] = useState(false);
  const [killConfirmInput, setKillConfirmInput] = useState('');
  const [killProcessing, setKillProcessing] = useState(false);

  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [restoreProcessing, setRestoreProcessing] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');

      const [featuresRes, analyticsRes] = await Promise.allSettled([
        fetchAdminAiFeatures(token),
        fetchAdminAiAnalytics(token),
      ]);

      if (featuresRes.status === 'fulfilled' && featuresRes.value.success) {
        const rawFeatures = featuresRes.value.features;
        if (Array.isArray(rawFeatures)) {
          const map: Record<string, FeatureFlagState> = {};
          for (const item of rawFeatures) {
            map[item.key] = {
              status: item.status,
              updatedAt: new Date().toISOString(),
              updatedBy: 'System',
            };
          }
          setFlags(map);
        } else {
          setFlags(rawFeatures);
        }
      }

      if (analyticsRes.status === 'fulfilled' && analyticsRes.value.success) {
        setTelemetry(analyticsRes.value.featureBreakdown || {});
      }
    } catch (err: any) {
      setError(err?.message || 'Error communicating with Admin API');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleStatusChange = async (featureKey: string, newStatus: FeatureStatus) => {
    try {
      setUpdatingKey(featureKey);
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');

      const res = await updateAdminAiFeature(token, featureKey, newStatus, 'Toggled from Admin Console');
      if (res.success) {
        setFlags((prev) => ({
          ...prev,
          [featureKey]: {
            status: newStatus,
            updatedAt: new Date().toISOString(),
            updatedBy: 'Admin',
          },
        }));
      } else {
        alert(res.error || 'Failed to update feature flag');
      }
    } catch (err: any) {
      alert(err.message || 'Error updating feature');
    } finally {
      setUpdatingKey(null);
    }
  };

  const handleExecuteKillAll = async () => {
    if (killConfirmInput.trim() !== 'DISABLE ALL') {
      alert('Please type "DISABLE ALL" exactly to confirm emergency shutdown.');
      return;
    }

    try {
      setKillProcessing(true);
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');

      const res = await killAllAiFeatures(token);
      if (res.success) {
        setShowKillAllModal(false);
        setKillConfirmInput('');
        await loadData();
      } else {
        alert(res.error || 'Failed to activate emergency kill switch');
      }
    } catch (err: any) {
      alert(err.message || 'Error activating kill switch');
    } finally {
      setKillProcessing(false);
    }
  };

  const handleExecuteRestoreAll = async () => {
    try {
      setRestoreProcessing(true);
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');

      const res = await restoreAllAiFeatures(token);
      if (res.success) {
        setShowRestoreModal(false);
        await loadData();
      } else {
        alert(res.error || 'Failed to restore AI features');
      }
    } catch (err: any) {
      alert(err.message || 'Error restoring features');
    } finally {
      setRestoreProcessing(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0 }}>AI Operations & Telemetry</h1>
          <p style={{ fontSize: '0.8125rem', color: 'var(--secondary)', margin: '4px 0 0 0' }}>
            Authoritative status and telemetry per AI capability. When placed in maintenance or disabled, endpoints safely return 503.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => setShowRestoreModal(true)}
            className="admin-btn admin-btn-success"
            style={{ fontSize: '0.8125rem' }}
          >
            ✓ Enable All Services
          </button>
          <button
            onClick={() => {
              setKillConfirmInput('');
              setShowKillAllModal(true);
            }}
            className="admin-btn admin-btn-danger"
            style={{ fontSize: '0.8125rem' }}
          >
            🚨 Emergency Kill Switch All
          </button>
        </div>
      </div>

      {error && (
        <div className="admin-alert-banner admin-alert-critical" style={{ marginBottom: '20px' }}>
          <span>⚠️</span>
          <div>{error}</div>
          <button onClick={loadData} className="admin-btn admin-btn-outline" style={{ marginLeft: 'auto', padding: '4px 8px', fontSize: '0.75rem' }}>
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--secondary)' }}>
          <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>🤖</div>
          <div>Loading AI Operations & Telemetry...</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {AI_FEATURES_CATALOG.map((feat) => {
            const currentStatus = flags[feat.key]?.status || 'enabled';
            const isUpdating = updatingKey === feat.key;
            const featTelem = telemetry[feat.key];
            const requests = featTelem?.requests ?? 0;
            const errors = featTelem?.errors ?? 0;
            const latency = featTelem?.avgLatency;

            const statusSource = flags[feat.key]?.updatedBy
              ? `Admin Override (${flags[feat.key]?.updatedBy})`
              : 'System Default';

            return (
              <div key={feat.key} className="admin-feature-card">
                <div className="admin-feature-info" style={{ flex: 1, minWidth: '240px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span className="admin-feature-title">{feat.name}</span>
                    <code style={{ fontSize: '0.75rem', color: 'var(--secondary)', background: 'var(--surface-variant)', padding: '2px 6px', borderRadius: '4px' }}>
                      {feat.key}
                    </code>
                    <span style={{ fontSize: '0.7rem', color: 'var(--secondary)', background: 'var(--surface-variant)', padding: '2px 6px', borderRadius: '4px' }}>
                      Source: {statusSource}
                    </span>
                  </div>
                  <div className="admin-feature-desc" style={{ marginTop: '2px' }}>{feat.description}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--on-surface-variant)', marginTop: '6px', display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
                    <span>Requests: <strong>{requests}</strong></span>
                    <span>Errors: <strong>{errors}</strong></span>
                    <span>Avg Latency: <strong>{latency ? `${latency}ms` : '—'}</strong></span>
                    <span>Endpoint: <code>{feat.endpoint}</code></span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                  <select
                    className="admin-select-status"
                    value={currentStatus}
                    disabled={isUpdating}
                    onChange={(e) => handleStatusChange(feat.key, e.target.value as FeatureStatus)}
                    style={{
                      borderColor:
                        currentStatus === 'enabled'
                          ? '#059669'
                          : currentStatus === 'maintenance'
                          ? '#d97706'
                          : '#dc2626',
                      color:
                        currentStatus === 'enabled'
                          ? '#065f46'
                          : currentStatus === 'maintenance'
                          ? '#92400e'
                          : '#991b1b',
                      backgroundColor:
                        currentStatus === 'enabled'
                          ? '#ecfdf5'
                          : currentStatus === 'maintenance'
                          ? '#fffbeb'
                          : '#fef2f2',
                    }}
                  >
                    <option value="enabled">● Enabled (Active)</option>
                    <option value="maintenance">▲ Maintenance (503)</option>
                    <option value="disabled">✖ Disabled (Offline)</option>
                  </select>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Emergency Kill Switch Modal */}
      {showKillAllModal && (
        <div className="admin-modal-backdrop">
          <div className="admin-modal" style={{ maxWidth: '520px' }}>
            <div className="admin-modal-header" style={{ color: '#dc2626', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>🚨</span>
              <span>Confirm Platform-Wide AI Kill Switch</span>
            </div>
            <p style={{ fontSize: '0.875rem', color: 'var(--on-surface-variant)', lineHeight: 1.5 }}>
              This is a high-risk operational action. Activating the kill switch will atomically place <strong>all 9 AI features</strong> into maintenance mode. Any incoming requests will immediately fail with safe HTTP 503 error responses.
            </p>

            <div style={{ background: 'var(--surface-variant)', padding: '12px', borderRadius: '6px', fontSize: '0.8125rem', marginBottom: '16px' }}>
              <strong>Impacted Services:</strong>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', marginTop: '6px', color: 'var(--secondary)' }}>
                {AI_FEATURES_CATALOG.map((f) => (
                  <div key={f.key}>• {f.name}</div>
                ))}
              </div>
            </div>

            <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--on-surface)', marginBottom: '8px' }}>
              To confirm, please type <code style={{ color: '#dc2626', background: '#fee2e2', padding: '2px 6px', borderRadius: '4px' }}>DISABLE ALL</code> below:
            </p>

            <input
              type="text"
              className="admin-input"
              style={{ width: '100%', borderColor: '#f87171', marginBottom: '16px' }}
              placeholder="DISABLE ALL"
              value={killConfirmInput}
              onChange={(e) => setKillConfirmInput(e.target.value)}
            />

            <div className="admin-modal-footer">
              <button
                onClick={() => setShowKillAllModal(false)}
                className="admin-btn admin-btn-outline"
                disabled={killProcessing}
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteKillAll}
                className="admin-btn admin-btn-danger"
                disabled={killConfirmInput.trim() !== 'DISABLE ALL' || killProcessing}
              >
                {killProcessing ? 'Disabling Services...' : 'Execute Kill Switch'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Restore All Modal */}
      {showRestoreModal && (
        <div className="admin-modal-backdrop">
          <div className="admin-modal">
            <div className="admin-modal-header" style={{ color: '#059669', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>✓</span>
              <span>Restore All AI Services</span>
            </div>
            <p style={{ fontSize: '0.875rem', color: 'var(--on-surface-variant)', lineHeight: 1.5 }}>
              Are you sure you want to restore <strong>all 9 AI features</strong> to active, operational status? This will remove all maintenance and disabled overrides.
            </p>

            <div className="admin-modal-footer">
              <button
                onClick={() => setShowRestoreModal(false)}
                className="admin-btn admin-btn-outline"
                disabled={restoreProcessing}
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteRestoreAll}
                className="admin-btn admin-btn-success"
                disabled={restoreProcessing}
              >
                {restoreProcessing ? 'Restoring Services...' : 'Confirm & Restore All'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
