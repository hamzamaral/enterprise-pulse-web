import { createFileRoute } from '@tanstack/react-router';
import { AppLayout } from '@/app/layout/app-layout';
import { ensureSession } from '@/features/auth/session';

/** Pathless layout route: everything below requires an authenticated session. */
export const Route = createFileRoute('/_app')({
  beforeLoad: async ({ context, location }) => {
    const me = await ensureSession(context.queryClient, location.href);
    return { me };
  },
  component: AppLayout,
});
