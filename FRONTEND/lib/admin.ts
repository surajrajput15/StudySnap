import { API, apiFetch } from './config';

export type UserRole = 'USER' | 'ADMIN' | 'SUPER_ADMIN' | 'MODERATOR' | 'SUPPORT' | 'ANALYST';
export type FeatureStatus = 'enabled' | 'maintenance' | 'disabled';

export interface AdminMetrics {
  totalUsers: number;
  studentUsers?: number;
  adminUsers?: number;
  activeUsersToday: number;
  notesCreatedTotal: number;
  aiRequestsTotal: number;
  aiSuccessRate: number | string | null;
  avgLatencyMs: number | null;
}

export interface SystemHealthProbe {
  status: 'healthy' | 'degraded' | 'unavailable' | 'connected' | 'configured' | string;
  latencyMs?: number;
  message?: string;
  lastChecked?: string;
}

export interface AdminOverviewResponse {
  success: boolean;
  environment?: string;
  metrics: AdminMetrics;
  systemHealth: {
    database: SystemHealthProbe;
    groq: SystemHealthProbe;
    aiProvider?: SystemHealthProbe;
    cloudinary: SystemHealthProbe;
    storage?: SystemHealthProbe;
    redis: SystemHealthProbe;
    cache?: SystemHealthProbe;
  };
  actionRequired: Array<{
    id: string;
    level: 'warning' | 'critical' | 'info';
    message: string;
    timestamp: string;
  }>;
  recentAudit: Array<{
    id: string;
    action: string;
    actorEmail: string;
    timestamp: string;
    status: string;
  }>;
}

export interface AdminUserItem {
  id: string;
  email: string;
  name?: string;
  role: UserRole;
  isSuspended: boolean;
  createdAt: string;
  lastLoginAt?: string;
  lastActiveDate?: string;
  streakCount?: number;
  notesCount: number;
}

export interface AdminUsersResponse {
  success: boolean;
  users: AdminUserItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface FeatureFlagState {
  status: FeatureStatus;
  updatedAt: string;
  updatedBy?: string;
  reason?: string;
}

export interface AdminAiFeaturesResponse {
  success: boolean;
  features: Record<string, FeatureFlagState> | Array<{
    key: string;
    name: string;
    status: FeatureStatus;
    description: string;
  }>;
}

export interface AiFeatureAnalyticsItem {
  requests: number;
  errors: number;
  avgLatency: number;
}

export interface AdminAiAnalyticsResponse {
  success: boolean;
  totalRequests: number;
  totalErrors: number;
  successRate: number | null;
  avgLatencyMs: number | null;
  modelUsed: string;
  featureBreakdown: Record<string, AiFeatureAnalyticsItem>;
}

export interface AdminAuditItem {
  id: string;
  actorId: string;
  actorEmail?: string;
  action: string;
  targetId?: string;
  resourceType?: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  status: string;
  ipAddress?: string;
  createdAt: string;
}

export interface AdminAuditLogsResponse {
  success: boolean;
  logs: AdminAuditItem[];
  totalUnfiltered?: number;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface AdminHealthResponse {
  success: boolean;
  status?: string;
  environment?: string;
  health: {
    database: SystemHealthProbe;
    groq: SystemHealthProbe;
    aiProvider?: SystemHealthProbe;
    cloudinary: SystemHealthProbe;
    storage?: SystemHealthProbe;
    redis: SystemHealthProbe;
    cache?: SystemHealthProbe;
    timestamp: string;
  };
  probes?: Record<string, SystemHealthProbe>;
  totalProbeDurationMs?: number;
  timestamp?: string;
}

// Admin API Fetchers

export async function fetchAdminOverview(token: string): Promise<AdminOverviewResponse> {
  return apiFetch<AdminOverviewResponse>(API.admin.overview, { token });
}

export async function fetchAdminUsers(
  token: string,
  params: { page?: number; limit?: number; search?: string; role?: string; status?: string } = {}
): Promise<AdminUsersResponse> {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));
  if (params.search) query.set('search', params.search);
  if (params.role) query.set('role', params.role);
  if (params.status) query.set('status', params.status);

  const url = `${API.admin.users}?${query.toString()}`;
  return apiFetch<AdminUsersResponse>(url, { token });
}

export async function updateUserSuspension(
  token: string,
  userId: string,
  isSuspended: boolean,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  return apiFetch<{ success: boolean; error?: string }>(`${API.admin.users}/${userId}/status`, {
    method: 'PATCH',
    token,
    body: JSON.stringify({ isSuspended, reason }),
  });
}

export async function updateUserRole(
  token: string,
  userId: string,
  role: UserRole,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  return apiFetch<{ success: boolean; error?: string }>(`${API.admin.users}/${userId}/role`, {
    method: 'PATCH',
    token,
    body: JSON.stringify({ role, reason }),
  });
}

export async function fetchAdminAiFeatures(token: string): Promise<AdminAiFeaturesResponse> {
  return apiFetch<AdminAiFeaturesResponse>(API.admin.aiFeatures, { token });
}

export async function fetchAdminAiAnalytics(token: string): Promise<AdminAiAnalyticsResponse> {
  return apiFetch<AdminAiAnalyticsResponse>(API.admin.aiAnalytics, { token });
}

export async function updateAdminAiFeature(
  token: string,
  featureKey: string,
  status: FeatureStatus,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  return apiFetch<{ success: boolean; error?: string }>(API.admin.aiFeatures, {
    method: 'POST',
    token,
    body: JSON.stringify({ featureKey, status, reason }),
  });
}

export async function killAllAiFeatures(
  token: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  return apiFetch<{ success: boolean; message?: string; error?: string }>(API.admin.aiKillAll, {
    method: 'POST',
    token,
  });
}

export async function restoreAllAiFeatures(
  token: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  return apiFetch<{ success: boolean; message?: string; error?: string }>(API.admin.aiRestoreAll, {
    method: 'POST',
    token,
  });
}

export async function fetchAdminAuditLogs(
  token: string,
  params: { page?: number; limit?: number; search?: string; action?: string } = {}
): Promise<AdminAuditLogsResponse> {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));
  if (params.search) query.set('search', params.search);
  if (params.action) query.set('action', params.action);

  const url = `${API.admin.auditLogs}?${query.toString()}`;
  return apiFetch<AdminAuditLogsResponse>(url, { token });
}

export async function fetchAdminHealth(token: string): Promise<AdminHealthResponse> {
  return apiFetch<AdminHealthResponse>(API.admin.health, { token });
}
