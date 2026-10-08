'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { fetchAdminAuditLogs, AdminAuditItem } from '@/lib/admin';

export default function AdminAuditPage() {
  const { getToken } = useAuth();
  const [logs, setLogs] = useState<AdminAuditItem[]>([]);
  const [totalUnfiltered, setTotalUnfiltered] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');

  const loadLogs = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');

      const res = await fetchAdminAuditLogs(token, {
        search: search || undefined,
        action: actionFilter || undefined,
        limit: 50,
      });

      if (res && res.logs) {
        setLogs(res.logs);
        setTotalUnfiltered(res.totalUnfiltered ?? res.pagination?.total ?? 0);
      } else {
        throw new Error((res as any)?.error || 'Failed to fetch audit logs');
      }
    } catch (err: any) {
      setError(err?.message || 'Error communicating with Audit API');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [actionFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadLogs();
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0 }}>Security & Audit Trail</h1>
          <p style={{ fontSize: '0.8125rem', color: 'var(--secondary)', margin: '4px 0 0 0' }}>
            Append-only, immutable record of all administrative operations, security events, and role updates.
          </p>
        </div>

        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '10px' }}>
          <input
            type="text"
            className="admin-input"
            placeholder="Search actor or action..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: '220px' }}
          />
          <button type="submit" className="admin-btn admin-btn-outline">
            Search
          </button>
        </form>
      </div>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <select
          className="admin-input"
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
        >
          <option value="">All Actions</option>
          <option value="USER_SUSPEND">USER_SUSPEND</option>
          <option value="USER_REACTIVATE">USER_REACTIVATE</option>
          <option value="ROLE_CHANGE">ROLE_CHANGE</option>
          <option value="FEATURE_FLAG_TOGGLE">FEATURE_FLAG_TOGGLE</option>
          <option value="AI_KILL_SWITCH_ALL">AI_KILL_SWITCH_ALL</option>
          <option value="AI_RESTORE_ALL">AI_RESTORE_ALL</option>
          <option value="DIAGNOSTIC_PROBE_RUN">DIAGNOSTIC_PROBE_RUN</option>
          <option value="AUTH_LOGIN">AUTH_LOGIN</option>
          <option value="ADMIN_ACCESS">ADMIN_ACCESS</option>
        </select>

        <button onClick={loadLogs} className="admin-btn admin-btn-outline" style={{ marginLeft: 'auto' }}>
          🔄 Refresh
        </button>
      </div>

      {error && (
        <div className="admin-alert-banner admin-alert-critical" style={{ marginBottom: '20px' }}>
          <span>⚠️</span>
          <div>{error}</div>
        </div>
      )}

      <div className="admin-card" style={{ padding: 0 }}>
        <div className="admin-table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Action</th>
                <th>Actor</th>
                <th>Target ID</th>
                <th>Status</th>
                <th>IP Address</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--secondary)' }}>
                    Loading audit trail...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--secondary)' }}>
                    {totalUnfiltered === 0 && !search && !actionFilter
                      ? 'No administrative activity recorded yet.'
                      : 'No audit records match the current filters.'}
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id}>
                    <td style={{ fontSize: '0.75rem', color: 'var(--secondary)', whiteSpace: 'nowrap' }}>
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td>
                      <code style={{ fontWeight: 600, color: 'var(--primary-dark)', background: 'var(--surface-variant)', padding: '2px 6px', borderRadius: '4px' }}>
                        {log.action}
                      </code>
                    </td>
                    <td>
                      <strong>{log.actorEmail || log.actorId}</strong>
                    </td>
                    <td style={{ fontSize: '0.75rem', color: 'var(--secondary)' }}>
                      {log.targetId || log.resourceId || '—'}
                    </td>
                    <td>
                      <span className={log.status?.toUpperCase() === 'SUCCESS' ? 'badge-status-active' : 'badge-status-suspended'}>
                        {log.status}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.75rem', color: 'var(--secondary)' }}>
                      {log.ipAddress || 'Internal'}
                    </td>
                    <td style={{ fontSize: '0.75rem' }}>
                      {log.details ? (
                        <pre style={{ margin: 0, maxHeight: '60px', overflowY: 'auto', background: 'var(--surface-variant)', padding: '4px', borderRadius: '4px' }}>
                          {JSON.stringify(log.details)}
                        </pre>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
