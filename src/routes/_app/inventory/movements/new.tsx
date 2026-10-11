import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { StockMovementType } from '@/api/generated/model';
import { requirePermission } from '@/features/auth/session';
import { MovementFormPage } from '@/features/inventory/movement-form-page';

const searchSchema = z.object({
  type: z.nativeEnum(StockMovementType).optional().catch(undefined),
});

export const Route = createFileRoute('/_app/inventory/movements/new')({
  validateSearch: searchSchema,
  beforeLoad: requirePermission('inventory:move'),
  component: function NewMovementRoute() {
    const { type } = Route.useSearch();
    return <MovementFormPage initialType={type} />;
  },
});
