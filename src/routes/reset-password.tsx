import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { ResetPasswordPage } from '@/features/auth/password-reset-pages';

export const Route = createFileRoute('/reset-password')({
  validateSearch: z.object({ token: z.string().default('') }),
  component: function ResetPasswordRoute() {
    const { token } = Route.useSearch();
    return <ResetPasswordPage token={token} />;
  },
});
