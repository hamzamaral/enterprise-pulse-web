import { createFileRoute } from '@tanstack/react-router';
import { MyAssetsPage } from '@/features/assets/my-assets-page';

export const Route = createFileRoute('/_app/assets/my')({
  component: MyAssetsPage,
});
