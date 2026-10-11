import { z } from 'zod';

/** Messages are i18n keys; FormMessage translates them. */
export const v = {
  requiredString: () => z.string().trim().min(1, 'validation.required'),
  optionalString: () =>
    z
      .string()
      .trim()
      .transform((value) => value || undefined)
      .optional(),
  email: () => z.string().trim().min(1, 'validation.required').email('validation.email'),
  password: () =>
    z
      .string()
      .min(8, 'validation.passwordRules')
      .regex(/[a-z]/, 'validation.passwordRules')
      .regex(/[A-Z]/, 'validation.passwordRules')
      .regex(/\d/, 'validation.passwordRules'),
  code: () =>
    z
      .string()
      .trim()
      .regex(/^[A-Z0-9-]{2,20}$/, 'validation.code'),
  otp: () => z.string().regex(/^\d{6}$/, 'validation.otp'),
};
