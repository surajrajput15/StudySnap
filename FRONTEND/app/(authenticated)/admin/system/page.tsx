'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { fetchAdminHealth, AdminHealthResponse } from '@/lib/admin';

export default function AdminSystemPage() {
  const { getToken } = useAuth();
  const [data, setData] = useState<AdminHealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastCheck, setLastCheck] = useState<string>('');

  const runProbe = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');

      const res = await fetchAdminHealth(token);
      if (res && res.health) {
        setData(res);
        setLastCheck(new Date().toLocaleTimeString());
      } else {
        throw new Error((res as any)?.error || 'Failed to ping infrastructure');
      }
    } catch (err: any) {
      setError(err?.message || 'Error executing health probes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runProbe();
  }, []);

  const health = data?.health;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0 }}>Infrastructure & System Probes</h1>
          <p style={{ fontSize: '0.8125rem', color: 'var(--secondary)', margin: '4px 0 0 0' }}>
            Live status probes across database, AI acceleration, media storage, and cache clusters.
          </p>
        </div>

        <button
          onClick={runProbe}
          disabled={loading}
          className="admin-btn admin-btn-primary"
          style={{ fontSize: '0.8125rem' }}
        >
          {loading ? 'Probing...' : '⚡ Run Diagnostic Probe'}
        </button>
      </div>
      {/* Diagnostic probe explanation callout */}
      <div
        style={{
          background: 'var(--surface-variant)',
          border: '1px solid var(--outline-variant)',
          borderRadius: '8px',
          padding: '12px 16px',
          marginBottom: '20px',
          fontSize: '0.8125rem',
          color: 'var(--on-surface-variant)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}
      >
        <span>ℹ️</span>
        <div>
          Diagnostic probes test live PostgreSQL ping (<code>SELECT 1</code>), Groq LPU latency, Cloudinary storage signatures, and Upstash Redis connectivity. Probe runs are automatically recorded in the security audit trail.
        </div>
      </div>

      {lastCheck && (
        <div style={{ fontSize: '0.75rem', color: 'var(--secondary)', marginBottom: '16px' }}>
          Last automated check: <strong>{lastCheck}</strong>
        </div>
      )}

      {error && (
        <div className="admin-alert-banner admin-alert-critical" style={{ marginBottom: '20px' }}>
          <span>⚠️</span>
          <div>{error}</div>
          <button onClick={runProbe} className="admin-btn admin-btn-outline" style={{ marginLeft: 'auto', padding: '4px 8px', fontSize: '0.75rem' }}>
            Retry Probe
          </button>
        </div>
      )}

      {/* Health Probes Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '28px' }}>
        {/* Neon PostgreSQL */}
        <div className="admin-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
            <div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>PostgreSQL (Neon)</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--secondary)' }}>Relational storage & tables</div>
            </div>
            {renderStatusBadge(health?.database?.status)}
          </div>

          <div style={{ fontSize: '0.8125rem', display: 'flex', flexDirection: 'column', gap: '6px', color: 'var(--on-surface-variant)' }}>
            <div>Latency: <strong>{health?.database?.latencyMs != null ? `${health.database.latencyMs} ms` : '—'}</strong></div>
            <div>Status Detail: <strong>{health?.database?.message || 'Operational connection'}</strong></div>
            <div>Last Checked: <strong>{lastCheck || 'Just now'}</strong></div>
          </div>
        </div>

        {/* Groq LLaMA */}
        <div className="admin-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
            <div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>Groq LPU Engine</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--secondary)' }}>High-speed AI inference</div>
            </div>
            {renderStatusBadge(health?.groq?.status || (health as any)?.aiProvider?.status)}
          </div>

          <div style={{ fontSize: '0.8125rem', display: 'flex', flexDirection: 'column', gap: '6px', color: 'var(--on-surface-variant)' }}>
            <div>Latency: <strong>{(health?.groq?.latencyMs ?? (health as any)?.aiProvider?.latencyMs) != null ? `${health?.groq?.latencyMs ?? (health as any)?.aiProvider?.latencyMs} ms` : '—'}</strong></div>
            <div>Status Detail: <strong>{health?.groq?.message || (health as any)?.aiProvider?.message || 'Groq inference active'}</strong></div>
            <div>Last Checked: <strong>{lastCheck || 'Just now'}</strong></div>
          </div>
        </div>

        {/* Cloudinary */}
        <div className="admin-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
            <div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>Cloudinary Storage</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--secondary)' }}>Voice memos & media assets</div>
            </div>
            {renderStatusBadge(health?.cloudinary?.status || (health as any)?.storage?.status)}
          </div>

          <div style={{ fontSize: '0.8125rem', display: 'flex', flexDirection: 'column', gap: '6px', color: 'var(--on-surface-variant)' }}>
            <div>Latency: <strong>{(health?.cloudinary?.latencyMs ?? (health as any)?.storage?.latencyMs) != null ? `${health?.cloudinary?.latencyMs ?? (health as any)?.storage?.latencyMs} ms` : '—'}</strong></div>
            <div>Status Detail: <strong>{health?.cloudinary?.message || (health as any)?.storage?.message || 'Media storage connected'}</strong></div>
            <div>Last Checked: <strong>{lastCheck || 'Just now'}</strong></div>
          </div>
        </div>

        {/* Upstash Redis */}
        <div className="admin-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
            <div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>Upstash Redis</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--secondary)' }}>Distributed rate limiting & cache</div>
            </div>
            {renderStatusBadge(health?.redis?.status || (health as any)?.cache?.status)}
          </div>

          <div style={{ fontSize: '0.8125rem', display: 'flex', flexDirection: 'column', gap: '6px', color: 'var(--on-surface-variant)' }}>
            <div>Latency: <strong>{(health?.redis?.latencyMs ?? (health as any)?.cache?.latencyMs) != null ? `${health?.redis?.latencyMs ?? (health as any)?.cache?.latencyMs} ms` : '—'}</strong></div>
            <div>Status Detail: <strong>{health?.redis?.message || (health as any)?.cache?.message || 'Sliding window cache'}</strong></div>
            <div>Last Checked: <strong>{lastCheck || 'Just now'}</strong></div>
          </div>
        </div>
      </div>

      {/* Collapsible Technical Details (Preserves architecture details without cluttering primary ops) */}
      <details className="admin-card" style={{ cursor: 'pointer' }}>
        <summary style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--on-surface)', outline: 'none' }}>
          🛠️ Verified Architectural Safeguards & Specifications (Click to expand)
        </summary>
        <div style={{ marginTop: '16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px', fontSize: '0.8125rem' }}>
          <div style={{ padding: '12px', background: 'var(--surface-variant)', borderRadius: '6px' }}>
            <strong>PostgreSQL Architecture</strong>
            <p style={{ margin: '4px 0 0 0', color: 'var(--secondary)' }}>
              Serverless connection pooler with Drizzle ORM, strict foreign keys, user-scoped queries, and composite index scans.
            </p>
          </div>
          <div style={{ padding: '12px', background: 'var(--surface-variant)', borderRadius: '6px' }}>
            <strong>AI Fallback Architecture</strong>
            <p style={{ margin: '4px 0 0 0', color: 'var(--secondary)' }}>
              Per-feature killswitch overrides, sliding window rate limits, daily char budgets, and safe structured error fallbacks.
            </p>
          </div>
          <div style={{ padding: '12px', background: 'var(--surface-variant)', borderRadius: '6px' }}>
            <strong>Media Security Policy</strong>
            <p style={{ margin: '4px 0 0 0', color: 'var(--secondary)' }}>
              Signed HTTPS storage, 50MB audio ceiling, disk-spooled streaming, and strict audio container magic-byte verification.
            </p>
          </div>
          <div style={{ padding: '12px', background: 'var(--surface-variant)', borderRadius: '6px' }}>
            <strong>Rate Limiting & Auth</strong>
            <p style={{ margin: '4px 0 0 0', color: 'var(--secondary)' }}>
              Clerk session tokens, server-side RBAC validation, PIN lockout bounds, and append-only administrative audit logging.
            </p>
          </div>
        </div>
      </details>
    </div>
  );
}

function renderStatusBadge(status?: string) {
  if (status === 'healthy' || status === 'connected' || status === 'configured') {
    return <span className="badge-status-active">● Healthy</span>;
  }
  if (status === 'degraded' || status === 'maintenance') {
    return <span className="badge-status-maintenance">▲ Degraded</span>;
  }
  if (status === 'unavailable') {
    return <span className="badge-status-suspended">✖ Unavailable</span>;
  }
  return <span className="badge-status-suspended">? Unknown</span>;
}
