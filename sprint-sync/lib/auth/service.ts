/**
 * Auth_Service — server-side authentication and account management layer.
 *
 * All functions are server-side only and use the Supabase server client.
 * Handles registration, login, SSO, profile management, password operations,
 * and account deletion.
 *
 * Validates: Requirements 1.2, 1.4, 1.5, 2.1, 2.2, 3.1, 3.2, 4.5, 5.2, 5.4,
 * 6.2, 6.6, 7.2, 7.6, 8.3, 8.4, 8.5, 9.1, 9.2, 9.5, 9.6
 */

import { createServerClient } from '../supabase/server'
import {
  validateEmail,
  validatePassword,
  validateDisplayName,
  validateAvatarFile,
  sanitiseDisplayName,
} from './validators'
import type {
  AuthResult,
  AuthError,
  Profile,
  ProfileUpdateData,
} from '../../types/auth'

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

/**
 * Register a new user with email and password, creating both a Supabase Auth
 * user and a profiles record in a single operation.
 *
 * Validates: Requirements 1.2, 1.3, 1.4, 1.5
 */
export async function registerWithEmail(
  email: string,
  password: string,
  displayName: string
): Promise<AuthResult> {
  // Validate inputs
  const emailValidation = validateEmail(email)
  if (!emailValidation.valid) {
    return {
      error: {
        code: 'INVALID_EMAIL',
        message: emailValidation.message,
        field: 'email',
      },
    }
  }

  const passwordValidation = validatePassword(password)
  if (!passwordValidation.valid) {
    return {
      error: {
        code: 'WEAK_PASSWORD',
        message: passwordValidation.message,
        field: 'password',
      },
    }
  }

  const displayNameValidation = validateDisplayName(displayName)
  if (!displayNameValidation.valid) {
    return {
      error: {
        code: 'DISPLAY_NAME_INVALID',
        message: displayNameValidation.message,
        field: 'display_name',
      },
    }
  }

  // Sanitise display name before persistence
  const sanitisedDisplayName = sanitiseDisplayName(displayName)

  const supabase = await createServerClient()

  // Create Supabase Auth user
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        display_name: sanitisedDisplayName,
      },
    },
  })

  if (authError) {
    // Map Supabase error to AuthError
    if (authError.message.includes('already registered')) {
      return {
        error: {
          code: 'EMAIL_ALREADY_EXISTS',
          message: 'An account with this email already exists.',
          field: 'email',
        },
      }
    }

    return {
      error: {
        code: 'UNKNOWN',
        message: authError.message || 'Registration failed. Please try again.',
      },
    }
  }

  if (!authData.user || !authData.session) {
    return {
      error: {
        code: 'UNKNOWN',
        message: 'Registration failed. Please try again.',
      },
    }
  }

  // Create profiles record
  const { error: profileError } = await supabase.from('profiles').insert({
    id: authData.user.id,
    display_name: sanitisedDisplayName,
    avatar_url: null,
  })

  if (profileError) {
    // If profile creation fails, we should clean up the auth user
    // However, Supabase doesn't provide a way to delete users from client
    // This should be handled by database triggers or manual cleanup
    return {
      error: {
        code: 'UNKNOWN',
        message: 'Failed to create user profile. Please try again.',
      },
    }
  }

  return {
    user: {
      id: authData.user.id,
      email: authData.user.email!,
    },
    session: authData.session,
  }
}

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------

/**
 * Authenticate a user with email and password via Supabase Auth.
 *
 * Validates: Requirements 2.1, 2.2, 2.4, 2.5
 */
export async function loginWithEmail(
  email: string,
  password: string
): Promise<AuthResult> {
  // Validate inputs
  const emailValidation = validateEmail(email)
  if (!emailValidation.valid) {
    return {
      error: {
        code: 'INVALID_EMAIL',
        message: emailValidation.message,
        field: 'email',
      },
    }
  }

  const passwordValidation = validatePassword(password)
  if (!passwordValidation.valid) {
    return {
      error: {
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password.',
      },
    }
  }

  const supabase = await createServerClient()

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    // Always return generic error for credential failures to prevent enumeration
    return {
      error: {
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password.',
      },
    }
  }

  if (!data.user || !data.session) {
    return {
      error: {
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password.',
      },
    }
  }

  return {
    user: {
      id: data.user.id,
      email: data.user.email!,
    },
    session: data.session,
  }
}

