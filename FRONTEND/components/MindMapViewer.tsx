'use client';

import React, { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useStore } from '@/lib/store/useStore';
import { API, apiFetch } from '@/lib/config';
import { MapPin, ZoomIn, ZoomOut, RotateCcw, ArrowLeft, Sparkles, ChevronRight } from 'lucide-react';

export interface MindMapNode {
  id: string;
  label: string;
  children?: MindMapNode[];
}

const DEFAULT_MAP: MindMapNode = {
  id: 'root',
  label: 'Effective Learning',
  children: [
    {
      id: 'branch-1',
      label: 'Cognitive Science',
      children: [
        { id: 'leaf-1-1', label: 'Spaced Repetition' },
        { id: 'leaf-1-2', label: 'Active Recall' },
        { id: 'leaf-1-3', label: 'Interleaving' },
      ],
    },
    {
      id: 'branch-2',
      label: 'Study Habits',
      children: [
        { id: 'leaf-2-1', label: 'Pomodoro 25/5' },
        { id: 'leaf-2-2', label: 'Dual Coding' },
        { id: 'leaf-2-3', label: 'Feynman Technique' },
      ],
    },
    {
      id: 'branch-3',
      label: 'Memory Retention',
      children: [
        { id: 'leaf-3-1', label: 'Sleep & Consolidation' },
        { id: 'leaf-3-2', label: 'Chunking' },
        { id: 'leaf-3-3', label: 'Mnemonic Anchors' },
      ],
    },
  ],
};

interface MindMapViewerProps {
  onBack?: () => void;
  initialTopic?: string;
}

