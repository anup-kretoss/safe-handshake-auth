import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get('action') || 'inbox';

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ success: false, message: 'Unauthorized' }, 401);

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) return json({ success: false, message: 'Unauthorized' }, 401);

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // ---- INBOX: List conversations with unread count ----
    if (action === 'inbox') {
      const { data: conversations, error } = await adminClient
        .from('conversations')
        .select('*, products(id, title, images, price)')
        .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      // Get unread counts and last message for each conversation
      const enriched = await Promise.all((conversations || []).map(async (conv: any) => {
        // Unread count
        const { count } = await adminClient
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .eq('conversation_id', conv.id)
          .eq('is_read', false)
          .neq('sender_id', user.id);

        // Last message
        const { data: lastMsg } = await adminClient
          .from('messages')
          .select('content, message_type, sender_id, created_at')
          .eq('conversation_id', conv.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        // Get other user's profile
        const otherUserId = conv.buyer_id === user.id ? conv.seller_id : conv.buyer_id;
        const { data: otherProfile } = await adminClient
          .from('profiles')
          .select('first_name, last_name, user_id')
          .eq('user_id', otherUserId)
          .single();

        return {
          ...conv,
          unread_count: count || 0,
          last_message: lastMsg || null,
          other_user: otherProfile ? {
            user_id: otherProfile.user_id,
            name: `${otherProfile.first_name} ${otherProfile.last_name}`.trim(),
          } : null,
        };
      }));

      return json({ success: true, data: enriched });
    }

    // ---- CREATE CONVERSATION (or get existing) ----
    if (action === 'create') {
      if (req.method !== 'POST') return json({ success: false, message: 'POST required' }, 405);

      const body = await req.json();
      const { seller_id, product_id, type } = body;

      if (!seller_id) return json({ success: false, message: 'seller_id is required' }, 400);
      if (seller_id === user.id) return json({ success: false, message: 'Cannot message yourself' }, 400);

      const convType = type === 'offer' ? 'offer' : 'chat';

      // Check if conversation already exists for this product between these users
      let query = adminClient
        .from('conversations')
        .select('*')
        .or(`and(buyer_id.eq.${user.id},seller_id.eq.${seller_id}),and(buyer_id.eq.${seller_id},seller_id.eq.${user.id})`)
        .eq('type', convType);

      if (product_id) {
        query = query.eq('product_id', product_id);
      }

      const { data: existing } = await query.limit(1).single();

      if (existing) {
        return json({ success: true, data: existing, message: 'Conversation already exists' });
      }

      // Create new conversation
      const { data: conv, error } = await adminClient
        .from('conversations')
        .insert({
          buyer_id: user.id,
          seller_id,
          product_id: product_id || null,
          type: convType,
        })
        .select()
        .single();

      if (error) throw error;
      return json({ success: true, data: conv });
    }

    // ---- GET MESSAGES for a conversation ----
    if (action === 'messages') {
      const conversationId = url.searchParams.get('conversation_id');
      if (!conversationId) return json({ success: false, message: 'conversation_id required' }, 400);

      // Verify user is participant
      const { data: conv } = await adminClient
        .from('conversations')
        .select('buyer_id, seller_id')
        .eq('id', conversationId)
        .single();

      if (!conv || (conv.buyer_id !== user.id && conv.seller_id !== user.id)) {
        return json({ success: false, message: 'Not authorized' }, 403);
      }

      const limit = parseInt(url.searchParams.get('limit') || '50');
      const offset = parseInt(url.searchParams.get('offset') || '0');

      const { data, error } = await adminClient
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
        .range(offset, offset + limit - 1);

      if (error) throw error;

      // Mark messages as read
      await adminClient
        .from('messages')
        .update({ is_read: true })
        .eq('conversation_id', conversationId)
        .neq('sender_id', user.id)
        .eq('is_read', false);

      return json({ success: true, data });
    }

    // ---- SEND MESSAGE ----
    if (action === 'send') {
      if (req.method !== 'POST') return json({ success: false, message: 'POST required' }, 405);

      const body = await req.json();
      const { conversation_id, content, message_type, offer_amount } = body;

      if (!conversation_id) return json({ success: false, message: 'conversation_id required' }, 400);

      // Verify user is participant
      const { data: conv } = await adminClient
        .from('conversations')
        .select('*')
        .eq('id', conversation_id)
        .single();

      if (!conv || (conv.buyer_id !== user.id && conv.seller_id !== user.id)) {
        return json({ success: false, message: 'Not authorized' }, 403);
      }

      const msgType = message_type || 'text';
      const insertData: any = {
        conversation_id,
        sender_id: user.id,
        content: content || '',
        message_type: msgType,
      };

      if (msgType === 'offer' && offer_amount) {
        insertData.offer_amount = parseFloat(String(offer_amount));
        insertData.offer_status = 'pending';
      }

      const { data: msg, error } = await adminClient
        .from('messages')
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;

      // Update conversation updated_at
      await adminClient.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', conversation_id);

      // Notify the other user
      const otherUserId = conv.buyer_id === user.id ? conv.seller_id : conv.buyer_id;
      const { data: senderProfile } = await adminClient
        .from('profiles')
        .select('first_name, last_name')
        .eq('user_id', user.id)
        .single();

      const senderName = senderProfile ? `${senderProfile.first_name} ${senderProfile.last_name}`.trim() : 'Someone';

      const notifType = msgType === 'offer' ? 'new_offer' : 'new_message';
      const notifTitle = msgType === 'offer' ? 'New Offer Received' : `New Message from ${senderName}`;
      const notifMessage = msgType === 'offer'
        ? `${senderName} made an offer of ${offer_amount} AED`
        : content?.substring(0, 100) || 'New message';

      await adminClient.from('notifications').insert({
        user_id: otherUserId,
        type: notifType,
        title: notifTitle,
        message: notifMessage,
        data: { conversation_id, message_id: msg.id, sender_id: user.id },
      });

      return json({ success: true, data: msg });
    }

    // ---- RESPOND TO OFFER (accept/reject) ----
    if (action === 'respond-offer') {
      if (req.method !== 'POST') return json({ success: false, message: 'POST required' }, 405);

      const body = await req.json();
      const { message_id, response } = body;

      if (!message_id || !response) return json({ success: false, message: 'message_id and response (accepted/rejected) required' }, 400);
      if (!['accepted', 'rejected'].includes(response)) {
        return json({ success: false, message: 'response must be accepted or rejected' }, 400);
      }

      const { data: msg, error: msgError } = await adminClient
        .from('messages')
        .select('*, conversations(buyer_id, seller_id, product_id)')
        .eq('id', message_id)
        .single();

      if (msgError || !msg) return json({ success: false, message: 'Message not found' }, 404);
      if (msg.message_type !== 'offer') return json({ success: false, message: 'Not an offer message' }, 400);
      if (msg.offer_status !== 'pending') return json({ success: false, message: 'Offer already responded' }, 400);

      // Only the other party can respond
      if (msg.sender_id === user.id) {
        return json({ success: false, message: 'Cannot respond to your own offer' }, 400);
      }

      const { data: updated, error } = await adminClient
        .from('messages')
        .update({ offer_status: response })
        .eq('id', message_id)
        .select()
        .single();

      if (error) throw error;

      // Notify the offer sender
      const notifType = response === 'accepted' ? 'offer_accepted' : 'offer_rejected';
      const notifTitle = response === 'accepted' ? 'Offer Accepted!' : 'Offer Rejected';
      await adminClient.from('notifications').insert({
        user_id: msg.sender_id,
        type: notifType,
        title: notifTitle,
        message: `Your offer of ${msg.offer_amount} AED has been ${response}.`,
        data: { conversation_id: msg.conversation_id, message_id },
      });

      return json({ success: true, data: updated });
    }

    return json({ success: false, message: 'Invalid action' }, 400);
  } catch (err) {
    return json({ success: false, message: err.message || 'Internal server error' }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
