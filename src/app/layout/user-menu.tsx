import { Link } from '@tanstack/react-router';
import { LogOut, UserRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLogout, useMe } from '@/features/auth/use-session';
import { initials } from '@/shared/lib/format';
import { Avatar, AvatarFallback } from '@/shared/ui/avatar';
import { Button } from '@/shared/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu';

export function UserMenu() {
  const { t } = useTranslation();
  const { data: me } = useMe();
  const logout = useLogout();
  if (!me) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-9 gap-2 px-2" data-testid="user-menu">
          <Avatar className="size-7">
            <AvatarFallback className="bg-primary/10 text-primary text-xs">
              {initials(me.user.firstName, me.user.lastName)}
            </AvatarFallback>
          </Avatar>
          <span className="hidden text-sm font-medium md:inline">
            {me.user.firstName} {me.user.lastName}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="text-sm font-medium">
            {me.user.firstName} {me.user.lastName}
          </div>
          <div className="text-muted-foreground truncate text-xs">{me.user.email}</div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/profile">
            <UserRound /> {t('nav.profile')}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void logout()}>
          <LogOut /> {t('auth.logout')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
