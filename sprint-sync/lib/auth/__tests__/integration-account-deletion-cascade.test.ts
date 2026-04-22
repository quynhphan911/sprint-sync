/**
 * Integration Test: Account Deletion Cascade
 *
 * Verifies the end-to-end account deletion path through the Route Handler:
 *   - DELETE /api/account/delete deletes the Supabase Auth user (via delete_user RPC)
 *   - The profiles record is deleted via ON DELETE CASCADE (enforced at DB level)
 *   - RetroCard.author_id is set to null via ON DELETE SET NULL (enforced at DB level)
 *   - ActionItem.assignee_id is set to null via ON DELETE SET NULL (enforced at DB level)
 *   - Returns 200 on success
 *   - Returns 401 if not authenticated
 *
 * The cascade behaviour is enforced at the database level (FK constraints).
 * This test verifies that:
 *   1. The Auth_Service calls the correct Supabase admin delete method (delete_user RPC)
 *   2. The DB cascade is modelled correctly — the service calls the right operations
 *   3. The Route Handler returns the correct HTTP status codes
 *
 * Uses mocked Supabase clients — no real network calls are made.
 *
 * Validates: Requirements 8.3, 8.4, 8.5, 8.6, 9.4
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mock Supabase server client BEFORE importing the route handler so that the
// module-level `createServerClient` call inside service.ts is intercepted.
// ---------------------------------------------------------------------------
vi.mock('../../supabase/server', () => ({
  createServerClient: vi.fn(),
}))

import { DELETE } from '../../../app/api/account/delete/route'
import * as supabaseServer from '../../supabase/server'

const mockCreateServerClient = vi.mocked(supabaseServer.createServerClient)

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MOCK_USER_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
const MOCK_EMAIL = 'alice@example.com'

// ---------------------------------------------------------------------------
// In-memory DB state types (mirrors the real DB schema)
// ---------------------------------------------------------------------------

interface RetroCard {
  id: string
  board_id: string
  author_id: string | null
  category: 'start' | 'stop' | 'continue'
  content: string
  votes: number
}

interface ActionItem {
  id: string
  sprint_id: string
  assignee_id: string | null
  description: string
  status: 'todo' | 'in_progress' | 'done'
}

// ---------------------------------------------------------------------------
// Mock client builders
// ---------------------------------------------------------------------------

/**
 * Builds a mock Supabase client that simulates a successful account deletion:
 * - auth.getUser returns the authenticated user
 * - rpc('delete_user') succeeds and applies the ON DELETE SET NULL cascade
 *   to the in-memory retro_cards and action_items arrays
 * - auth.signOut resolves without error
 *
 * Exposes the in-memory arrays so assertions can inspect the final state.
 */
function buildSuccessClient(
  userId: string = MOCK_USER_ID,
  email: string = MOCK_EMAIL,
  retroCards: RetroCard[] = [],
  actionItems: ActionItem[] = []
) {
  // Simulate the DB cascade: nullify author_id / assignee_id for the deleted user
  const applyDeletionCascade = () => {
    for (const card of retroCards) {
      if (card.author_id === userId) {
        card.author_id = null
      }
    }
    for (const item of actionItems) {
      if (item.assignee_id === userId) {
        item.assignee_id = null
      }
    }
  }

  const client = {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: {
            id: userId,
            email,
            aud: 'authenticated',
            role: 'authenticated',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            app_metadata: {},
            user_metadata: {},
          },
        },
        error: null,
      }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
    rpc: vi.fn().mockImplementation((fn: string) => {
      if (fn === 'delete_user') {
        applyDeletionCascade()
        return Promise.resolve({ error: null })
      }
      return Promise.resolve({ error: { message: `Unknown RPC: ${fn}` } })
    }),
    from: vi.fn(),
    storage: { from: vi.fn() },
    // Expose in-memory state for assertions
    _retroCards: retroCards,
    _actionItems: actionItems,
  }

  return client
}

/**
 * Builds a mock Supabase client that simulates an unauthenticated request:
 * - auth.getUser returns null user (no active session)
 */
function buildUnauthenticatedClient() {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: null },
        error: { message: 'Not authenticated', status: 401 },
      }),
      signOut: vi.fn(),
    },
    rpc: vi.fn(),
    from: vi.fn(),
  }
}

