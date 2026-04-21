/**
 * Seed script for local development.
 *
 * Populates the database with representative data:
 * - 1 Team ("Esoft Alpha")
 * - 2 Team Members (1 facilitator, 1 member) — requires two existing auth.users rows
 * - 1 Sprint (status 'active')
 * - 1 RetroBoard (status 'collecting')
 * - 2 RetroCards (one 'Start', one 'Stop')
 * - 1 ActionItem (status 'todo')
 *
 * Usage: npm run seed
 *
 * Note: Update FACILITATOR_USER_ID and MEMBER_USER_ID with real auth.users UUIDs
 * from your Supabase project before running.
 *
 * Validates: Requirement 11.3
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Replace these with real auth.users UUIDs from your Supabase project
const FACILITATOR_USER_ID = process.env.SEED_FACILITATOR_USER_ID ?? 'replace-with-real-uuid'
const MEMBER_USER_ID = process.env.SEED_MEMBER_USER_ID ?? 'replace-with-real-uuid-2'

async function main() {
  console.log('🌱 Seeding database...')

  // Clean up existing seed data
  await prisma.actionItem.deleteMany()
  await prisma.retroCard.deleteMany()
  await prisma.retroBoard.deleteMany()
  await prisma.sprintReview.deleteMany()
  await prisma.sprint.deleteMany()
  await prisma.team.deleteMany()

  // Create team
  const team = await prisma.team.create({
    data: {
      name: 'Esoft Alpha',
    },
  })
  console.log(`✅ Created team: ${team.name} (${team.id})`)

  // Insert team_members via raw SQL (managed outside Prisma, references auth.users)
  await prisma.$executeRawUnsafe(`
    INSERT INTO team_members (team_id, user_id, role)
    VALUES
      ('${team.id}', '${FACILITATOR_USER_ID}', 'facilitator'),
      ('${team.id}', '${MEMBER_USER_ID}', 'member')
    ON CONFLICT (team_id, user_id) DO NOTHING
  `)
  console.log('✅ Created team members (facilitator + member)')

  // Create sprint
  const sprint = await prisma.sprint.create({
    data: {
      teamId: team.id,
      sprintNumber: 1,
      goal: 'Deliver the SprintSync MVP infrastructure',
      status: 'active',
      startDate: new Date('2024-01-08'),
      endDate: new Date('2024-01-19'),
    },
  })
  console.log(`✅ Created sprint #${sprint.sprintNumber} (${sprint.id})`)

  // Create retro board
  const retroBoard = await prisma.retroBoard.create({
    data: {
      sprintId: sprint.id,
      status: 'collecting',
    },
  })
  console.log(`✅ Created retro board (${retroBoard.id})`)

  // Create retro cards
  const [card1, card2] = await Promise.all([
    prisma.retroCard.create({
      data: {
        boardId: retroBoard.id,
        authorId: FACILITATOR_USER_ID,
        category: 'Start',
        content: 'Running daily stand-ups with a structured agenda',
        votes: 3,
      },
    }),
    prisma.retroCard.create({
      data: {
        boardId: retroBoard.id,
        authorId: MEMBER_USER_ID,
        category: 'Stop',
        content: 'Skipping sprint planning sessions',
        votes: 5,
      },
    }),
  ])
  console.log(`✅ Created retro cards: "${card1.category}" and "${card2.category}"`)

  // Create action item
  const actionItem = await prisma.actionItem.create({
    data: {
      sprintId: sprint.id,
      assigneeId: FACILITATOR_USER_ID,
      description: 'Set up structured daily stand-up template in SprintSync',
      status: 'todo',
    },
  })
  console.log(`✅ Created action item: "${actionItem.description}"`)

  console.log('\n🎉 Seed complete!')
}

main()
  .catch((error) => {
    console.error('❌ Seed failed:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
