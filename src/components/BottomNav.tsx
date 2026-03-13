import { Link, useLocation } from 'react-router-dom';
import { Home, Search, PlusCircle, Heart, User, MessageSquare, Bell } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';

const navItems = [
  { to: '/dashboard', icon: Home, label: 'Home' },
  { to: '/search', icon: Search, label: 'Search' },
  { to: '/sell', icon: PlusCircle, label: 'Sell' },
  { to: '/inbox', icon: MessageSquare, label: 'Inbox' },
  { to: '/notifications', icon: Bell, label: 'Alerts', showBadge: true },
  { to: '/wishlist', icon: Heart, label: 'Wishlist' },
  { to: '/profile', icon: User, label: 'Profile' },
];

export default function BottomNav() {
  const location = useLocation();
  const { user } = useAuth();

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['notifications-unread-count'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('notifications-all?action=unread-count', {
        method: 'GET'
      });
      if (error) throw error;
      return data.data?.unread_count || 0;
    },
    enabled: !!user,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border">
      <div className="flex items-center justify-around h-16">
        {navItems.map(({ to, icon: Icon, label, showBadge }) => {
          const isActive = location.pathname === to;
          return (
            <Link
              key={to}
              to={to}
              className={`flex flex-col items-center gap-0.5 px-3 py-1 transition relative ${isActive ? 'text-primary' : 'text-muted-foreground'
                }`}
            >
              <Icon className={`h-5 w-5 ${to === '/sell' ? 'h-6 w-6' : ''}`} />
              {showBadge && unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center min-w-[16px]">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