// ---------------------------------------------------------------------------
// Google SSO
// ---------------------------------------------------------------------------

/**
 * Initiate Google OAuth flow, returning the redirect URL.
 *
 * Validates: Requirements 3.1, 3.2
 */
export async function initiateGoogleSSO(): Promise<{ url: string } | { error: AuthError }> {
  const supabase = await createServerClient()

  // Get the base URL for the callback (defaults to localhost in development)
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${baseUrl}/auth/callback`,
    },
  })

  if (error || !data.url) {
    return {
      error: {
        code: 'UNKNOWN',
        message: 'Failed to initiate Google sign-in. Please try again.',
      },
    }
  }

  return { url: data.url }
}

// ---------------------------------------------------------------------------
// Logout
// ---------------------------------------------------------------------------

/**
 * Sign out the current user and clear session cookies.
 *
 * Validates: Requirements 4.5, 4.6
 */
export async function logout(): Promise<void> {
  const supabase = await createServerClient()
  await supabase.auth.signOut()
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

/**
 * Fetch the profiles record for the authenticated user.
 *
 * Validates: Requirements 5.1, 5.8
 */
export async function getProfile(userId: string): Promise<Profile | { error: AuthError }> {
  const supabase = await createServerClient()

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  if (error || !data) {
    return {
      error: {
        code: 'UNKNOWN',
        message: 'Failed to fetch profile. Please try again.',
      },
    }
  }

  return {
    id: data.id,
    display_name: data.display_name,
    avatar_url: data.avatar_url,
    created_at: data.created_at,
  }
}

/**
 * Update the display name and/or avatar URL for the authenticated user.
 * Sanitises display name before persistence.
 *
 * Validates: Requirements 5.2, 5.3, 5.6, 5.7, 9.7
 */
export async function updateProfile(
  userId: string,
  data: ProfileUpdateData
): Promise<Profile | { error: AuthError }> {
  // Validate display name if provided
  if (data.display_name !== undefined) {
    const displayNameValidation = validateDisplayName(data.display_name)
    if (!displayNameValidation.valid) {
      return {
        error: {
          code: 'DISPLAY_NAME_INVALID',
          message: displayNameValidation.message,
          field: 'display_name',
        },
      }
    }
  }

  const supabase = await createServerClient()

  // Prepare update data with sanitised display name
  const updateData: ProfileUpdateData = {}
  if (data.display_name !== undefined) {
    updateData.display_name = sanitiseDisplayName(data.display_name)
  }
  if (data.avatar_url !== undefined) {
    updateData.avatar_url = data.avatar_url
  }

  const { data: updatedProfile, error } = await supabase
    .from('profiles')
    .update(updateData)
    .eq('id', userId)
    .select()
    .single()

  if (error || !updatedProfile) {
    return {
      error: {
        code: 'UNKNOWN',
        message: 'Failed to update profile. Please try again.',
      },
    }
  }

  return {
    id: updatedProfile.id,
    display_name: updatedProfile.display_name,
    avatar_url: updatedProfile.avatar_url,
    created_at: updatedProfile.created_at,
  }
}

/**
 * Upload an avatar file to Supabase Storage and return the public URL.
 *
 * Validates: Requirements 5.4, 5.5, 9.6
 */
export async function uploadAvatar(
  userId: string,
  file: File
): Promise<string | { error: AuthError }> {
  // Validate file
  const fileValidation = validateAvatarFile(file)
  if (!fileValidation.valid) {
    return {
      error: {
        code: 'AVATAR_INVALID_FORMAT',
        message: fileValidation.message,
      },
    }
  }

  const supabase = await createServerClient()

  // Generate unique filename
  const fileExt = file.name.split('.').pop()
  const fileName = `${userId}/${Date.now()}.${fileExt}`

  // Upload to avatars bucket
  const { data, error } = await supabase.storage
    .from('avatars')
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: false,
    })

  if (error) {
    return {
      error: {
        code: 'UNKNOWN',
        message: 'Failed to upload avatar. Please try again.',
      },
    }
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from('avatars')
    .getPublicUrl(data.path)

  return urlData.publicUrl
}

// ---------------------------------------------------------------------------
// Password
// ---------------------------------------------------------------------------

/**
 * Change the user's password after re-authenticating with current password.
 *
 * Validates: Requirements 6.2, 6.3, 6.4, 6.6, 6.7
 */
export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<void | { error: AuthError }> {
  // Validate new password
  const passwordValidation = validatePassword(newPassword)
  if (!passwordValidation.valid) {
    return {
      error: {
        code: 'WEAK_PASSWORD',
        message: passwordValidation.message,
        field: 'new_password',
      },
    }
  }

  const supabase = await createServerClient()

  // Get current user email for re-authentication
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user?.email) {
    return {
      error: {
        code: 'UNAUTHORIZED',
        message: 'User not authenticated.',
      },
    }
  }

  // Re-authenticate with current password
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: userData.user.email,
    password: currentPassword,
  })

  if (signInError) {
    return {
      error: {
        code: 'WRONG_CURRENT_PASSWORD',
        message: 'Current password is incorrect.',
        field: 'current_password',
      },
    }
  }

  // Update password
  const { error: updateError } = await supabase.auth.updateUser({
    password: newPassword,
  })

  if (updateError) {
    return {
      error: {
        code: 'UNKNOWN',
        message: 'Failed to change password. Please try again.',
      },
    }
  }
}

/**
 * Request a password reset email for the given email address.
 *
 * Validates: Requirements 7.2, 7.3, 7.4
 */
export async function requestPasswordReset(email: string): Promise<void | { error: AuthError }> {
  // Validate email
  const emailValidation = validateEmail(email)
  if (!emailValidation.valid) {
    return {
      error: {
        code: 'INVALID_EMAIL',
        message: emailValidation.message,
        field: 'email',
      },
    }
  }

  const supabase = await createServerClient()

  // Get the base URL for the callback (defaults to localhost in development)
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  // Always succeed to prevent email enumeration
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${baseUrl}/auth/confirm`,
  })
}

