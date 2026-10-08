'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import Link from 'next/link';
import { fetchAdminOverview, AdminOverviewResponse } from '@/lib/admin';

export default function AdminOverviewPage() {
  const { getToken } = useAuth();
  const [data, setData] = useState<AdminOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      const res = await fetchAdminOverview(token);
      if (res && res.metrics) {
        setData(res);
      } else {
        throw new Error((res as any)?.error || 'Failed to load metrics');
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

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--secondary)' }}>
        <div style={{ fontSize: '2rem', marginBottom: '16px' }}>⚡</div>
        <div>Loading Platform Telemetry...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-alert-banner admin-alert-critical">
        <span>⚠️</span>
        <div>{error}</div>
        <button onClick={loadData} className="admin-btn admin-btn-outline" style={{ marginLeft: 'auto' }}>
          Retry
        </button>
      </div>
    );
  }

  const metrics = data?.metrics;
  const totalUsers = metrics?.totalUsers ?? 0;
  const studentUsers = metrics?.studentUsers ?? Math.max(totalUsers - (metrics?.adminUsers ?? 1), 0);
  const adminUsers = metrics?.adminUsers ?? (totalUsers > 0 ? 1 : 0);
  const aiTotal = metrics?.aiRequestsTotal ?? 0;
  const aiSuccessRate = metrics?.aiSuccessRate;
  const avgLatencyMs = metrics?.avgLatencyMs;

  const dbStatus = data?.systemHealth?.database?.status;
  const aiStatus = data?.systemHealth?.groq?.status || data?.systemHealth?.aiProvider?.status;
  const storageStatus = data?.systemHealth?.cloudinary?.status || data?.systemHealth?.storage?.status;
  const cacheStatus = data?.systemHealth?.redis?.status || data?.systemHealth?.cache?.status;

  const getStatusBadge = (status?: string) => {
    if (status === 'healthy' || status === 'connected' || status === 'configured') {
      return <span className="badge-status-active">● Healthy</span>;
    }
    if (status === 'degraded' || status === 'maintenance') {
      return <span className="badge-status-maintenance">▲ Degraded</span>;
    }
    return <span className="badge-status-suspended">✖ Unavailable</span>;
  };

  return (
    <div>
      {/* Action Required Banner or Calm State */}
      {data?.actionRequired && data.actionRequired.length > 0 ? (
        <div style={{ marginBottom: '24px' }}>
          {data.actionRequired.map((action) => (
            <div
              key={action.id}
              className={`admin-alert-banner admin-alert-${action.level === 'critical' ? 'critical' : action.level === 'warning' ? 'warning' : 'info'}`}
            >
              <span style={{ fontWeight: 700 }}>
                {action.level === 'critical' ? '🚨' : action.level === 'warning' ? '⚠️' : 'ℹ️'}
              </span>
              <div>
                <strong>Action Required:</strong> {action.message}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '12px 16px',
            backgroundColor: 'rgba(16, 185, 129, 0.08)',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            borderRadius: '8px',
            marginBottom: '24px',
            fontSize: '0.875rem',
            color: '#065f46',
          }}
        >
          <span style={{ fontSize: '1.1rem' }}>🟢</span>
          <div>
            <strong>All systems operating normally.</strong> No critical alerts or moderation backlogs detected.
          </div>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="admin-metrics-grid">
        <div className="admin-card">
          <div className="admin-metric-label">Total Registered Accounts</div>
          <div className="admin-metric-value">{totalUsers}</div>
          <div className="admin-metric-sub">
            {studentUsers} Students • {adminUsers} Staff / Admins
          </div>
        </div>

        <div className="admin-card">
          <div className="admin-metric-label">Active Users (24h)</div>
          <div className="admin-metric-value">{metrics?.activeUsersToday ?? 0}</div>
          <div className="admin-metric-sub">Online in current study period</div>
        </div>

        <div className="admin-card">
          <div className="admin-metric-label">Notes & Materials</div>
          <div className="admin-metric-value">{metrics?.notesCreatedTotal ?? 0}</div>
          <div className="admin-metric-sub">Saved student documents & summaries</div>
        </div>

        <div className="admin-card">
          <div className="admin-metric-label">AI Generations</div>
          <div className="admin-metric-value">{aiTotal}</div>
          <div className="admin-metric-sub">Summaries, MCQs, Chat, Mind Maps</div>
        </div>

        <div className="admin-card">
          <div className="admin-metric-label">AI Success Rate</div>
          <div className="admin-metric-value" style={{ color: aiTotal > 0 ? '#059669' : 'var(--secondary)' }}>
            {aiTotal > 0 && aiSuccessRate !== null ? `${aiSuccessRate}%` : '—'}
          </div>
          <div className="admin-metric-sub">
            {aiTotal > 0 && avgLatencyMs !== null
              ? `Average latency ${avgLatencyMs}ms`
              : 'No AI telemetry recorded yet'}
          </div>
        </div>
      </div>

      {/* Two Column Section */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '24px' }}>
        {/* System Health Quick Glance */}
        <div className="admin-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>Infrastructure Probes</h2>
            <Link href="/admin/system" style={{ fontSize: '0.8125rem', color: 'var(--primary)', fontWeight: 600 }}>
              Live Diagnostics →
            </Link>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'var(--surface-variant)', borderRadius: '8px' }}>
              <div>
                <strong>PostgreSQL Database (Neon)</strong>
                <div style={{ fontSize: '0.75rem', color: 'var(--secondary)' }}>Relational storage & tables</div>
              </div>
              {getStatusBadge(dbStatus)}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'var(--surface-variant)', borderRadius: '8px' }}>
              <div>
                <strong>Groq LLaMA Engine</strong>
                <div style={{ fontSize: '0.75rem', color: 'var(--secondary)' }}>High-speed AI inference</div>
              </div>
              {getStatusBadge(aiStatus)}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'var(--surface-variant)', borderRadius: '8px' }}>
              <div>
                <strong>Cloudinary Storage</strong>
                <div style={{ fontSize: '0.75rem', color: 'var(--secondary)' }}>Voice memos & media assets</div>
              </div>
              {getStatusBadge(storageStatus)}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'var(--surface-variant)', borderRadius: '8px' }}>
              <div>
                <strong>Upstash Redis</strong>
                <div style={{ fontSize: '0.75rem', color: 'var(--secondary)' }}>Distributed rate limiting & cache</div>
              </div>
              {getStatusBadge(cacheStatus)}
            </div>
          </div>
        </div>

        {/* Recent Audit Activities */}
        <div className="admin-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>Recent Audit Activity</h2>
            <Link href="/admin/audit" style={{ fontSize: '0.8125rem', color: 'var(--primary)', fontWeight: 600 }}>
              Full Audit Trail →
            </Link>
          </div>

          {data?.recentAudit && data.recentAudit.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {data.recentAudit.slice(0, 5).map((log) => (
                <div
                  key={log.id}
                  style={{
                    padding: '8px 12px',
                    border: '1px solid var(--outline-variant)',
                    borderRadius: '8px',
                    fontSize: '0.8125rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <code style={{ fontWeight: 600, color: 'var(--primary-dark)', background: 'var(--surface-variant)', padding: '2px 6px', borderRadius: '4px' }}>
                      {log.action}
                    </code>
                    <span style={{ fontSize: '0.75rem', color: 'var(--secondary)' }}>
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <div style={{ color: 'var(--secondary)', fontSize: '0.75rem' }}>
                    Actor: <strong>{log.actorEmail || 'System'}</strong>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: 'var(--secondary)', fontSize: '0.875rem', padding: '30px 0', textAlign: 'center' }}>
              No administrative activity recorded yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
