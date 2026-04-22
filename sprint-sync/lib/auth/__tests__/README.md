# Authentication Tests

This directory contains unit tests and property-based tests for the User Account Management feature.

## Test Setup

### Testing Frameworks

- **Vitest** (v2.1.9): Fast unit test framework with TypeScript support
- **fast-check** (v3.23.2): Property-based testing library for generating test cases

### Configuration

- **vitest.config.ts**: Main Vitest configuration at project root
  - Test environment: Node.js
  - Test timeout: 10 seconds
  - Coverage provider: v8
  - Includes: `**/*.test.ts`, `**/*.spec.ts`
  - Excludes: `node_modules`, `.next`

### Test Utilities

#### `test-utils.ts`
Provides mock factories and assertion helpers:
- `createMockAuthResult()`: Creates mock successful authentication results
- `createMockProfile()`: Creates mock user profiles
- `createMockFile()`: Creates mock File objects for avatar upload testing
- `isAuthError()`: Type guard for AuthError results
- `isAuthSuccess()`: Type guard for successful AuthResult

#### `fast-check-config.ts`
Provides custom arbitraries and configuration for property-based tests:
- **Configuration**: `propertyTestConfig` with 100 iterations (per design doc)
- **Email arbitraries**: `validEmail()`, `invalidEmail()`
- **Password arbitraries**: `validPassword()`, `invalidPassword()`
- **Display name arbitraries**: `validDisplayName()`, `invalidDisplayName()`, `displayNameWithHTML()`
- **Avatar file arbitraries**: `validAvatarFileConfig()`, `invalidAvatarFileConfig()`
- **Utility arbitraries**: `distinctStringPair()` for password mismatch testing

## Running Tests

### Run all tests
```bash
npm test
```

### Run tests in watch mode
```bash
npm run test:watch
```

### Run specific test file
```bash
npx vitest run lib/auth/__tests__/validators.test.ts
```

### Run with coverage
```bash
npx vitest run --coverage
```

## Test Structure

Tests are organized by module:

- `validators.test.ts`: Unit tests for validation functions
- `validators.property.test.ts`: Property-based tests for validators (Properties 2, 3, 4, 5, 6)
- `service.test.ts`: Unit tests for Auth_Service functions
- `service.property.test.ts`: Property-based tests for Auth_Service (Properties 1, 7, 8, 9, 10, 11, 12, 13)
- `setup.test.ts`: Verification that test infrastructure is working

## Property-Based Testing

All property tests follow the design document specifications:
- Minimum 100 iterations per test
- Tagged with feature and property number
- Use custom arbitraries from `fast-check-config.ts`

Example:
```typescript
import * as fc from 'fast-check'
import { propertyTestConfig, validEmail, validPassword } from './fast-check-config'

describe('Property 2: Validator rejects all invalid inputs', () => {
  it('should reject invalid emails', () => {
    fc.assert(
      fc.property(invalidEmail(), (email) => {
        const result = validateEmail(email)
        return !result.valid && result.message.length > 0
      }),
      propertyTestConfig
    )
  })
})
```

## Writing New Tests

### Unit Tests
1. Import test utilities: `import { createMockProfile } from './test-utils'`
2. Use descriptive test names that explain what is being tested
3. Test specific examples and important edge cases
4. Use `describe` blocks to group related tests

### Property-Based Tests
1. Import fast-check and config: `import * as fc from 'fast-check'`
2. Import custom arbitraries: `import { validEmail, propertyTestConfig } from './fast-check-config'`
3. Use `fc.assert()` with `fc.property()` to define properties
4. Apply `propertyTestConfig` for consistent iteration count
5. Tag tests with property number from design doc

## Notes

- Tests use Node.js environment (no DOM)
- Supabase client calls should be mocked in unit tests
- Property tests verify universal properties across all inputs
- Both unit and property tests are valuable and complement each other
