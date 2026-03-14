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

    const { data: notifications = [], isLoading, error: queryError } = useQuery({
        queryKey: ['notifications'],
        queryFn: async () => {
            const { data, error } = await supabase.functions.invoke('notifications-all?action=list&limit=50', {
                method: 'GET'
            });

            if (error) {
                console.error('Function execution error:', error);
                throw error;
            }

            if (data?.success === false) {
                throw new Error(data.message || 'Failed to fetch notifications');
            }

            return data.data || [];
        },
        enabled: !!user,
        retry: 1,
    });

    const markAllReadMutation = useMutation({
        mutationFn: async () => {
            const { error } = await supabase.functions.invoke('notifications-all?action=read', {
                method: 'POST',
                body: { read_all: true }
            });
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
            queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
            toast.success('Marked all as read');
        }
    });

    const deleteReadMutation = useMutation({
        mutationFn: async () => {
            const { error } = await supabase.functions.invoke('notifications-all?action=delete', {
                method: 'POST',
                body: { delete_all_read: true }
            });
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
            toast.success('Deleted read notifications');
        }
    });

    return (
        <div className="min-h-screen bg-background pb-20">
            <header className="sticky top-0 z-40 bg-card border-b border-border px-4 py-3 flex items-center justify-between backdrop-blur-md bg-card/80">
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate(-1)} className="p-1 hover:bg-secondary rounded-full transition-colors">
                        <ArrowLeft className="h-5 w-5 text-foreground" />
                    </button>
                    <h1 className="text-base font-bold text-foreground">Alerts & Updates</h1>
                </div>

                <div className="flex gap-2">
                    <button
                        onClick={() => markAllReadMutation.mutate()}
                        className="p-2 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                        title="Mark all as read"
                    >
                        <CheckCircle className="h-4 w-4" />
                    </button>
                    <button
                        onClick={() => deleteReadMutation.mutate()}
                        className="p-2 rounded-xl bg-red-100 text-red-600 hover:bg-red-200 transition-colors"
                        title="Clear all read"
                    >
                        <Trash2 className="h-4 w-4" />
                    </button>
                </div>
            </header>

            <main className="px-4 py-6">
                {isLoading ? (
                    <div className="space-y-4">
                        {[1, 2, 3, 4, 5].map(i => (
                            <div key={i} className="h-24 w-full animate-pulse bg-muted/50 rounded-2xl border border-border" />
                        ))}
                    </div>
                ) : queryError ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="h-16 w-16 bg-red-50 rounded-full flex items-center justify-center mb-4">
                            <AlertCircle className="h-8 w-8 text-red-500" />
                        </div>
                        <h3 className="text-lg font-semibold text-foreground">Failed to load alerts</h3>
                        <p className="text-sm text-muted-foreground mt-1 px-10">
                            {(queryError as any).message?.includes('JWT')
                                ? 'Your session may have expired. Please try logging in again.'
                                : 'There was an error connecting to the notification service.'}
                        </p>
                        <button
                            onClick={() => queryClient.invalidateQueries({ queryKey: ['notifications'] })}
                            className="mt-6 px-6 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-bold shadow-lg shadow-primary/20"
                        >
                            Try Again
                        </button>
                    </div>
                ) : notifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="h-20 w-20 bg-muted rounded-full flex items-center justify-center mb-6">
                            <Bell className="h-10 w-10 text-muted-foreground" />
                        </div>
                        <h3 className="text-xl font-bold text-foreground">All Caught Up!</h3>
                        <p className="text-sm text-muted-foreground max-w-[200px] mt-2">
                            You have no new alerts or notifications at this time.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {notifications.map((notif: any) => (
                            <div
                                key={notif.id}
                                className={`p-4 rounded-2xl border-l-4 border ${getNotificationColor(notif.type)} transition-all duration-300 ${notif.is_read ? 'opacity-70 grayscale-[0.3]' : 'shadow-md shadow-black/5 ring-1 ring-black/[0.02]'}`}
                            >
                                <div className="flex gap-4">
                                    <div className="h-12 w-12 shrink-0 rounded-2xl bg-white/70 shadow-sm flex items-center justify-center">
                                        {getNotificationIcon(notif.type)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between mb-1.5">
                                            <h3 className={`text-sm font-bold truncate ${notif.is_read ? 'text-gray-600' : 'text-gray-900'}`}>
                                                {notif.title}
                                            </h3>
                                            <div className="flex items-center gap-2">
                                                {!notif.is_read && (
                                                    <span className="flex h-2 w-2 rounded-full bg-blue-600 animate-pulse"></span>
                                                )}
                                                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-tighter">
                                                    {new Date(notif.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                                </span>
                                            </div>
                                        </div>
                                        <p className="text-xs text-gray-600 leading-relaxed mb-3">
                                            {notif.message}
                                        </p>

                                        {notif.data && Object.keys(notif.data).length > 0 && (
                                            <div className="flex gap-2 flex-wrap mt-1">
                                                {notif.data.product_id && (
                                                    <Link
                                                        to={`/product/${notif.data.product_id}`}
                                                        className="text-[10px] font-bold uppercase tracking-wider bg-white/80 border border-black/5 text-blue-700 px-3 py-1.5 rounded-lg hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                                                    >
                                                        Item Details
                                                    </Link>
                                                )}
                                                {notif.data.order_id && (
                                                    <Link
                                                        to={`/orders`}
                                                        className="text-[10px] font-bold uppercase tracking-wider bg-white/80 border border-black/5 text-green-700 px-3 py-1.5 rounded-lg hover:bg-green-600 hover:text-white transition-all shadow-sm"
                                                    >
                                                        Track Order
                                                    </Link>
                                                )}
                                                {notif.data.conversation_id && (
                                                    <Link
                                                        to={`/inbox`}
                                                        className="text-[10px] font-bold uppercase tracking-wider bg-white/80 border border-black/5 text-purple-700 px-3 py-1.5 rounded-lg hover:bg-purple-600 hover:text-white transition-all shadow-sm"
                                                    >
                                                        Open Chat
                                                    </Link>
                                                )}
                                                {(notif.data.delivery_request_id || notif.type === 'delivery_request') && (
                                                    <Link
                                                        to={`/orders`}
                                                        className="text-[10px] font-bold uppercase tracking-wider bg-white/80 border border-black/5 text-orange-700 px-3 py-1.5 rounded-lg hover:bg-orange-600 hover:text-white transition-all shadow-sm"
                                                    >
                                                        Review Request
                                                    </Link>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>
            <BottomNav />
        </div>
    );
}