import { z } from 'zod'

/**
 * Mirrors the API's Identity password policy. Custom messages are i18n keys — render
 * them with t(); the rest come translated from the global zod error map.
 */
export const passwordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: z
      .string()
      .min(12)
      .regex(/[A-Z]/, 'common:validation.passwordUpper')
      .regex(/[a-z]/, 'common:validation.passwordLower')
      .regex(/[0-9]/, 'common:validation.passwordDigit')
      .regex(/[^a-zA-Z0-9]/, 'common:validation.passwordSpecial'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'common:validation.passwordsMismatch',
    path: ['confirmPassword'],
  })

export type PasswordForm = z.infer<typeof passwordSchema>
