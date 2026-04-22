/**
 * Property-Based Test: Property 5 - Display name sanitisation removes all HTML markup
 * 
 * **Validates: Requirements 9.7**
 * 
 * Property: For any display name string containing HTML markup (tags, attributes,
 * or entities), the sanitised value stored in the database must contain no `<` or
 * `>` characters — the stored value must be plain text only.
 * 
 * Tag: Feature: user-account-management, Property 5: Display name sanitisation removes all HTML markup
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { sanitiseDisplayName } from '../validators'
import { propertyTestConfig, displayNameWithHTML } from './fast-check-config'

describe('Property 5: Display name sanitisation removes all HTML markup', () => {
  it('should remove all HTML markup from display names containing tags', () => {
    fc.assert(
      fc.property(displayNameWithHTML(), (displayName) => {
        // Act: Sanitise the display name containing HTML
        const sanitised = sanitiseDisplayName(displayName)

        // Assert: Sanitised output must contain no < or > characters
        expect(sanitised).not.toContain('<')
        expect(sanitised).not.toContain('>')

        // Property holds: all HTML markup is removed (no < or > characters remain)
        return !sanitised.includes('<') && !sanitised.includes('>')
      }),
      propertyTestConfig
    )
  })

  it('should remove all HTML tags regardless of complexity', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          // Simple tags
          fc.constant('<b>Bold</b>'),
          fc.constant('<i>Italic</i>'),
          fc.constant('<span>Text</span>'),
          
          // Self-closing tags
          fc.constant('<br/>'),
          fc.constant('<img/>'),
          fc.constant('<hr />'),
          
          // Tags with attributes
          fc.constant('<div class="test">Content</div>'),
          fc.constant('<a href="http://example.com">Link</a>'),
          fc.constant('<img src="x" onerror="alert(1)">'),
          
          // Nested tags
          fc.constant('<div><span>Nested</span></div>'),
          fc.constant('<p><b>Bold</b> and <i>italic</i></p>'),
          
          // Mixed content
          fc.string().map(s => `Text before <tag>${s}</tag> text after`),
          fc.string().map(s => `<div>${s}</div>`),
        ),
        (displayName) => {
          // Act: Sanitise the display name
          const sanitised = sanitiseDisplayName(displayName)

          // Assert: No < or > characters remain
          expect(sanitised).not.toContain('<')
          expect(sanitised).not.toContain('>')

          // Property holds: all tags are stripped
          return !sanitised.includes('<') && !sanitised.includes('>')
        }
      ),
      propertyTestConfig
    )
  })

  it('should preserve plain text content while removing HTML tags', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 30 }).filter(s => !s.includes('<') && !s.includes('>')),
        (plainText) => {
          // Arrange: Wrap plain text in HTML tags
          const withHTML = `<div>${plainText}</div>`

          // Act: Sanitise
          const sanitised = sanitiseDisplayName(withHTML)

          // Assert: Plain text is preserved, tags are removed
          expect(sanitised).toBe(plainText)
          expect(sanitised).not.toContain('<')
          expect(sanitised).not.toContain('>')

          // Property holds: plain text content is preserved
          return sanitised === plainText
        }
      ),
      propertyTestConfig
    )
  })

  it('should handle multiple HTML tags in a single string', () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ minLength: 1, maxLength: 10 }), { minLength: 2, maxLength: 5 }),
        (textSegments) => {
          // Arrange: Create a string with multiple HTML tags
          const withHTML = textSegments.map(text => `<span>${text}</span>`).join('')

          // Act: Sanitise
          const sanitised = sanitiseDisplayName(withHTML)

          // Assert: All tags removed, no < or > remain
          expect(sanitised).not.toContain('<')
          expect(sanitised).not.toContain('>')

          // Assert: All text segments are preserved (concatenated)
          const expectedText = textSegments.join('')
          expect(sanitised).toBe(expectedText)

          // Property holds: all tags removed, text preserved
          return !sanitised.includes('<') && !sanitised.includes('>')
        }
      ),
      propertyTestConfig
    )
  })

  it('should handle XSS attack vectors by removing all script tags', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant('<script>alert("xss")</script>'),
          fc.constant('<script src="evil.js"></script>'),
          fc.constant('<img src="x" onerror="alert(1)">'),
          fc.constant('<svg onload="alert(1)">'),
          fc.constant('<iframe src="javascript:alert(1)"></iframe>'),
          fc.string().map(s => `<script>${s}</script>`),
        ),
        (xssAttempt) => {
          // Act: Sanitise the XSS attempt
          const sanitised = sanitiseDisplayName(xssAttempt)

          // Assert: All HTML markup is removed
          expect(sanitised).not.toContain('<')
          expect(sanitised).not.toContain('>')
          expect(sanitised).not.toContain('script')
          expect(sanitised).not.toContain('onerror')
          expect(sanitised).not.toContain('onload')

          // Property holds: XSS vectors are neutralized (no < or > remain)
          return !sanitised.includes('<') && !sanitised.includes('>')
        }
      ),
      propertyTestConfig
    )
  })
})
