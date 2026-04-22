/**
 * Manual verification script for Property 4
 * This script manually tests the commutativity property
 */

import { validatePasswordsMatch } from './lib/auth/validators'

// Test cases: pairs of distinct strings
const testCases: [string, string][] = [
  ['password123', 'password456'],
  ['abc', 'def'],
  ['', 'nonempty'],
  ['Test123', 'test123'],
  ['a', 'b'],
  ['longpassword', 'short'],
  ['P@ssw0rd!', 'P@ssw0rd'],
]

console.log('Testing Property 4: Passwords-match validation is commutative in failure\n')

let allPassed = true

for (const [a, b] of testCases) {
  const resultAB = validatePasswordsMatch(a, b)
  const resultBA = validatePasswordsMatch(b, a)

  const passed = !resultAB.valid && !resultBA.valid

  console.log(`Test: ("${a}", "${b}")`)
  console.log(`  validatePasswordsMatch(a, b): valid=${resultAB.valid}`)
  console.log(`  validatePasswordsMatch(b, a): valid=${resultBA.valid}`)
  console.log(`  Result: ${passed ? '✓ PASS' : '✗ FAIL'}`)
  console.log()

  if (!passed) {
    allPassed = false
  }
}

console.log(`\nOverall: ${allPassed ? '✓ ALL TESTS PASSED' : '✗ SOME TESTS FAILED'}`)
process.exit(allPassed ? 0 : 1)
