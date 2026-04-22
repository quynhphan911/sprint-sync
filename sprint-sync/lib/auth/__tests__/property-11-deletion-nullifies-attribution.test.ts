/**
 * Property-Based Test: Property 11 - Account deletion nullifies personal attribution
 *
 * **Validates: Requirements 8.4, 8.5**
 *
 * Property: For any user with any number of authored RetroCards and assigned
 * ActionItems, after that user's account is deleted, all of their RetroCards
 * must have `author_id = null` and all of their ActionItems must have
 * `assignee_id = null`.
 *
 * The cascade behaviour is defined at the database level:
 *   - `retro_cards.author_id`    → ON DELETE SET NULL
 *   - `action_items.assignee_id` → ON DELETE SET NULL
 *
 * This test verifies that `deleteAccount` triggers the cascade correctly by
 * inspecting the DB interactions made through the mocked Supabase client.
 *
 * Tag: Feature: user-account-management, Property 11: Account deletion nullifies personal attribution
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fc from 'fast-check'
import { deleteAccount } from '../service'

// Mock the Supabase server client — must be declared before importing the service
vi.mock('../../supabase/server', () => ({
  createServerClient: vi.fn(),
}))

// ---------------------------------------------------------------------------
// Types
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
// Mock DB state
// ---------------------------------------------------------------------------

/**
 * Builds a self-contained mock Supabase client that:
 *  1. Returns the given user as authenticated via `auth.getUser`.
 *  2. Simulates the `delete_user` RPC call — on success it applies the
 *     ON DELETE SET NULL cascade to the in-memory retro_cards and
 *     action_items arrays.
 *  3. Exposes the in-memory arrays so assertions can inspect the final state.
 */
function buildMockSupabaseClient(
  userId: string,
  retroCards: RetroCard[],
  actionItems: ActionItem[]
) {
  // Simulate the cascade: nullify author_id / assignee_id for the deleted user
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

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: {
            id: userId,
            email: `${userId}@example.com`,
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
    // Expose the in-memory state for assertions
    _retroCards: retroCards,
    _actionItems: actionItems,
  }
}

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/** Generates a UUID-like string (simplified for test purposes). */
const uuidArb = fc.uuid()

/** Generates a RetroCard authored by the given userId. */
const retroCardArb = (userId: string): fc.Arbitrary<RetroCard> =>
  fc.record({
    id: uuidArb,
    board_id: uuidArb,
    author_id: fc.constant(userId),
    category: fc.constantFrom('start' as const, 'stop' as const, 'continue' as const),
    content: fc.string({ minLength: 1, maxLength: 200 }),
    votes: fc.integer({ min: 0, max: 100 }),
  })

/** Generates an ActionItem assigned to the given userId. */
const actionItemArb = (userId: string): fc.Arbitrary<ActionItem> =>
  fc.record({
    id: uuidArb,
    sprint_id: uuidArb,
    assignee_id: fc.constant(userId),
    description: fc.string({ minLength: 1, maxLength: 200 }),
    status: fc.constantFrom('todo' as const, 'in_progress' as const, 'done' as const),
  })

/**
 * Generates a scenario: a userId plus 0–20 RetroCards and 0–20 ActionItems
 * all belonging to that user.
 */
