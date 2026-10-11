import { createFileRoute } from '@tanstack/react-router';
import { Forbidden } from '@/shared/components/route-error';

export const Route = createFileRoute('/_app/forbidden')({
  component: Forbidden,
});
