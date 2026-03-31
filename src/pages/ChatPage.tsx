import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { ArrowLeft, Send, Loader2, DollarSign, Check, X } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useMessages, useSendMessage, useRespondToOffer } from '@/hooks/useApi';

export default function ChatPage() {
  const { id: conversationId } = useParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: messages = [], isLoading } = useMessages(conversationId!);
  const sendMessageMutation = useSendMessage();
  const respondOfferMutation = useRespondToOffer();

  // Real-time subscription
  useEffect(() => {
    if (!conversationId) return;
    const channel = supabase
      .channel(`chat:${conversationId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      }, (payload) => {
        queryClient.setQueryData(['messages', conversationId], (old: any) => {
          if (!old) return [payload.new];
          if (old.find((m: any) => m.id === payload.new.id)) return old;
          return [...old, payload.new];
        });
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      }, (payload) => {
        queryClient.setQueryData(['messages', conversationId], (old: any) =>
          old?.map((m: any) => m.id === payload.new.id ? payload.new : m)
        );
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [conversationId, queryClient]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !conversationId) return;
    sendMessageMutation.mutate(
      { conversation_id: conversationId, content: message, message_type: 'text' },
      { onSuccess: () => setMessage(''), onError: (err: any) => toast.error(err.message || 'Failed to send') }
    );
  };

  const handleOffer = () => {
    const amount = prompt('Enter your offer amount (AED):');
    if (amount && !isNaN(parseFloat(amount)) && conversationId) {
      sendMessageMutation.mutate({
        conversation_id: conversationId,
        content: `Offered ${amount} AED`,
        message_type: 'offer',
        offer_amount: parseFloat(amount),
      });
    }
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      <header className="sticky top-0 z-40 bg-card border-b border-border px-4 py-3 flex items-center gap-3">
        <Link to="/inbox">
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </Link>
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">U</div>
          <h1 className="text-sm font-semibold text-foreground">Chat</h1>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground text-xs italic">No messages yet. Say hello!</div>
        ) : (
          messages.map((msg: any) => {
            const isMe = msg.sender_id === user?.id;
            const isOffer = msg.message_type === 'offer';
            return (
              <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 shadow-sm ${isMe ? 'bg-primary text-primary-foreground rounded-tr-none' : 'bg-card text-foreground rounded-tl-none border border-border'}`}>
                  {isOffer && (
                    <div className="flex items-center gap-2 mb-1 pb-1 border-b border-white/20">
                      <DollarSign className="h-3 w-3" />
                      <span className="text-xs font-bold uppercase tracking-wider">OFFER</span>
                    </div>
                  )}
                  <p className="text-sm">{msg.content}</p>
                  {isOffer && msg.offer_status === 'pending' && !isMe && (
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => respondOfferMutation.mutate({ messageId: msg.id, response: 'accepted' })}
                        className="bg-green-500 text-white p-1 rounded-lg flex-1 flex items-center justify-center"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => respondOfferMutation.mutate({ messageId: msg.id, response: 'rejected' })}
                        className="bg-red-500 text-white p-1 rounded-lg flex-1 flex items-center justify-center"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                  {isOffer && msg.offer_status && msg.offer_status !== 'pending' && (
                    <div className={`mt-1 text-[10px] font-bold uppercase ${msg.offer_status === 'accepted' ? 'text-green-300' : 'text-red-300'}`}>
                      Offer {msg.offer_status}
                    </div>
                  )}
                  <span className="text-[9px] block text-right mt-1 opacity-60">
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            );
          })
        )}
        <div ref={scrollRef} />
      </main>

      <footer className="p-4 bg-card border-t border-border flex items-center gap-2">
        <button
          onClick={handleOffer}
          className="h-10 w-10 shrink-0 rounded-xl bg-secondary flex items-center justify-center text-foreground hover:bg-muted transition"
        >
          <DollarSign className="h-5 w-5" />
        </button>
        <form onSubmit={handleSend} className="flex-1 flex gap-2">
          <input
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 bg-muted/50 border border-border rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <button
            type="submit"
            disabled={!message.trim() || sendMessageMutation.isPending}
            className="h-10 w-10 shrink-0 rounded-xl bg-primary flex items-center justify-center text-primary-foreground disabled:opacity-50 transition"
          >
            {sendMessageMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </form>
      </footer>
    </div>
  );
}
