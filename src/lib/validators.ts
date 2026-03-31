import { z } from 'zod';

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Must contain at least one special character');

const addressSchema = z.object({
  address: z.string().trim().min(1, 'Address is required').max(500),
  town_city: z.string().trim().min(1, 'Town/City is required').max(100),
  postcode: z.string().trim().min(1, 'Postcode is required').max(20),
});

export const registerSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required').max(100),
  lastName: z.string().trim().min(1, 'Last name is required').max(100),
  email: z.string().trim().email('Invalid email address').max(255),
  dateOfBirth: z.string().min(1, 'Date of birth is required'),
  countryCode: z.string().min(1, 'Country code is required'),
  phoneNumber: z.string().min(4, 'Phone number is required').max(20),
  password: passwordSchema,
  confirmPassword: z.string(),
  collectionAddress: addressSchema,
  deliveryAddress: addressSchema,
}).refine(data => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export const loginSchema = z.object({
  email: z.string().trim().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email('Invalid email address'),
});

export const resetPasswordSchema = z.object({
  password: passwordSchema,
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export const updateProfileSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required').max(100),
  lastName: z.string().trim().min(1, 'Last name is required').max(100),
  dateOfBirth: z.string().optional(),
  countryCode: z.string().optional(),
  phoneNumber: z.string().max(20).optional(),
  gender: z.string().optional(),
  username: z.string().trim().max(50).optional(),
  userDescription: z.string().trim().max(500).optional(),
  collectionAddress: addressSchema.optional(),
  deliveryAddress: addressSchema.optional(),
});

export const addressUpdateSchema = z.object({
  type: z.enum(['pickup', 'delivery']),
  address: z.string().trim().min(1, 'Address is required').max(500),
  town_city: z.string().trim().min(1, 'Town/City is required').max(100),
  postcode: z.string().trim().min(1, 'Postcode is required').max(20),
});

export const notificationSettingsSchema = z.object({
  general_notifications: z.boolean(),
  email_notifications: z.boolean(),
  message_notifications: z.boolean(),
  payment_notifications: z.boolean(),
  update_notifications: z.boolean(),
});

export type RegisterFormData = z.infer<typeof registerSchema>;
export type LoginFormData = z.infer<typeof loginSchema>;
export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;
export type UpdateProfileFormData = z.infer<typeof updateProfileSchema>;
export type AddressUpdateFormData = z.infer<typeof addressUpdateSchema>;
export type NotificationSettingsFormData = z.infer<typeof notificationSettingsSchema>;

export function getPasswordStrength(password: string): { score: number; label: string; color: string } {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 2) return { score, label: 'Weak', color: 'bg-destructive' };
  if (score <= 4) return { score, label: 'Medium', color: 'bg-warning' };
  return { score, label: 'Strong', color: 'bg-success' };
}
