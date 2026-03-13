import { useAuth } from '@/context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Bell, Trash2, CheckCircle, Package, MessageSquare, AlertCircle, Clock, ShoppingBag, Truck, DollarSign } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import BottomNav from '@/components/BottomNav';

const getNotificationIcon = (type: string) => {
  switch (type) {
    case 'item_sold':
      return <DollarSign className="h-5 w-5 text-green-600" />;
    case 'order_shipped':
    case 'order_delivered':
      return <Truck className="h-5 w-5 text-blue-600" />;
    case 'delivery_request':
      return <Clock className="h-5 w-5 text-orange-600" />;
    case 'delivery_approved':
      return <CheckCircle className="h-5 w-5 text-green-600" />;
    case 'delivery_declined':
    case 'delivery_expired':
      return <AlertCircle className="h-5 w-5 text-red-600" />;
    case 'new_message':
      return <MessageSquare className="h-5 w-5 text-blue-600" />;
    case 'new_offer':
      return <ShoppingBag className="h-5 w-5 text-purple-600" />;
    default:
      return <Bell className="h-5 w-5 text-gray-600" />;
  }
};

const getNotificationColor = (type: string) => {
  switch (type) {
    case 'item_sold':
    case 'delivery_approved':
      return 'border-l-green-500 bg-green-50';
    case 'delivery_request':
      return 'border-l-orange-500 bg-orange-50';
    case 'delivery_declined':
    case 'delivery_expired':
      return 'border-l-red-500 bg-red-50';
    case 'new_message':
    case 'order_shipped':
    case 'order_delivered':
      return 'border-l-blue-500 bg-blue-50';
    case 'new_offer':
      return 'border-l-purple-500 bg-purple-50';
    default:
      return 'border-l-gray-500 bg-gray-50';
  }
};

export default function NotificationsPage() {
    const { user } = useAuth();
    const queryClient = useQueryClient();

    const { data: notifications = [], isLoading } = useQuery({
        queryKey: ['notifications'],
        queryFn: async () => {
            const { data, error } = await supabase.functions.invoke('notifications?limit=50', {
                method: 'GET'
            });
            if (error) throw error;
            return data.data;
        },
        enabled: !!user,
    });

    const markAllReadMutation = useMutation({
        mutationFn: async () => {
            const { error } = await supabase.functions.invoke('notifications', {
                method: 'PUT',
                body: { mark_all_read: true }
            });
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
            toast.success('Marked all as read');
        }
    });

    const deleteReadMutation = useMutation({
        mutationFn: async () => {
            const { error } = await supabase.functions.invoke('notifications', {
                method: 'DELETE',
                body: { delete_all_read: true }
            });
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
            toast.success('Deleted read notifications');
        }
    });

    const getIcon = (type: string) => {
        switch (type) {
            case 'order_shipped':
            case 'order_delivered':
            case 'item_sold':
                return <Package className="h-4 w-4 text-green-500" />;
            case 'new_message':
            case 'new_offer':
                return <MessageSquare className="h-4 w-4 text-blue-500" />;
            case 'delivery_request':
                return <AlertCircle className="h-4 w-4 text-purple-500" />;
            default:
                return <Bell className="h-4 w-4 text-primary" />;
        }
    };

    return (
        <div className="min-h-screen bg-background pb-20">
            <header className="sticky top-0 z-40 bg-card border-b border-border px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Link to="/profile">
                        <ArrowLeft className="h-5 w-5 text-foreground" />
                    </Link>
                    <h1 className="text-base font-semibold text-foreground">Notifications</h1>
                </div>

                <div className="flex gap-2">
                    <button
                        onClick={() => markAllReadMutation.mutate()}
                        className="p-1.5 rounded-lg bg-secondary text-foreground hover:bg-muted"
                        title="Mark all as read"
                    >
                        <CheckCircle className="h-4 w-4" />
                    </button>
                    <button
                        onClick={() => deleteReadMutation.mutate()}
                        className="p-1.5 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20"
                        title="Clear all read"
                    >
                        <Trash2 className="h-4 w-4" />
                    </button>
                </div>
            </header>

            <main className="px-4 py-6 space-y-3">
                {isLoading ? (
                    <div className="space-y-3">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="h-20 w-full animate-pulse bg-card rounded-xl border border-border" />
                        ))}
                    </div>
                ) : notifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="h-16 w-16 bg-muted rounded-full flex items-center justify-center mb-4">
                            <Bell className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <h3 className="text-lg font-medium text-foreground">No notifications</h3>
                        <p className="text-sm text-muted-foreground max-w-[200px]">You're all caught up!</p>
                    </div>
                ) : (
                    notifications.map((notif: any) => (
                        <div
                            key={notif.id}
                            className={`p-4 rounded-xl border ${getNotificationColor(notif.type)} transition-opacity ${notif.is_read ? 'opacity-60' : 'opacity-100'}`}
                        >
                            <div className="flex gap-3">
                                <div className="h-10 w-10 shrink-0 rounded-lg bg-white/50 flex items-center justify-center">
                                    {getNotificationIcon(notif.type)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between mb-1">
                                        <h3 className={`text-sm font-semibold truncate ${notif.is_read ? 'text-gray-700' : 'text-gray-900'}`}>
                                            {notif.title}
                                        </h3>
                                        <div className="flex items-center gap-2">
                                            {!notif.is_read && (
                                                <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                                            )}
                                            <span className="text-[10px] text-gray-500 whitespace-nowrap">
                                                {new Date(notif.created_at).toLocaleDateString()}
                                            </span>
                                        </div>
                                    </div>
                                    <p className="text-xs text-gray-600 mb-2">{notif.message}</p>
                                    
                                    {notif.data && Object.keys(notif.data).length > 0 && (
                                        <div className="flex gap-2 flex-wrap">
                                            {notif.data.product_id && (
                                                <Link
                                                    to={`/product/${notif.data.product_id}`}
                                                    className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200 transition-colors"
                                                >
                                                    View Product
                                                </Link>
                                            )}
                                            {notif.data.order_id && (
                                                <Link
                                                    to={`/orders`}
                                                    className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded hover:bg-green-200 transition-colors"
                                                >
                                                    View Order
                                                </Link>
                                            )}
                                            {notif.data.conversation_id && (
                                                <Link
                                                    to={`/inbox`}
                                                    className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded hover:bg-purple-200 transition-colors"
                                                >
                                                    View Message
                                                </Link>
                                            )}
                                            {notif.data.delivery_request_id && (
                                                <Link
                                                    to={`/orders`}
                                                    className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded hover:bg-orange-200 transition-colors"
                                                >
                                                    View Request
                                                </Link>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </main>
            <BottomNav />
        </div>
    );
}