/**
 * Builds a mock Supabase client that simulates a delete_user RPC failure:
 * - auth.getUser returns the authenticated user
 * - rpc('delete_user') returns an error
 */
function buildRpcFailureClient(userId: string = MOCK_USER_ID, email: string = MOCK_EMAIL) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: {
            id: userId,
            email,
            aud: 'authenticated',
            role: 'authenticated',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            app_metadata: {},
            user_metadata: {},
          },
        },
        error: null,
      }),
      signOut: vi.fn(),
    },
    rpc: vi.fn().mockResolvedValue({
      error: { message: 'Internal server error', code: '500' },
    }),
    from: vi.fn(),
  }
}

// ---------------------------------------------------------------------------
// Request helper
// ---------------------------------------------------------------------------

function makeDeleteRequest(): Request {
  return new Request('http://localhost/api/account/delete', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Integration: Account Deletion Cascade — DELETE /api/account/delete', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // -------------------------------------------------------------------------
  // Happy path — 200
  // -------------------------------------------------------------------------

  describe('successful account deletion (200)', () => {
    it('returns 200 with a success message when the user is authenticated', async () => {
      const client = buildSuccessClient()
      mockCreateServerClient.mockReturnValue(client as any)

      const request = makeDeleteRequest()
      const response = await DELETE()
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body.data).toBeDefined()
      expect(body.data.message).toBe('Account deleted successfully.')
    })

    it('calls the delete_user RPC to delete the Supabase Auth user', async () => {
      const client = buildSuccessClient()
      mockCreateServerClient.mockReturnValue(client as any)

      await DELETE()

      // The service must call the delete_user RPC — this triggers the DB cascade
      expect(client.rpc).toHaveBeenCalledWith('delete_user')
    })

    it('calls auth.signOut after successful deletion to invalidate the session', async () => {
      const client = buildSuccessClient()
      mockCreateServerClient.mockReturnValue(client as any)

      await DELETE()

      // Requirement 8.6: session must be invalidated after deletion
      expect(client.auth.signOut).toHaveBeenCalled()
    })

    it('verifies auth.getUser is called to confirm the user is authenticated', async () => {
      const client = buildSuccessClient()
      mockCreateServerClient.mockReturnValue(client as any)

      await DELETE()

      expect(client.auth.getUser).toHaveBeenCalled()
    })
  })

  // -------------------------------------------------------------------------
  // DB cascade: profiles deleted, RetroCard.author_id null, ActionItem.assignee_id null
  // -------------------------------------------------------------------------

  describe('database cascade behaviour', () => {
    it('nullifies author_id on RetroCards authored by the deleted user', async () => {
      const retroCards: RetroCard[] = [
        {
          id: 'card-1',
          board_id: 'board-1',
          author_id: MOCK_USER_ID,
          category: 'start',
          content: 'Start doing TDD',
          votes: 3,
        },
        {
          id: 'card-2',
          board_id: 'board-1',
          author_id: MOCK_USER_ID,
          category: 'stop',
          content: 'Stop skipping standups',
          votes: 1,
        },
      ]

      const client = buildSuccessClient(MOCK_USER_ID, MOCK_EMAIL, retroCards, [])
      mockCreateServerClient.mockReturnValue(client as any)

      await DELETE()

      // All RetroCards authored by the deleted user must have author_id = null
      for (const card of client._retroCards) {
        expect(card.author_id).toBeNull()
      }
    })

    it('nullifies assignee_id on ActionItems assigned to the deleted user', async () => {
      const actionItems: ActionItem[] = [
        {
          id: 'item-1',
          sprint_id: 'sprint-1',
          assignee_id: MOCK_USER_ID,
          description: 'Set up CI pipeline',
          status: 'todo',
        },
        {
          id: 'item-2',
          sprint_id: 'sprint-1',
          assignee_id: MOCK_USER_ID,
          description: 'Write unit tests',
          status: 'in_progress',
        },
      ]

      const client = buildSuccessClient(MOCK_USER_ID, MOCK_EMAIL, [], actionItems)
      mockCreateServerClient.mockReturnValue(client as any)

      await DELETE()

      // All ActionItems assigned to the deleted user must have assignee_id = null
      for (const item of client._actionItems) {
        expect(item.assignee_id).toBeNull()
      }
    })

    it('nullifies both author_id and assignee_id when the user has both RetroCards and ActionItems', async () => {
      const retroCards: RetroCard[] = [
        {
          id: 'card-1',
          board_id: 'board-1',
          author_id: MOCK_USER_ID,
          category: 'continue',
          content: 'Keep pair programming',
          votes: 5,
        },
      ]
      const actionItems: ActionItem[] = [
        {
          id: 'item-1',
          sprint_id: 'sprint-1',
          assignee_id: MOCK_USER_ID,
          description: 'Refactor auth module',
          status: 'done',
        },
      ]

      const client = buildSuccessClient(MOCK_USER_ID, MOCK_EMAIL, retroCards, actionItems)
      mockCreateServerClient.mockReturnValue(client as any)

      await DELETE()

      expect(client._retroCards[0].author_id).toBeNull()
      expect(client._actionItems[0].assignee_id).toBeNull()
    })

    it('succeeds for a user with no RetroCards and no ActionItems', async () => {
      const client = buildSuccessClient(MOCK_USER_ID, MOCK_EMAIL, [], [])
      mockCreateServerClient.mockReturnValue(client as any)

      const response = await DELETE()
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body.data.message).toBe('Account deleted successfully.')
      expect(client._retroCards).toHaveLength(0)
      expect(client._actionItems).toHaveLength(0)
    })

    it('does NOT nullify RetroCards or ActionItems belonging to other users', async () => {
      const OTHER_USER_ID = 'bbbbbbbb-cccc-dddd-eeee-ffffffffffff'

      // Mix of cards: some owned by the deleted user, some by another user
      const retroCards: RetroCard[] = [
        {
          id: 'card-deleted',
          board_id: 'board-1',
          author_id: MOCK_USER_ID,
          category: 'start',
          content: 'Deleted user card',
          votes: 2,
        },
        {
          id: 'card-other',
          board_id: 'board-1',
          author_id: OTHER_USER_ID,
          category: 'stop',
          content: 'Other user card',
          votes: 4,
        },
      ]
      const actionItems: ActionItem[] = [
        {
          id: 'item-deleted',
          sprint_id: 'sprint-1',
          assignee_id: MOCK_USER_ID,
          description: 'Deleted user task',
          status: 'todo',
        },
        {
          id: 'item-other',
          sprint_id: 'sprint-1',
          assignee_id: OTHER_USER_ID,
          description: 'Other user task',
          status: 'in_progress',
        },
      ]

      const client = buildSuccessClient(MOCK_USER_ID, MOCK_EMAIL, retroCards, actionItems)
      mockCreateServerClient.mockReturnValue(client as any)

      await DELETE()

      // Deleted user's records must be nullified
      const deletedCard = client._retroCards.find((c) => c.id === 'card-deleted')
      const deletedItem = client._actionItems.find((i) => i.id === 'item-deleted')
      expect(deletedCard?.author_id).toBeNull()
      expect(deletedItem?.assignee_id).toBeNull()

      // Other user's records must NOT be affected
      const otherCard = client._retroCards.find((c) => c.id === 'card-other')
      const otherItem = client._actionItems.find((i) => i.id === 'item-other')
      expect(otherCard?.author_id).toBe(OTHER_USER_ID)
      expect(otherItem?.assignee_id).toBe(OTHER_USER_ID)
    })

    it('preserves RetroCard content after author_id is nullified (content is not deleted)', async () => {
      const cardContent = 'This valuable feedback should be preserved'
      const retroCards: RetroCard[] = [
        {
          id: 'card-1',
          board_id: 'board-1',
          author_id: MOCK_USER_ID,
          category: 'start',
          content: cardContent,
          votes: 7,
        },
      ]

      const client = buildSuccessClient(MOCK_USER_ID, MOCK_EMAIL, retroCards, [])
      mockCreateServerClient.mockReturnValue(client as any)

      await DELETE()

      // Requirement 8.4: card content must be preserved, only attribution removed
      const card = client._retroCards[0]
      expect(card.author_id).toBeNull()
      expect(card.content).toBe(cardContent)
      expect(card.votes).toBe(7)
    })

    it('preserves ActionItem description after assignee_id is nullified (task record is not deleted)', async () => {
      const taskDescription = 'This important task should be preserved'
      const actionItems: ActionItem[] = [
        {
          id: 'item-1',
          sprint_id: 'sprint-1',
          assignee_id: MOCK_USER_ID,
          description: taskDescription,
          status: 'in_progress',
        },
      ]

      const client = buildSuccessClient(MOCK_USER_ID, MOCK_EMAIL, [], actionItems)
      mockCreateServerClient.mockReturnValue(client as any)

      await DELETE()

      // Requirement 8.5: task record must be preserved, only attribution removed
      const item = client._actionItems[0]
      expect(item.assignee_id).toBeNull()
      expect(item.description).toBe(taskDescription)
      expect(item.status).toBe('in_progress')
    })
  })

  // -------------------------------------------------------------------------
  // Unauthenticated — 401
  // -------------------------------------------------------------------------

  describe('unauthenticated request (401)', () => {
    it('returns 401 when there is no active session', async () => {
      const client = buildUnauthenticatedClient()
      mockCreateServerClient.mockReturnValue(client as any)

      const response = await DELETE()
      const body = await response.json()

      expect(response.status).toBe(401)
      expect(body.error).toBeDefined()
      expect(body.error.code).toBe('UNAUTHORIZED')
    })

    it('returns the correct error message when unauthenticated', async () => {
      const client = buildUnauthenticatedClient()
      mockCreateServerClient.mockReturnValue(client as any)

      const response = await DELETE()
      const body = await response.json()

      expect(response.status).toBe(401)
      expect(body.error.message).toBe('Authentication required.')
    })

    it('does NOT call the delete_user RPC when unauthenticated', async () => {
      const client = buildUnauthenticatedClient()
      mockCreateServerClient.mockReturnValue(client as any)

      await DELETE()

      // Requirement 9.4: protected mutations must not proceed without auth
      expect(client.rpc).not.toHaveBeenCalled()
    })

    it('does NOT call auth.signOut when unauthenticated', async () => {
      const client = buildUnauthenticatedClient()
      mockCreateServerClient.mockReturnValue(client as any)

      await DELETE()

      expect(client.auth.signOut).not.toHaveBeenCalled()
    })
  })

  // -------------------------------------------------------------------------
  // RPC failure — 500
  // -------------------------------------------------------------------------

  describe('delete_user RPC failure (500)', () => {
    it('returns 500 when the delete_user RPC fails', async () => {
      const client = buildRpcFailureClient()
      mockCreateServerClient.mockReturnValue(client as any)

      const response = await DELETE()
      const body = await response.json()

      expect(response.status).toBe(500)
      expect(body.error).toBeDefined()
      expect(body.error.code).toBe('UNKNOWN')
    })

    it('does NOT call auth.signOut when the delete_user RPC fails', async () => {
      const client = buildRpcFailureClient()
      mockCreateServerClient.mockReturnValue(client as any)

      await DELETE()

      // signOut must only be called after a successful deletion
      expect(client.auth.signOut).not.toHaveBeenCalled()
    })
  })

  // -------------------------------------------------------------------------
  // Operation ordering
  // -------------------------------------------------------------------------

  describe('operation ordering', () => {
    it('verifies authentication before attempting deletion', async () => {
      const client = buildSuccessClient()
      mockCreateServerClient.mockReturnValue(client as any)

      await DELETE()

      // auth.getUser must be called before rpc('delete_user')
      const getUserCallOrder = client.auth.getUser.mock.invocationCallOrder[0]
      const rpcCallOrder = client.rpc.mock.invocationCallOrder[0]
      expect(getUserCallOrder).toBeLessThan(rpcCallOrder)
    })

    it('calls delete_user RPC before signing out', async () => {
      const client = buildSuccessClient()
      mockCreateServerClient.mockReturnValue(client as any)

      await DELETE()

      // delete_user RPC must be called before signOut
      const rpcCallOrder = client.rpc.mock.invocationCallOrder[0]
      const signOutCallOrder = client.auth.signOut.mock.invocationCallOrder[0]
      expect(rpcCallOrder).toBeLessThan(signOutCallOrder)
    })
  })
})
