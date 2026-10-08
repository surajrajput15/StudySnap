'use client';

import React, { useEffect, useState } from 'react';
import { useAuth, useUser } from '@clerk/nextjs';
import {
  fetchAdminUsers,
  updateUserSuspension,
  updateUserRole,
  AdminUserItem,
  UserRole,
} from '@/lib/admin';
import { isSuperAdminEmail } from '@/lib/config';

export default function AdminUsersPage() {
  const { getToken } = useAuth();
  const { user: currentUser } = useUser();
  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Selected user for role change modal
  const [roleModalUser, setRoleModalUser] = useState<AdminUserItem | null>(null);
  const [newRole, setNewRole] = useState<UserRole>('USER');
  const [roleUpdating, setRoleUpdating] = useState(false);

  // Selected user for detailed inspector modal/drawer
  const [inspectUser, setInspectUser] = useState<AdminUserItem | null>(null);

  const currentUserEmail =
    currentUser?.primaryEmailAddress?.emailAddress || currentUser?.emailAddresses?.[0]?.emailAddress || '';
  const isSuperAdmin = isSuperAdminEmail(currentUserEmail) || (currentUser?.publicMetadata?.role as string) === 'SUPER_ADMIN';

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');

      const res = await fetchAdminUsers(token, {
        search: search || undefined,
        role: roleFilter || undefined,
        status: statusFilter || undefined,
      });

      if (res && res.users) {
        setUsers(res.users);
      } else {
        throw new Error((res as any)?.error || 'Failed to fetch users');
      }
    } catch (err: any) {
      setError(err?.message || 'Error communicating with Admin API');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, [roleFilter, statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadUsers();
  };

  const handleToggleSuspend = async (user: AdminUserItem) => {
    const isUserSuper = isSuperAdminEmail(user.email) || user.role === 'SUPER_ADMIN';
    const isSelf = user.id === currentUser?.id || (currentUserEmail && user.email.toLowerCase() === currentUserEmail.toLowerCase());

    if (isSelf) {
      alert('Action blocked: You cannot suspend your own admin account.');
      return;
    }

    if (isUserSuper) {
      alert('Action blocked: Super Administrator accounts are protected and cannot be suspended.');
      return;
    }

    const action = user.isSuspended ? 'reactivate' : 'suspend';
    if (!window.confirm(`Are you sure you want to ${action} account "${user.email}"?`)) {
      return;
    }

    try {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      const res = await updateUserSuspension(token, user.id, !user.isSuspended, `Admin ${action} request`);
      if (res.success) {
        setUsers((prev) =>
          prev.map((u) => (u.id === user.id ? { ...u, isSuspended: !user.isSuspended } : u))
        );
        if (inspectUser?.id === user.id) {
          setInspectUser((prev) => (prev ? { ...prev, isSuspended: !user.isSuspended } : null));
        }
      } else {
        alert(res.error || `Failed to ${action} user`);
      }
    } catch (err: any) {
      alert(err.message || 'Error updating status');
    }
  };

  const handleSaveRole = async () => {
    if (!roleModalUser) return;
    try {
      setRoleUpdating(true);
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');

      const res = await updateUserRole(token, roleModalUser.id, newRole, 'Admin role update');
      if (res.success) {
        setUsers((prev) =>
          prev.map((u) => (u.id === roleModalUser.id ? { ...u, role: newRole } : u))
        );
        if (inspectUser?.id === roleModalUser.id) {
          setInspectUser((prev) => (prev ? { ...prev, role: newRole } : null));
        }
        setRoleModalUser(null);
      } else {
        alert(res.error || 'Failed to update role');
      }
    } catch (err: any) {
      alert(err.message || 'Error saving role');
    } finally {
      setRoleUpdating(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0 }}>Platform User Directory</h1>
          <p style={{ fontSize: '0.8125rem', color: 'var(--secondary)', margin: '4px 0 0 0' }}>
            Manage student and administrator accounts, roles, and access statuses.
          </p>
        </div>

        {/* Filter controls */}
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <input
            type="text"
            className="admin-input"
            placeholder="Search email or ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: '220px' }}
          />
          <button type="submit" className="admin-btn admin-btn-outline">
            Search
          </button>
        </form>
      </div>

      {/* Filter Row */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <select
          className="admin-input"
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
        >
          <option value="">All Roles</option>
          <option value="USER">Student (USER)</option>
          <option value="ADMIN">Administrator (ADMIN)</option>
          <option value="SUPER_ADMIN">Super Admin (SUPER_ADMIN)</option>
          <option value="MODERATOR">Moderator</option>
          <option value="SUPPORT">Support</option>
        </select>

        <select
          className="admin-input"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All Statuses</option>
          <option value="active">Active Only</option>
          <option value="suspended">Suspended Only</option>
        </select>

        <button onClick={loadUsers} className="admin-btn admin-btn-outline" style={{ marginLeft: 'auto' }}>
          🔄 Refresh
        </button>
      </div>

      {error && (
        <div className="admin-alert-banner admin-alert-critical" style={{ marginBottom: '20px' }}>
          <span>⚠️</span>
          <div>{error}</div>
        </div>
      )}

      {/* Table */}
      <div className="admin-card" style={{ padding: 0 }}>
        <div className="admin-table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th>User / Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Notes Count</th>
                <th>Joined</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--secondary)' }}>
                    Loading users...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--secondary)' }}>
                    No users found matching the filter criteria.
                  </td>
                </tr>
              ) : (
                users.map((u) => {
                  const isUserSuperAdmin = isSuperAdminEmail(u.email) || u.role === 'SUPER_ADMIN';
                  const isSelf = Boolean(u.id === currentUser?.id || (currentUserEmail && u.email.toLowerCase() === currentUserEmail.toLowerCase()));

                  return (
                    <tr
                      key={u.id}
                      style={{ cursor: 'pointer' }}
                      onClick={(e) => {
                        // Prevent opening inspect modal if clicking action buttons
                        if ((e.target as HTMLElement).closest('button')) return;
                        setInspectUser(u);
                      }}
                    >
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <strong>{u.email}</strong>
                          {isUserSuperAdmin && (
                            <span style={{ fontSize: '0.7rem', color: '#b45309', background: '#fef3c7', padding: '1px 6px', borderRadius: '4px' }}>
                              ★ Super Admin
                            </span>
                          )}
                          {isSelf && (
                            <span style={{ fontSize: '0.7rem', color: '#1d4ed8', background: '#dbeafe', padding: '1px 6px', borderRadius: '4px' }}>
                              (You)
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--secondary)' }}>ID: {u.id}</div>
                      </td>
                      <td>
                        <span
                          className={`badge-role ${
                            u.role === 'SUPER_ADMIN'
                              ? 'badge-role-super'
                              : u.role === 'ADMIN'
                              ? 'badge-role-admin'
                              : 'badge-role-user'
                          }`}
                        >
                          {u.role}
                        </span>
                      </td>
                      <td>
                        <span className={u.isSuspended ? 'badge-status-suspended' : 'badge-status-active'}>
                          {u.isSuspended ? 'Suspended' : 'Active'}
                        </span>
                      </td>
                      <td>{u.notesCount || 0}</td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--secondary)' }}>
                        {new Date(u.createdAt).toLocaleDateString()}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '8px' }}>
                          <button
                            onClick={() => setInspectUser(u)}
                            className="admin-btn admin-btn-outline"
                            style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                          >
                            Inspect
                          </button>

                          {/* Role change button - only super admins can change roles */}
                          {isSuperAdmin && (
                            <button
                              onClick={() => {
                                setRoleModalUser(u);
                                setNewRole(u.role);
                              }}
                              className="admin-btn admin-btn-outline"
                              style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                              disabled={isUserSuperAdmin && u.email.toLowerCase() === 'surajdona2005@gmail.com'}
                              title={u.email.toLowerCase() === 'surajdona2005@gmail.com' ? 'Primary Admin role is locked' : 'Modify role'}
                            >
                              Role
                            </button>
                          )}

                          {/* Suspend/Reactivate Button */}
                          <button
                            onClick={() => handleToggleSuspend(u)}
                            className={`admin-btn ${u.isSuspended ? 'admin-btn-success' : 'admin-btn-danger'}`}
                            style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                            disabled={isUserSuperAdmin || isSelf}
                            title={isSelf ? 'Cannot suspend your own account' : isUserSuperAdmin ? 'Super Admin accounts are protected' : undefined}
                          >
                            {u.isSuspended ? 'Reactivate' : 'Suspend'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Role Change Modal with Impact Warning */}
      {roleModalUser && (
        <div className="admin-modal-backdrop">
          <div className="admin-modal">
            <h2 className="admin-modal-header">Update User Role</h2>
            <p style={{ fontSize: '0.875rem', color: 'var(--secondary)', marginBottom: '16px' }}>
              Assign access privileges for <strong>{roleModalUser.email}</strong> (Current Role: <code>{roleModalUser.role}</code>).
            </p>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '6px' }}>
                Select Role:
              </label>
              <select
                className="admin-input"
                style={{ width: '100%' }}
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as UserRole)}
              >
                <option value="USER">USER (Student)</option>
                <option value="SUPPORT">SUPPORT (Customer Support)</option>
                <option value="ANALYST">ANALYST (Read-Only Telemetry)</option>
                <option value="MODERATOR">MODERATOR (Content Moderation)</option>
                <option value="ADMIN">ADMIN (Platform Administrator)</option>
                <option value="SUPER_ADMIN">SUPER_ADMIN (Full Platform Authority)</option>
              </select>
            </div>

            {/* Permission Impact Guidance */}
            <div style={{ marginBottom: '16px' }}>
              {newRole === 'USER' && (
                <div style={{ background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', padding: '10px', borderRadius: '6px', fontSize: '0.8rem' }}>
                  ⚠️ <strong>Access Impact:</strong> Changing this user to Student (USER) will revoke all access to the Admin Command Center, AI operations, and Audit Trail.
                </div>
              )}
              {newRole === 'SUPER_ADMIN' && (
                <div style={{ background: '#fef3c7', border: '1px solid #fcd34d', color: '#78350f', padding: '10px', borderRadius: '6px', fontSize: '0.8rem' }}>
                  🛡️ <strong>Privilege Elevation:</strong> Super Admin role grants unrestricted platform control including staff role assignments and emergency killswitch execution.
                </div>
              )}
            </div>

            <div className="admin-modal-footer">
              <button
                onClick={() => setRoleModalUser(null)}
                className="admin-btn admin-btn-outline"
                disabled={roleUpdating}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveRole}
                className="admin-btn admin-btn-primary"
                disabled={roleUpdating}
              >
                {roleUpdating ? 'Saving...' : 'Confirm Role Change'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User Detail View Inspector Modal */}
      {inspectUser && (
        <div className="admin-modal-backdrop">
          <div className="admin-modal" style={{ maxWidth: '540px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 className="admin-modal-header" style={{ margin: 0 }}>User Account Inspector</h2>
              <button
                onClick={() => setInspectUser(null)}
                style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: 'var(--secondary)' }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.875rem' }}>
              <div style={{ padding: '12px', background: 'var(--surface-variant)', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--secondary)' }}>Account Email</div>
                <strong style={{ fontSize: '1rem' }}>{inspectUser.email}</strong>
                <div style={{ fontSize: '0.75rem', color: 'var(--secondary)', marginTop: '4px' }}>User ID: {inspectUser.id}</div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ padding: '10px', background: 'var(--surface-variant)', borderRadius: '8px' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--secondary)' }}>Platform Role</div>
                  <strong>{inspectUser.role}</strong>
                </div>
                <div style={{ padding: '10px', background: 'var(--surface-variant)', borderRadius: '8px' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--secondary)' }}>Account Status</div>
                  <strong>{inspectUser.isSuspended ? 'Suspended' : 'Active'}</strong>
                </div>
                <div style={{ padding: '10px', background: 'var(--surface-variant)', borderRadius: '8px' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--secondary)' }}>Notes Created</div>
                  <strong>{inspectUser.notesCount || 0} documents</strong>
                </div>
                <div style={{ padding: '10px', background: 'var(--surface-variant)', borderRadius: '8px' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--secondary)' }}>Joined Date</div>
                  <strong>{new Date(inspectUser.createdAt).toLocaleDateString()}</strong>
                </div>
              </div>

              {/* Strict Privacy Callout */}
              <div style={{ padding: '10px 12px', background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.25)', borderRadius: '6px', fontSize: '0.75rem', color: '#1d4ed8' }}>
                🔒 <strong>Privacy Shield Active:</strong> Private study notes, voice transcripts, and chat logs are strictly encrypted and isolated per user account.
              </div>
            </div>

            <div className="admin-modal-footer">
              <button
                onClick={() => setInspectUser(null)}
                className="admin-btn admin-btn-outline"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
