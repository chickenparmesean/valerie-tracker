export interface ApiError {
  error: string;
  details?: string;
}

export interface ProjectWithTasks {
  id: string;
  name: string;
  description?: string;
  status: string;
  requireTask: boolean;
  color?: string;
  tasks: TaskSummary[];
}

export interface TaskSummary {
  id: string;
  title: string;
  description?: string;
  status: string;
  sortOrder: number;
}

export interface LiveDashboardEntry {
  userId: string;
  userName: string;
  avatarUrl?: string;
  isTracking: boolean;
  currentProject?: string;
  currentTask?: string;
  elapsedSec?: number;
  activityPct?: number;
  currentApp?: string;
  lastSyncAt?: string;
}

export interface PresignResponse {
  uploadUrl: string;
  storagePath: string;
  publicUrl: string;
}
