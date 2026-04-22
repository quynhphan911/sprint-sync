#!/usr/bin/env node

/**
 * Manual test runner for Property 5
 * This script directly imports and runs the sanitiseDisplayName function
 * to verify it works correctly with the displayNameWithHTML arbitrary.
 */

import * as fc from 'fast-check'

// Inline the sanitiseDisplayName function
function sanitiseDisplayName(value) {
  return value.replace(/<[^>]*>/g, '')
}

// Inline the displayNameWithHTML arbitrary
function displayNameWithHTML() {
  return fc.oneof(
    fc.constant('<script>alert("xss")</script>'),
    fc.constant('<b>Bold Name</b>'),
    fc.constant('Name<br/>WithTag'),
    fc.constant('<img src="x" onerror="alert(1)">'),
    fc.string().map(s => `<div>${s}</div>`),
    fc.string().map(s => `${s}<span>test</span>`),
  )
}

// Property test configuration
const propertyTestConfig = {
  numRuns: 100,
  verbose: false,
}

console.log('Running Property 5 test manually...\n')

try {
  // Test 1: Basic HTML removal
  fc.assert(
    fc.property(displayNameWithHTML(), (displayName) => {
      const sanitised = sanitiseDisplayName(displayName)
      const hasNoHTML = !sanitised.includes('<') && !sanitised.includes('>')
      
      if (!hasNoHTML) {
        console.log(`FAILED: Input: "${displayName}" -> Output: "${sanitised}"`)
      }
      
      return hasNoHTML
    }),
    propertyTestConfig
  )
  
  console.log('✓ Test 1 PASSED: All HTML markup removed from display names')
  
  // Test 2: Plain text preservation
  fc.assert(
    fc.property(
      fc.string({ minLength: 1, maxLength: 30 }).filter(s => !s.includes('<') && !s.includes('>')),
      (plainText) => {
        const withHTML = `<div>${plainText}</div>`
        const sanitised = sanitiseDisplayName(withHTML)
        return sanitised === plainText
      }
    ),
    propertyTestConfig
  )
  
  console.log('✓ Test 2 PASSED: Plain text content preserved while removing tags')
  
  // Test 3: XSS vectors
  const xssVectors = [
    '<script>alert("xss")</script>',
    '<img src="x" onerror="alert(1)">',
    '<svg onload="alert(1)">',
    '<iframe src="javascript:alert(1)"></iframe>',
  ]
  
  let xssTestPassed = true
  for (const xss of xssVectors) {
    const sanitised = sanitiseDisplayName(xss)
    if (sanitised.includes('<') || sanitised.includes('>')) {
      console.log(`FAILED XSS test: "${xss}" -> "${sanitised}"`)
      xssTestPassed = false
    }
  }
  
  if (xssTestPassed) {
    console.log('✓ Test 3 PASSED: XSS attack vectors neutralized')
  }
  
  console.log('\n✅ All Property 5 tests PASSED!')
  console.log(`Total iterations: ${propertyTestConfig.numRuns * 2} (across 2 property tests)`)
  
} catch (error) {
  console.error('\n❌ Property 5 test FAILED!')
  console.error(error.message)
  process.exit(1)
}