export default function MindMapViewer({ onBack, initialTopic }: MindMapViewerProps) {
  const { getToken } = useAuth();
  const notes = useStore((s) => s.notes);
  const [mindMap, setMindMap] = useState<MindMapNode>(() => {
    if (initialTopic) {
      return {
        id: 'root',
        label: initialTopic,
        children: DEFAULT_MAP.children,
      };
    }
    return DEFAULT_MAP;
  });

  const [topicInput, setTopicInput] = useState('');
  const [zoom, setZoom] = useState(1);
  const [loading, setLoading] = useState(false);
  const [collapsedNodes, setCollapsedNodes] = useState<Record<string, boolean>>({});

  const toggleCollapse = (id: string) => {
    setCollapsedNodes((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleGenerate = async () => {
    if (!topicInput.trim()) return;
    try {
      setLoading(true);
      const token = await getToken();
      const res = await apiFetch<{ success: boolean; mindmap?: MindMapNode; error?: string }>(
        API.ai.mindmap,
        {
          method: 'POST',
          token: token || undefined,
          body: JSON.stringify({ topic: topicInput.trim() }),
        }
      );

      if (res && res.mindmap) {
        setMindMap(res.mindmap);
      } else {
        // Fallback structure
        setMindMap({
          id: 'root',
          label: topicInput.trim(),
          children: [
            {
              id: 'b-1',
              label: 'Fundamentals',
              children: [
                { id: 'l-1', label: 'Definitions' },
                { id: 'l-2', label: 'Core Principles' },
              ],
            },
            {
              id: 'b-2',
              label: 'Applications',
              children: [
                { id: 'l-3', label: 'Use Cases' },
                { id: 'l-4', label: 'Examples' },
              ],
            },
            {
              id: 'b-3',
              label: 'Advanced Mastery',
              children: [
                { id: 'l-5', label: 'Formulas & Rules' },
                { id: 'l-6', label: 'Edge Cases' },
              ],
            },
          ],
        });
      }
    } catch {
      // Fallback
      setMindMap({
        id: 'root',
        label: topicInput.trim(),
        children: DEFAULT_MAP.children,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {onBack && (
            <button
              onClick={onBack}
              style={{
                background: 'none',
                border: '1px solid var(--outline-variant)',
                borderRadius: '8px',
                padding: '6px 10px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                color: 'var(--on-surface)',
              }}
            >
              <ArrowLeft size={16} /> Back
            </button>
          )}
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1.3rem' }}>🗺️</span> SVG Concept Mind Map
            </h2>
            <div style={{ fontSize: '0.8rem', color: 'var(--secondary)' }}>
              Interactive visual hierarchy & knowledge trees
            </div>
          </div>
        </div>

        {/* Zoom Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            onClick={() => setZoom((z) => Math.min(z + 0.15, 1.6))}
            style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--outline-variant)', background: 'var(--surface)', cursor: 'pointer' }}
            title="Zoom In"
          >
            <ZoomIn size={16} />
          </button>
          <button
            onClick={() => setZoom((z) => Math.max(z - 0.15, 0.6))}
            style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--outline-variant)', background: 'var(--surface)', cursor: 'pointer' }}
            title="Zoom Out"
          >
            <ZoomOut size={16} />
          </button>
          <button
            onClick={() => setZoom(1)}
            style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--outline-variant)', background: 'var(--surface)', cursor: 'pointer' }}
            title="Reset Zoom"
          >
            <RotateCcw size={16} />
          </button>
        </div>
      </div>

      {/* Generator Prompt Bar */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <input
          type="text"
          placeholder="Enter any topic or select a note (e.g. Thermodynamics, Neural Networks)..."
          value={topicInput}
          onChange={(e) => setTopicInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
          style={{
            flex: 1,
            padding: '10px 14px',
            borderRadius: '10px',
            border: '1px solid var(--outline-variant)',
            background: 'var(--surface)',
            color: 'var(--on-surface)',
            fontSize: '0.875rem',
          }}
        />
        <button
          onClick={handleGenerate}
          disabled={loading || !topicInput.trim()}
          style={{
            padding: '10px 18px',
            borderRadius: '10px',
            border: 'none',
            background: 'var(--primary)',
            color: '#ffffff',
            fontWeight: 600,
            fontSize: '0.875rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            opacity: loading || !topicInput.trim() ? 0.6 : 1,
          }}
        >
          <Sparkles size={16} /> {loading ? 'Generating...' : 'Generate Map'}
        </button>
      </div>

      {/* SVG Mind Map Visual Canvas */}
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--outline-variant)',
          borderRadius: '20px',
          padding: '24px',
          minHeight: '450px',
          overflow: 'auto',
          boxShadow: 'var(--elevation-2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: 'center center',
            transition: 'transform 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            gap: '48px',
          }}
        >
          {/* Root Central Node */}
          <div
            style={{
              padding: '16px 24px',
              borderRadius: '16px',
              background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))',
              color: '#ffffff',
              fontWeight: 700,
              fontSize: '1.15rem',
              boxShadow: 'var(--elevation-3)',
              textAlign: 'center',
              minWidth: '160px',
            }}
          >
            {mindMap.label}
          </div>

          {/* Branches Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {mindMap.children?.map((branch) => {
              const isCollapsed = collapsedNodes[branch.id];

              return (
                <div key={branch.id} style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
                  {/* Branch Node */}
                  <div
                    onClick={() => toggleCollapse(branch.id)}
                    style={{
                      padding: '12px 18px',
                      borderRadius: '12px',
                      background: 'var(--surface-variant)',
                      border: '2px solid var(--primary)',
                      color: 'var(--on-surface)',
                      fontWeight: 600,
                      fontSize: '0.9375rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      boxShadow: 'var(--elevation-1)',
                      minWidth: '150px',
                    }}
                  >
                    <span>{branch.label}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--primary)' }}>
                      {isCollapsed ? '+' : '−'}
                    </span>
                  </div>

                  {/* Leaf Children */}
                  {!isCollapsed && branch.children && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {branch.children.map((leaf) => (
                        <div
                          key={leaf.id}
                          style={{
                            padding: '8px 14px',
                            borderRadius: '8px',
                            background: 'var(--surface)',
                            border: '1px solid var(--outline-variant)',
                            color: 'var(--on-surface-variant)',
                            fontSize: '0.8125rem',
                            fontWeight: 500,
                            boxShadow: 'var(--elevation-1)',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          • {leaf.label}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
