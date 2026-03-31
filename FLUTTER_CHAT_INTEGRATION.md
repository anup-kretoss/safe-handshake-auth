# 📱 Souk IT: Flutter Chat Integration Guide

This guide provides everything needed for a Flutter developer to implement the real-time chat and offer system for **Souk IT**.

---

## 🏗️ Architecture Overview

The chat system is a hybrid of **REST APIs** (for reliable state changes, complex queries, and server-side logic) and **Supabase Realtime** (for instant UI updates).

1.  **REST APIs (Supabase Edge Functions)**: Used for listing inbox, creating conversations, sending messages, and responding to offers.
2.  **Supabase Realtime (WebSockets)**: Used to listen for database changes (`INSERT` or `UPDATE` on the `messages` table) to update the chat UI without polling.
3.  **Supabase Auth**: All requests must be authenticated using the standard Supabase flow.

---

## ⚙️ Setup & Authentication

### 1. Add Dependencies
Add the following to your `pubspec.yaml`:
```yaml
dependencies:
  supabase_flutter: ^2.0.0
```

### 2. Initialization
Initialize Supabase in your `main.dart` or `app.dart`:
```dart
await Supabase.initialize(
  url: 'https://ciywuwcwixbvmsezppya.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNpeXd1d2N3aXhidm1zZXpwcHlhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxMDAyOTcsImV4cCI6MjA4NzY3NjI5N30.1b-Y6kVbMA-AjpLLmyl-khzMVZx2H3ktSkgla3eK49k',
);
```

### 3. Authentication Headers
When calling the Edge Functions via HTTP, use the following headers:
- `Authorization: Bearer <supabase_session_access_token>`
- `apikey: <supabase_anon_key>`

---

## 📩 REST API Reference

All chat-related actions use the following base endpoint:
`https://ciywuwcwixbvmsezppya.supabase.co/functions/v1/conversations`

### 1. Get Inbox (All Conversations)
Fetches a list of all chat/offer threads for the logged-in user.
- **Method**: `GET`
- **Query Param**: `action=inbox`

**Response (`data` array item):**
```json
{
  "id": "uuid",
  "buyer_id": "uuid",
  "seller_id": "uuid",
  "type": "chat|offer",
  "unread_count": 2,
  "last_message": {
    "content": "Is this still available?",
    "message_type": "text",
    "created_at": "2026-03-20T10:00:00Z"
  },
  "other_user": {
    "user_id": "uuid",
    "name": "Jane Doe",
    "profile_image_url": "https://..."
  },
  "product": {
    "id": "uuid",
    "title": "Nike Air Max",
    "display_price": 550.0,
    "images": ["url1", "url2"]
  }
}
```

### 2. Create/Get Conversation
Opens a new conversation or returns an existing one.
- **Method**: `POST`
- **Query Param**: `action=create`
- **Body**:
```json
{
  "seller_id": "uuid",
  "product_id": "uuid",
  "type": "chat" // or "offer"
}
```

### 3. Load Messages
Fetches message history for a specific thread. Automatically marks messages as "read".
- **Method**: `GET`
- **Query Param**: `action=messages&conversation_id=<uuid>&limit=50&offset=0`

### 4. Send Message / Make Offer
- **Method**: `POST`
- **Query Param**: `action=send`
- **Body (Text)**:
```json
{
  "conversation_id": "uuid",
  "content": "Hey, I'm interested!",
  "message_type": "text"
}
```
- **Body (Offer)**:
```json
{
  "conversation_id": "uuid",
  "content": "I offer 500 AED",
  "message_type": "offer",
  "offer_amount": 500
}
```

### 5. Respond to Offer
Used by the recipient of an offer to accept or reject it.
- **Method**: `POST`
- **Query Param**: `action=respond-offer`
- **Body**:
```json
{
  "message_id": "uuid",
  "response": "accepted" // or "rejected"
}
```

---

## ⚡ Real-Time Integration

To make the chat feel updated instantly, you **must** subscribe to the `messages` table changes for the active conversation.

### Subscribing in Flutter
```dart
final supabase = Supabase.instance.client;

final messageStream = supabase
  .channel('public:messages:conversation_id=eq.$conversationId')
  .onPostgresChanges(
    event: PostgresChangeEvent.all, // Listen for INS (new msg) and UPD (offer status)
    schema: 'public',
    table: 'messages',
    filter: PostgresChangeFilter(
      type: PostgresChangeFilterType.eq,
      column: 'conversation_id',
      value: conversationId,
    ),
    callback: (payload) {
      if (payload.eventType == PostgresChangeEvent.insert) {
        // New message received! Append to local list.
        final newMessage = payload.newRecord;
      } else if (payload.eventType == PostgresChangeEvent.update) {
        // Offer was accepted/rejected! Update the specific message in list.
        final updatedMessage = payload.newRecord;
      }
    },
  )
  .subscribe();

// Clean up when leaving the chat screen:
supabase.removeChannel(messageStream);
```

---

## 🎨 Recommended Implementation Flow

### 1. The Message Bubble
Since Souk IT supports both **text** and **offers**, your message bubble widget should handle three states:
- **Standard Bubble**: For `"text"` messages.
- **Offer Card**: A specialized UI card showing the product image, proposed price, and status (Pending/Accepted/Rejected).
- **Offer Actions**: "Accept/Reject" buttons shown only to the user receiving the offer.

### 2. Service Fees & Display Price
The backend returns `display_price`. **Always use `display_price`** for what the user sees, as it includes the necessary service fees pre-calculated.

### 3. Push Notifications
The backend already handles firing notifications to the `notifications` table and sending via Cloud Functions. Ensure your Flutter app listens to the `notifications` table or uses FCM for foreground/background alerts.
