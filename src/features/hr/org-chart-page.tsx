import { ChevronDown, ChevronRight, Network } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useEmployeesOrgChart } from '@/api/generated/endpoints/employees/employees';
import type { OrgChartNodeDto } from '@/api/generated/model';
import { usePermission } from '@/features/auth/use-session';
import { PageHeader } from '@/shared/components/page-header';
import { initials } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import { Avatar, AvatarFallback } from '@/shared/ui/avatar';
import { Badge } from '@/shared/ui/badge';
import { Card, CardContent } from '@/shared/ui/card';
import { Skeleton } from '@/shared/ui/skeleton';
import { Link } from '@tanstack/react-router';

function countDescendants(node: OrgChartNodeDto): number {
  return node.children.reduce((sum, child) => sum + 1 + countDescendants(child), 0);
}

function OrgNode({ node, depth }: { node: OrgChartNodeDto; depth: number }) {
  const { t } = useTranslation();
  const can = usePermission();
  const [expanded, setExpanded] = useState(depth < 2);
  const [first = '', ...rest] = node.fullName.split(' ');
  const hasChildren = node.children.length > 0;

  const name = can('employees:read') ? (
    <Link
      to="/hr/employees/$id"
      params={{ id: node.id }}
      className="hover:text-primary font-medium hover:underline"
    >
      {node.fullName}
    </Link>
  ) : (
    <span className="font-medium">{node.fullName}</span>
  );

  return (
    <li className="relative">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          disabled={!hasChildren}
          aria-label={node.fullName}
          className={cn(
            'text-muted-foreground hover:bg-muted flex size-6 shrink-0 items-center justify-center rounded',
            !hasChildren && 'invisible',
          )}
        >
          {expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
        </button>
        <Card className="min-w-64 flex-1 py-3 sm:flex-none">
          <CardContent className="flex items-center gap-3 px-4">
            <Avatar className="size-9">
              <AvatarFallback
                className={cn(
                  'text-xs',
                  depth === 0 ? 'bg-primary text-primary-foreground' : 'bg-primary/10 text-primary',
                )}
              >
                {initials(first, rest.at(-1))}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              {name}
              <div className="text-muted-foreground truncate text-xs">
                {[node.positionName, node.departmentName].filter(Boolean).join(' · ') || '—'}
              </div>
            </div>
            {hasChildren && (
              <Badge variant="secondary" className="shrink-0">
                {t('orgChart.reports', { count: countDescendants(node) })}
              </Badge>
            )}
          </CardContent>
        </Card>
      </div>
      {hasChildren && expanded && (
        <ul className="border-border mt-2 ml-3 space-y-2 border-l pl-6">
          {node.children.map((child) => (
            <OrgNode key={child.id} node={child} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}

export function OrgChartPage() {
  const { t } = useTranslation();
  const { data, isLoading } = useEmployeesOrgChart();

  return (
    <>
      <PageHeader title={t('orgChart.title')} description={t('orgChart.subtitle')} />
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-16 w-80" style={{ marginLeft: i * 32 }} />
          ))}
        </div>
      ) : !data?.length ? (
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <Network className="size-4" />
          {t('orgChart.empty')}
        </div>
      ) : (
        <ul className="space-y-2">
          {data.map((node) => (
            <OrgNode key={node.id} node={node} depth={0} />
          ))}
        </ul>
      )}
    </>
  );
}