/**
 * Complete password reset using the reset token and new password.
 *
 * Validates: Requirements 7.6, 7.7, 7.8
 */
export async function completePasswordReset(
  newPassword: string
): Promise<void | { error: AuthError }> {
  // Validate new password
  const passwordValidation = validatePassword(newPassword)
  if (!passwordValidation.valid) {
    return {
      error: {
        code: 'WEAK_PASSWORD',
        message: passwordValidation.message,
        field: 'new_password',
      },
    }
  }

  const supabase = await createServerClient()

  // Update password using the session established by the reset token
  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  })

  if (error) {
    if (error.message.includes('expired') || error.message.includes('invalid')) {
      return {
        error: {
          code: 'RESET_LINK_EXPIRED',
          message: 'Password reset link has expired. Please request a new one.',
        },
      }
    }

    return {
      error: {
        code: 'UNKNOWN',
        message: 'Failed to reset password. Please try again.',
      },
    }
  }
}

// ---------------------------------------------------------------------------
// Account Deletion
// ---------------------------------------------------------------------------

/**
 * Permanently delete the user's Supabase Auth account and profiles record.
 * Cascades to delete the profiles record and nullify author_id and assignee_id
 * on retro_cards and action_items respectively.
 *
 * Validates: Requirements 8.3, 8.4, 8.5, 8.6, 8.7
 */
export async function deleteAccount(userId: string): Promise<void | { error: AuthError }> {
  const supabase = await createServerClient()

  // Verify the user is authenticated
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user || userData.user.id !== userId) {
    return {
      error: {
        code: 'UNAUTHORIZED',
        message: 'User not authenticated.',
      },
    }
  }

  // Delete the Supabase Auth user using the delete_user RPC function
  // This will cascade to delete the profiles record via ON DELETE CASCADE
  // and set author_id and assignee_id to null via ON DELETE SET NULL
  const { error } = await supabase.rpc('delete_user')

  if (error) {
    return {
      error: {
        code: 'UNKNOWN',
        message: 'Failed to delete account. Please try again.',
      },
    }
  }

  // Sign out after deletion
  await supabase.auth.signOut()
}
