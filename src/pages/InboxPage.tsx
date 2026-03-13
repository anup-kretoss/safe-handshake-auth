import { useAuth } from '@/context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, MessageSquare, Clock, ChevronRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import BottomNav from '@/components/BottomNav';

export default function InboxPage() {
    const { user } = useAuth();
    const navigate = useNavigate();

    const { data: conversations, isLoading } = useQuery({
        queryKey: ['conversations'],
        queryFn: async () => {
            const { data, error } = await supabase.functions.invoke('conversations?action=inbox', {
                method: 'GET'
            });
            if (error) throw error;
            return data.data;
        },
        enabled: !!user,
    });

    return (
        <div className="min-h-screen bg-background pb-20">
            <header className="sticky top-0 z-40 bg-card border-b border-border px-4 py-3 flex items-center gap-3">
                <Link to="/dashboard">
                    <ArrowLeft className="h-5 w-5 text-foreground" />
                </Link>
                <h1 className="text-base font-semibold text-foreground">Messages</h1>
            </header>

            <main className="px-4 py-4 space-y-3">
                {isLoading ? (
                    <div className="space-y-3">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="h-20 w-full animate-pulse bg-card rounded-xl border border-border" />
                        ))}
                    </div>
                ) : conversations?.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="h-16 w-16 bg-muted rounded-full flex items-center justify-center mb-4">
                            <MessageSquare className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <h3 className="text-lg font-medium text-foreground">No messages yet</h3>
                        <p className="text-sm text-muted-foreground max-w-[200px]">Start a conversation by messaging a seller.</p>
                    </div>
                ) : (
                    conversations?.map((conv: any) => (
                        <Link
                            key={conv.id}
                            to={`/chat/${conv.id}`}
                            className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card hover:bg-muted/50 transition relative"
                        >
                            <div className="relative">
                                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                                    {conv.other_user?.name?.[0] || 'U'}
                                </div>
                                {conv.unread_count > 0 && (
                                    <span className="absolute -top-1 -right-1 h-5 w-5 bg-primary text-[10px] font-bold text-primary-foreground flex items-center justify-center rounded-full border-2 border-card">
                                        {conv.unread_count}
                                    </span>
                                )}
                            </div>

                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-0.5">
                                    <h3 className="text-sm font-semibold text-foreground truncate">{conv.other_user?.name}</h3>
                                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                                        {conv.last_message?.created_at ? new Date(conv.last_message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                    </span>
                                </div>
                                <p className="text-xs text-muted-foreground truncate italic">
                                    Regarding: {conv.products?.title || 'Product'}
                                </p>
                                <p className={`text-xs truncate transition-colors ${conv.unread_count > 0 ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                                    {conv.last_message?.content || 'No messages yet'}
                                </p>
                            </div>
                            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                        </Link>
                    ))
                )}
            </main>
            <BottomNav />
        </div>
    );
}