const deletionScenarioArb = uuidArb.chain((userId) =>
  fc.record({
    userId: fc.constant(userId),
    retroCards: fc.array(retroCardArb(userId), { minLength: 0, maxLength: 20 }),
    actionItems: fc.array(actionItemArb(userId), { minLength: 0, maxLength: 20 }),
  })
)

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Property 11: Account deletion nullifies personal attribution', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // -------------------------------------------------------------------------
  // Core property: all RetroCards and ActionItems are nullified after deletion
  // -------------------------------------------------------------------------
  it(
    'after deleteAccount, all RetroCards authored by the user have author_id = null ' +
      'and all ActionItems assigned to the user have assignee_id = null',
    async () => {
      const { createServerClient } = await import('../../supabase/server')
      const mockCreateServerClient = vi.mocked(createServerClient)

      await fc.assert(
        fc.asyncProperty(deletionScenarioArb, async ({ userId, retroCards, actionItems }) => {
          // Build a fresh mock client for each run
          const mockClient = buildMockSupabaseClient(userId, retroCards, actionItems)
          mockCreateServerClient.mockReturnValue(mockClient as any)

          // Act: delete the account
          const result = await deleteAccount(userId)

          // Assert: no error returned
          expect(result).toBeUndefined()

          // Assert: delete_user RPC was called
          expect(mockClient.rpc).toHaveBeenCalledWith('delete_user')

          // Assert: every RetroCard that belonged to the user now has author_id = null
          const userCards = mockClient._retroCards.filter(
            (c) => c.id !== undefined // all cards in the array
          )
          for (const card of userCards) {
            expect(card.author_id).toBeNull()
          }

          // Assert: every ActionItem that belonged to the user now has assignee_id = null
          const userItems = mockClient._actionItems.filter(
            (i) => i.id !== undefined // all items in the array
          )
          for (const item of userItems) {
            expect(item.assignee_id).toBeNull()
          }

          // Property holds: all attributions are nullified
          return (
            userCards.every((c) => c.author_id === null) &&
            userItems.every((i) => i.assignee_id === null)
          )
        }),
        { numRuns: 100, verbose: false }
      )
    }
  )

  // -------------------------------------------------------------------------
  // Edge case: user with zero RetroCards and zero ActionItems
  // -------------------------------------------------------------------------
  it('deleteAccount succeeds for a user with no RetroCards and no ActionItems', async () => {
    const { createServerClient } = await import('../../supabase/server')
    const mockCreateServerClient = vi.mocked(createServerClient)

    await fc.assert(
      fc.asyncProperty(uuidArb, async (userId) => {
        const mockClient = buildMockSupabaseClient(userId, [], [])
        mockCreateServerClient.mockReturnValue(mockClient as any)

        const result = await deleteAccount(userId)

        expect(result).toBeUndefined()
        expect(mockClient.rpc).toHaveBeenCalledWith('delete_user')
        expect(mockClient._retroCards).toHaveLength(0)
        expect(mockClient._actionItems).toHaveLength(0)

        return result === undefined
      }),
      { numRuns: 100, verbose: false }
    )
  })

  // -------------------------------------------------------------------------
  // Edge case: other users' records are NOT affected by the deletion
  // -------------------------------------------------------------------------
  it(
    'deleteAccount does not nullify RetroCards or ActionItems belonging to other users',
    async () => {
      const { createServerClient } = await import('../../supabase/server')
      const mockCreateServerClient = vi.mocked(createServerClient)

      // Generate: a deleted user, a bystander user, and records for both
      const multiUserScenarioArb = fc
        .tuple(uuidArb, uuidArb)
        .filter(([a, b]) => a !== b)
        .chain(([deletedUserId, bystanderUserId]) =>
          fc.record({
            deletedUserId: fc.constant(deletedUserId),
            bystanderUserId: fc.constant(bystanderUserId),
            deletedUserCards: fc.array(retroCardArb(deletedUserId), {
              minLength: 0,
              maxLength: 10,
            }),
            bystanderCards: fc.array(retroCardArb(bystanderUserId), {
              minLength: 1,
              maxLength: 10,
            }),
            deletedUserItems: fc.array(actionItemArb(deletedUserId), {
              minLength: 0,
              maxLength: 10,
            }),
            bystanderItems: fc.array(actionItemArb(bystanderUserId), {
              minLength: 1,
              maxLength: 10,
            }),
          })
        )

      await fc.assert(
        fc.asyncProperty(
          multiUserScenarioArb,
          async ({
            deletedUserId,
            bystanderUserId,
            deletedUserCards,
            bystanderCards,
            deletedUserItems,
            bystanderItems,
          }) => {
            // Combine all records into shared arrays (as they would be in a real DB table)
            const allCards: RetroCard[] = [...deletedUserCards, ...bystanderCards]
            const allItems: ActionItem[] = [...deletedUserItems, ...bystanderItems]

            const mockClient = buildMockSupabaseClient(deletedUserId, allCards, allItems)
            mockCreateServerClient.mockReturnValue(mockClient as any)

            await deleteAccount(deletedUserId)

            // Deleted user's records must be nullified
            const deletedCards = mockClient._retroCards.filter(
              (c) => deletedUserCards.some((dc) => dc.id === c.id)
            )
            for (const card of deletedCards) {
              expect(card.author_id).toBeNull()
            }

            const deletedItems = mockClient._actionItems.filter(
              (i) => deletedUserItems.some((di) => di.id === i.id)
            )
            for (const item of deletedItems) {
              expect(item.assignee_id).toBeNull()
            }

            // Bystander's records must NOT be affected
            const remainingBystanderCards = mockClient._retroCards.filter(
              (c) => bystanderCards.some((bc) => bc.id === c.id)
            )
            for (const card of remainingBystanderCards) {
              expect(card.author_id).toBe(bystanderUserId)
            }

            const remainingBystanderItems = mockClient._actionItems.filter(
              (i) => bystanderItems.some((bi) => bi.id === i.id)
            )
            for (const item of remainingBystanderItems) {
              expect(item.assignee_id).toBe(bystanderUserId)
            }

            return (
              deletedCards.every((c) => c.author_id === null) &&
              deletedItems.every((i) => i.assignee_id === null) &&
              remainingBystanderCards.every((c) => c.author_id === bystanderUserId) &&
              remainingBystanderItems.every((i) => i.assignee_id === bystanderUserId)
            )
          }
        ),
        { numRuns: 100, verbose: false }
      )
    }
  )

  // -------------------------------------------------------------------------
  // Failure case: deleteAccount returns an error when the user is not authenticated
  // -------------------------------------------------------------------------
  it('deleteAccount returns UNAUTHORIZED error when userId does not match authenticated user', async () => {
    const { createServerClient } = await import('../../supabase/server')
    const mockCreateServerClient = vi.mocked(createServerClient)

    const distinctUuidPairArb = fc
      .tuple(uuidArb, uuidArb)
      .filter(([a, b]) => a !== b)

    await fc.assert(
      fc.asyncProperty(distinctUuidPairArb, async ([authenticatedUserId, requestedUserId]) => {
        // The authenticated user is different from the userId passed to deleteAccount
        const mockClient = buildMockSupabaseClient(authenticatedUserId, [], [])
        mockCreateServerClient.mockReturnValue(mockClient as any)

        // Attempt to delete a different user's account
        const result = await deleteAccount(requestedUserId)

        // Should return an UNAUTHORIZED error
        expect(result).toBeDefined()
        expect(result).toHaveProperty('error')
        if (result && 'error' in result) {
          expect(result.error.code).toBe('UNAUTHORIZED')
        }

        // The delete_user RPC must NOT have been called
        expect(mockClient.rpc).not.toHaveBeenCalled()

        return result !== undefined && 'error' in result && result.error.code === 'UNAUTHORIZED'
      }),
      { numRuns: 100, verbose: false }
    )
  })
})
