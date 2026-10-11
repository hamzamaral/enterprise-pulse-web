import { createFileRoute } from '@tanstack/react-router';
import { AssignmentDocumentPage } from '@/features/assets/assignment-document-page';

/** Hand-over form; the API decides visibility (holder or `assets:read`). */
export const Route = createFileRoute('/_app/assets/assignments/$id')({
  component: function AssignmentDocumentRoute() {
    const { id } = Route.useParams();
    return <AssignmentDocumentPage id={id} />;
  },
});
