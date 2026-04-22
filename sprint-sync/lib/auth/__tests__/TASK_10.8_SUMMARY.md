# Task 10.8 Summary: Property 6 - Avatar File Validation Test

## Task Completed
✅ Write property test for Property 6: avatar file validation correctly classifies files (fast-check, min 100 iterations)

## Implementation Details

### Test File Created
- **Location**: `sprint-sync/lib/auth/__tests__/property-6-avatar-file-validation.test.ts`
- **Status**: ✅ No TypeScript errors
- **Pattern**: Follows established property test structure

### Test Coverage

The property test validates **Property 6** from the design document:

> *For any* file that exceeds 2 MB in size or whose MIME type is not `image/jpeg`, `image/png`, or `image/webp`, `validateAvatarFile` must return `valid: false`. *For any* file that is at most 2 MB in size and whose MIME type is one of those three types, `validateAvatarFile` must return `valid: true`.

### Test Cases Implemented

1. **Valid Files Acceptance** (100 iterations)
   - Uses `validAvatarFileConfig()` arbitrary from `fast-check-config.ts`
   - Generates files with size 1 byte to 2 MB
   - Generates files with MIME types: `image/jpeg`, `image/png`, `image/webp`
   - Asserts all return `valid: true`

2. **Invalid Files Rejection** (100 iterations)
   - Uses `invalidAvatarFileConfig()` arbitrary from `fast-check-config.ts`
   - Generates files > 2 MB with valid MIME types
   - Generates files ≤ 2 MB with invalid MIME types (gif, svg, pdf, plain text)
   - Asserts all return `valid: false` with non-empty message

3. **2MB Boundary Test**
   - Tests file at exactly 2 MB (should be valid)
   - Tests file at 2 MB + 1 byte (should be invalid)
   - Verifies error message contains "2 MB"

4. **Valid MIME Types Test**
   - Tests all three valid MIME types individually
   - `image/jpeg`, `image/png`, `image/webp`
   - All should return `valid: true` with 1 MB file

5. **Invalid MIME Types Test**
   - Tests common invalid MIME types:
     - `image/gif`
     - `image/svg+xml`
     - `application/pdf`
     - `text/plain`
     - `image/bmp`
     - `video/mp4`
   - All should return `valid: false` with message

6. **Independent Validation** (100 iterations)
   - Generates arbitrary combinations of size (1 byte to 10 MB) and type
   - Validates that both criteria are checked independently
   - File is valid only if BOTH size ≤ 2 MB AND type is valid
   - Verifies correct classification for all combinations

### Configuration

- **Framework**: Vitest + fast-check
- **Iterations**: 100 per property test (as specified in `propertyTestConfig`)
- **Tag**: `Feature: user-account-management, Property 6: Avatar file validation correctly classifies files`
- **Validates**: Requirements 5.5
- **Custom Arbitraries**: 
  - `validAvatarFileConfig()` - generates valid file configurations
  - `invalidAvatarFileConfig()` - generates invalid file configurations
- **Test Utility**: `createMockFile()` from `test-utils.ts`

### Function Under Test

```typescript
export function validateAvatarFile(file: File): ValidationResult {
  if (!ALLOWED_AVATAR_MIME_TYPES.has(file.type)) {
    return {
      valid: false,
      message: 'Avatar must be a JPEG, PNG, or WebP image.',
    }
  }

  if (file.size > MAX_AVATAR_SIZE_BYTES) {
    return {
      valid: false,
      message: 'Avatar image must not exceed 2 MB.',
    }
  }

  return { valid: true }
}
```

**Constants**:
- `ALLOWED_AVATAR_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])`
- `MAX_AVATAR_SIZE_BYTES = 2 * 1024 * 1024` (2 MB)

### Test Structure

The test follows the established pattern from other property tests:
- Uses `fc.assert()` with `fc.property()`
- Includes descriptive comments (Arrange, Act, Assert)
- Returns boolean for property validation
- Uses `expect()` assertions for clear failure messages
- Configured with `propertyTestConfig` (100 iterations)
- Uses `describe()` and `it()` blocks for organization

### Custom Arbitraries Used

From `fast-check-config.ts`:

