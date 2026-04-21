/**
 * Shared TypeScript interfaces for Team and Team Member entities.
 *
 * Validates: Requirements 8.1, 8.3
 */

export interface Team {
  id: string
  name: string
  created_at: string
}

export interface TeamMember {
  team_id: string
  user_id: string
  role: 'facilitator' | 'member'
  joined_at: string
}

export interface TeamWithRole extends Team {
  role: 'facilitator' | 'member'
}

export interface CreateTeamInput {
  name: string
}

export interface InviteMemberInput {
  email: string
}

export interface TeamServiceError {
  code: 'NOT_FOUND' | 'ALREADY_MEMBER' | 'FORBIDDEN' | 'VALIDATION' | 'UNKNOWN'
  message: string
}
