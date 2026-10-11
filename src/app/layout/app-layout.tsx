import { Outlet } from '@tanstack/react-router';
import { NotificationBell } from '@/features/notifications/notification-bell';
import { useNotificationSocket } from '@/features/notifications/use-notification-socket';
import { Separator } from '@/shared/ui/separator';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/shared/ui/sidebar';
import { AppSidebar } from './app-sidebar';
import { LanguageSwitcher, ThemeToggle } from './preferences-menu';
import { UserMenu } from './user-menu';

export function AppLayout() {
  useNotificationSocket();

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="min-w-0">
        <header className="bg-background/80 sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b px-4 backdrop-blur print:hidden">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
          <div className="ml-auto flex items-center gap-1">
            <LanguageSwitcher />
            <ThemeToggle />
            <NotificationBell />
            <Separator orientation="vertical" className="mx-1 data-[orientation=vertical]:h-6" />
            <UserMenu />
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6 lg:p-8 print:p-0">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
