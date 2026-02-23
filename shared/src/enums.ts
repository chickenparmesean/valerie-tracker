export enum UserRole {
  ADMIN = 'ADMIN',
  CLIENT = 'CLIENT',
  MANAGER = 'MANAGER',
  VA = 'VA',
}

export enum ProjectStatus {
  ACTIVE = 'ACTIVE',
  ARCHIVED = 'ARCHIVED',
}

export enum TaskStatus {
  OPEN = 'OPEN',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  ARCHIVED = 'ARCHIVED',
}

export enum TimeEntryStatus {
  RUNNING = 'RUNNING',
  STOPPED = 'STOPPED',
  IDLE_PAUSED = 'IDLE_PAUSED',
  SYNCED = 'SYNCED',
}

export enum MembershipStatus {
  ACTIVE = 'ACTIVE',
  DEACTIVATED = 'DEACTIVATED',
}