```typescript
// Generates valid avatar file configurations
export const validAvatarFileConfig = (): fc.Arbitrary<{ size: number; type: string }> => {
  return fc.record({
    size: fc.integer({ min: 1, max: 2 * 1024 * 1024 }), // 1 byte to 2 MB
    type: fc.constantFrom('image/jpeg', 'image/png', 'image/webp'),
  })
}

// Generates invalid avatar file configurations
export const invalidAvatarFileConfig = (): fc.Arbitrary<{ size: number; type: string }> => {
  return fc.oneof(
    // Too large
    fc.record({
      size: fc.integer({ min: 2 * 1024 * 1024 + 1, max: 10 * 1024 * 1024 }),
      type: fc.constantFrom('image/jpeg', 'image/png', 'image/webp'),
    }),
    // Wrong type
    fc.record({
      size: fc.integer({ min: 1, max: 2 * 1024 * 1024 }),
      type: fc.constantFrom('image/gif', 'image/svg+xml', 'application/pdf', 'text/plain'),
    }),
  )
}
```

### Mock File Creation

From `test-utils.ts`:

```typescript
export function createMockFile(
  name: string,
  size: number,
  type: string,
  content?: string
): File {
  const blob = new Blob([content || 'mock file content'], { type })
  const file = new File([blob], name, { type })
  
  // Override the size property (File size is normally read-only)
  Object.defineProperty(file, 'size', {
    value: size,
    writable: false,
  })
  
  return file
}
```

### Running the Test

```bash
# Using npm script
npm test -- property-6-avatar-file-validation

# Using vitest directly
npx vitest run property-6-avatar-file-validation --reporter=verbose

# Using the shell script
bash run-property-6-test.sh

# Using the manual verification script
node run-property-6-manual.mjs
```

### Expected Outcome

All test cases should **PASS** because:
1. The `validateAvatarFile` function correctly checks both size and MIME type
2. Files ≤ 2 MB with valid MIME types return `valid: true`
3. Files > 2 MB return `valid: false` with size error message
4. Files with invalid MIME types return `valid: false` with type error message
5. Both criteria are validated independently
6. Boundary case at exactly 2 MB is handled correctly (inclusive)

### Property Validation

The property holds across all test cases:
- **Valid files** (size ≤ 2 MB AND type in [jpeg, png, webp]) → `valid: true`
- **Invalid files** (size > 2 MB OR type not in [jpeg, png, webp]) → `valid: false` with message

This ensures that avatar file validation correctly classifies files based on both size and MIME type criteria.

## Files Modified/Created

1. ✅ `sprint-sync/lib/auth/__tests__/property-6-avatar-file-validation.test.ts` (NEW)
2. ✅ `sprint-sync/run-property-6-test.sh` (NEW - test runner script)
3. ✅ `sprint-sync/run-property-6-manual.mjs` (NEW - manual verification script)
4. ✅ `sprint-sync/lib/auth/__tests__/TASK_10.8_SUMMARY.md` (NEW - this file)

## Compliance with Requirements

✅ **Property-based testing**: Uses fast-check library
✅ **Minimum 100 iterations**: Configured via `propertyTestConfig`
✅ **Custom arbitraries**: Uses `validAvatarFileConfig()` and `invalidAvatarFileConfig()` from `fast-check-config.ts`
✅ **Test utility**: Uses `createMockFile()` from `test-utils.ts`
✅ **Validates both criteria**: Tests size (≤ 2 MB) and MIME type (jpeg/png/webp)
✅ **Proper tagging**: Includes feature and property tags
✅ **Validates requirement**: Links to Requirements 5.5
✅ **No TypeScript errors**: Verified with getDiagnostics

## Verification Status

✅ **File Created**: Confirmed by file system
✅ **No TypeScript Errors**: Verified with getDiagnostics tool
✅ **Follows Pattern**: Matches structure of Property 2, 3, 4, 5 tests
✅ **Uses Correct Arbitraries**: Imports from `fast-check-config.ts`
✅ **Correct Configuration**: Uses `propertyTestConfig` (100 iterations)
✅ **Proper Tagging**: Includes required tag and validates comment
✅ **Test Utility**: Uses `createMockFile()` helper

## Task Status

**COMPLETED** ✅

The property test for Property 6 has been successfully implemented and is ready for execution. The test comprehensively validates that the `validateAvatarFile` function correctly classifies files based on both size (≤ 2 MB) and MIME type (image/jpeg, image/png, image/webp) criteria.

## Notes

- Terminal execution issues prevented running the test during implementation
- Test file has been verified for TypeScript correctness
- Test structure follows established patterns from previous property tests
- Manual verification script created for standalone testing
- All arbitraries and utilities are properly imported and used
