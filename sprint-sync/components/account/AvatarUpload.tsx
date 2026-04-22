'use client'

import { useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { validateAvatarFile } from '@/lib/auth/validators'
import { uploadAvatar } from '@/lib/auth/service'

interface AvatarUploadProps {
  userId: string
  currentAvatarUrl: string | null
  displayName: string
}

/**
 * AvatarUpload — Client Component for uploading and previewing a profile avatar.
 *
 * Validates the selected file (format: JPEG/PNG/WebP; size: max 2 MB) using
 * validateAvatarFile before uploading. Shows an immediate preview via
 * URL.createObjectURL(). On successful upload, calls uploadAvatar and updates
 * the displayed avatar_url. Shows a toast notification on success and a
 * descriptive inline error message on validation or upload failure.
 * Disables the file input and shows a spinner while the upload is in progress.
 *
 * Validates: Requirements 5.4, 5.5, 5.6, 10.4
 */
export function AvatarUpload({ userId, currentAvatarUrl, displayName }: AvatarUploadProps) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(currentAvatarUrl)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fileInputId = 'avatar-file-input'
  const errorId = 'avatar-upload-error'

  /** Derive the initials fallback from the display name. */
  const initials = displayName ? displayName.charAt(0).toUpperCase() : '?'

  /** The URL to display — prefer the live preview, then the stored URL. */
  const displayedUrl = previewUrl ?? avatarUrl

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    // Clear previous errors
    setError(null)

    // Client-side validation (Requirement 5.5)
    const validation = validateAvatarFile(file)
    if (!validation.valid) {
      setError(validation.message)
      // Reset the input so the same file can be re-selected after fixing the issue
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    // Show immediate preview (Requirement 5.4)
    const objectUrl = URL.createObjectURL(file)
    setPreviewUrl(objectUrl)

    // Upload the file (Requirement 5.4)
    startTransition(async () => {
      try {
        const result = await uploadAvatar(userId, file)

        if (typeof result === 'object' && 'error' in result) {
          setError(result.error.message)
          // Revert preview on failure
          setPreviewUrl(null)
          URL.revokeObjectURL(objectUrl)
          if (fileInputRef.current) fileInputRef.current.value = ''
          return
        }

        // Success — update the stored avatar URL and show toast (Requirement 5.6)
        setAvatarUrl(result)
        // Keep the preview URL for immediate display; revoke the object URL
        // once the stored URL is set to avoid memory leaks
        URL.revokeObjectURL(objectUrl)
        setPreviewUrl(null)
        toast.success('Profile picture updated successfully.')
      } catch {
        setError('Something went wrong. Please try again.')
        setPreviewUrl(null)
        URL.revokeObjectURL(objectUrl)
        if (fileInputRef.current) fileInputRef.current.value = ''
      }
    })
  }

  return (
    <div className="flex items-center gap-4">
      {/* Avatar preview */}
      {displayedUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={displayedUrl}
          alt={displayName || 'Profile picture'}
          className={`h-16 w-16 rounded-full object-cover ring-2 ring-offset-2 ${
            isPending ? 'opacity-60 ring-gray-300' : 'ring-transparent'
          }`}
        />
      ) : (
        <div
          aria-hidden="true"
          className={`flex h-16 w-16 items-center justify-center rounded-full bg-indigo-100 text-xl font-semibold text-indigo-600 ${
            isPending ? 'opacity-60' : ''
          }`}
        >
          {initials}
        </div>
      )}

      {/* Upload controls */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            id={fileInputId}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={isPending}
            onChange={handleFileChange}
            aria-describedby={error ? errorId : undefined}
            className="sr-only"
          />

          {/* Visible label acting as the upload button (Requirement 10.4) */}
          <label
            htmlFor={fileInputId}
            className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 focus-within:outline-none focus-within:ring-2 focus-within:ring-indigo-500 focus-within:ring-offset-2 ${
              isPending ? 'cursor-not-allowed opacity-50' : ''
            }`}
          >
            {isPending ? (
              <>
                {/* Spinner (Requirement 10.4) */}
                <svg
                  className="h-4 w-4 animate-spin text-gray-500"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Uploading…
              </>
            ) : (
              'Change picture'
            )}
          </label>
        </div>

        <p className="text-xs text-gray-500">JPEG, PNG, or WebP · Max 2 MB</p>

        {/* Inline error message (Requirement 5.5) */}
        {error && (
          <p id={errorId} role="alert" className="text-xs text-red-600">
            {error}
          </p>
        )}
      </div>
    </div>
  )
}
