import { z } from 'zod'

export const registerSchema = z.object({
  pseudo: z.string().min(2).max(30),
  email: z.string().email(),
  password: z.string().min(12),
  confirmPassword: z.string().min(12),
}).refine(({ password, confirmPassword }) => password === confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})

export const loginSchema = z.object({
  login: z.string().min(1),
  password: z.string(),
})

export const updateProfileSchema = z.object({
  pseudo: z.string().min(2).max(30).optional(),
  email: z.string().email().optional(),
}).refine((data) => data.pseudo || data.email, {
  message: 'No fields to update',
  path: [],
})

export const updatePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  password: z.string().min(12, 'Password must be at least 12 characters'),
  confirmPassword: z.string().min(12, 'Password must be at least 12 characters'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})

export const adminUpdateUserSchema = z.object({
  pseudo: z.string().min(2).max(30).optional(),
  email: z.string().email().optional(),
  role: z.enum(['USER', 'QUIZMASTER', 'QUIZADMIN']).optional(),
}).refine((data) => data.pseudo || data.email || data.role, {
  message: 'No fields to update',
  path: [],
})

export const adminResetPasswordSchema = z.object({
  password: z.string().min(12, 'Password must be at least 12 characters'),
  confirmPassword: z.string().min(12, 'Password must be at least 12 characters'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})

export type RegisterInput = z.infer<typeof registerSchema>
export type LoginInput = z.infer<typeof loginSchema>
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>
export type UpdatePasswordInput = z.infer<typeof updatePasswordSchema>
export type AdminUpdateUserInput = z.infer<typeof adminUpdateUserSchema>
export type AdminResetPasswordInput = z.infer<typeof adminResetPasswordSchema>
