# 🚀 Supabase Deployment Guide - SELLER APPROVAL SYSTEM

## ✅ **Functions Deployed Successfully**

All Supabase Edge Functions have been deployed with the new SELLER APPROVAL system:

- ✅ `seller-delivery-requests` - **NEW**: Seller approval system for 24h delivery
- ✅ `update-profile` - Enhanced with mandatory signup fields
- ✅ `orders` - Updated to use seller approval instead of admin
- ✅ `notification-settings` - 5 notification categories
- ✅ `locations` - Location dropdown API
- ✅ `change-password` - Secure password change
- ✅ All existing functions updated

## 🔄 **MAJOR SYSTEM CHANGE**

### **OLD SYSTEM (Removed):**
- ❌ Admin approval for 24-hour delivery
- ❌ 1-hour admin review window
- ❌ Admin dashboard for delivery requests

### **NEW SYSTEM (Active):**
- ✅ **SELLER approval for 24-hour delivery**
- ✅ **1-hour seller response window**
- ✅ **Auto-fallback to standard delivery if seller doesn't respond**
- ✅ **Admin only manages platform (user management, system settings)**

## 📋 **Next Steps to Complete Deployment**

### 1. **Run Database Migrations**

Copy and paste the SQL from `deploy_to_supabase.sql` into your Supabase SQL Editor:

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard/project/ciywuwcwixbvmsezppya)
2. Navigate to **SQL Editor**
3. Create a new query
4. Copy the entire content from `deploy_to_supabase.sql`
5. Click **Run** to execute all migrations

**This will:**
- ✅ Remove admin approval system
- ✅ Add signup fields (collection_address, delivery_address)
- ✅ Make profile fields mandatory
- ✅ Create seller approval functions
- ✅ Update database schema

### 2. **Configure Storage Bucket**

In your Supabase Dashboard:

1. Go to **Storage** section
2. The `profile-images` bucket should be created automatically
3. If not, create it manually:
   - Name: `profile-images`
   - Public: `true`

### 3. **Set Up Storage Policies**

Run this additional SQL in your SQL Editor:

```sql
-- Create storage policy for profile images
CREATE POLICY "Users can upload their own profile images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'profile-images' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their own profile images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'profile-images' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own profile images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'profile-images' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Profile images are publicly viewable"
ON storage.objects FOR SELECT
USING (bucket_id = 'profile-images');
```

### 4. **Create Admin User (Platform Management Only)**

Create an admin user account for platform management:

1. Go to **Authentication > Users**
2. Click **Add User**
3. Email: `admin@soukit.com`
4. Password: `admin123` (change this in production!)
5. After creation, run this SQL to make them admin:

```sql
UPDATE profiles 
SET role = 'admin' 
WHERE user_id = (
  SELECT id FROM auth.users WHERE email = 'admin@soukit.com'
);
```

**Note:** Admin will NOT handle delivery approvals - only platform management.

### 5. **Test the APIs**

Import the updated Postman collection and test:

1. **Import** `Souk_IT_Complete_Updated_Collection.json` into Postman
2. **Set environment variables:**
   - `SUPABASE_ANON_KEY`: Your Supabase anon key
3. **Run the complete flow test** to verify everything works

## 🔧 **Environment Variables Needed**

Make sure these are set in your environment:

```env
SUPABASE_URL=https://ciywuwcwixbvmsezppya.supabase.co
SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

## 📱 **Frontend Integration**

Update your frontend environment variables:

```env
VITE_SUPABASE_URL=https://ciywuwcwixbvmsezppya.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

## 🧪 **Testing Checklist**

### ✅ **Basic Functionality**
- [ ] User registration works
- [ ] User login works
- [ ] Profile creation with mandatory fields works
- [ ] Notification settings work

### ✅ **Enhanced Profile Features**
- [ ] Profile image upload works
- [ ] Username system works
- [ ] Location dropdown populated
- [ ] Collection address saves correctly
- [ ] Delivery address saves correctly
- [ ] Password change works

### ✅ **NEW Seller Approval System**
- [ ] Buyer can request 24h delivery
- [ ] **SELLER gets notification (NOT admin)**
- [ ] **Seller can approve/reject requests**
- [ ] **Buyer gets approval notification**
- [ ] **Auto-fallback to standard delivery works (1 hour)**

### ✅ **24-Hour Delivery Flow (NEW)**
1. **Buyer requests 24h delivery** → Order created in pending state
2. **Seller gets notification** → 1-hour window to respond
3. **Seller approves** → Order approved, buyer can pay
4. **Seller rejects OR 1 hour expires** → Auto-switch to standard delivery
5. **Buyer gets notification** → About approval/rejection/auto-switch

## 🎯 **What's New in Your System**

### **SELLER APPROVAL SYSTEM:**
- ✅ Sellers approve their own 24-hour delivery requests
- ✅ 1-hour response window for sellers
- ✅ Auto-fallback to standard delivery if no response
- ✅ Real-time notifications for buyers and sellers

### **MANDATORY SIGNUP FIELDS:**
- ✅ Name (first_name, last_name, full_name)
- ✅ Email address
- ✅ Phone number (with country code)
- ✅ Collection address (where seller picks up items)
- ✅ Delivery address (where buyer receives items)

### **ENHANCED PROFILE MANAGEMENT:**
- ✅ Profile image upload to Supabase Storage
- ✅ Username system with uniqueness validation
- ✅ User description field
- ✅ Location dropdown (UAE cities)
- ✅ All fields mandatory for complete profile

### **ADMIN ROLE CLARIFICATION:**
- ✅ Admin manages platform (users, system settings)
- ❌ Admin does NOT handle delivery approvals
- ✅ Sellers handle their own delivery decisions

## 📞 **API Endpoints Updated**

### **NEW Endpoints:**
- `POST /functions/v1/seller-delivery-requests?action=list` - List seller's delivery requests
- `POST /functions/v1/seller-delivery-requests?action=approve` - Approve delivery request
- `POST /functions/v1/seller-delivery-requests?action=reject` - Reject delivery request

### **Updated Endpoints:**
- `POST /functions/v1/update-profile` - Now requires mandatory fields
- `POST /functions/v1/orders?action=create` - Uses seller approval instead of admin

### **Removed Endpoints:**
- ❌ `/functions/v1/admin-delivery-requests` - No longer needed

## 🔍 **Troubleshooting**

### **Common Issues:**

1. **Functions not working:**
   - Check function logs in Supabase Dashboard > Edge Functions
   - Verify environment variables are set

2. **Database errors:**
   - Check if all migrations ran successfully
   - Verify RLS policies are enabled

3. **Profile validation errors:**
   - Ensure all mandatory fields are provided
   - Check address format (must have address, town_city, postcode)

4. **Seller approval not working:**
   - Verify seller is logged in correctly
   - Check delivery request belongs to the seller
   - Ensure request hasn't expired

### **Debug Commands:**

```sql
-- Check if new tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('locations', 'notification_settings');

-- Check profile structure
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'profiles' 
AND column_name IN ('collection_address', 'delivery_address');

-- Check delivery requests
SELECT * FROM delivery_requests WHERE status = 'pending';

-- Check storage bucket
SELECT * FROM storage.buckets WHERE name = 'profile-images';
```

## 🎉 **Success Indicators**

You'll know everything is working when:

1. ✅ All Postman tests pass
2. ✅ Seller dashboard shows delivery requests (NOT admin dashboard)
3. ✅ Profile images upload successfully
4. ✅ Mandatory profile fields are enforced
5. ✅ 24-hour delivery flow works with seller approval
6. ✅ Auto-expiration notifications are sent

## 📞 **Support**

If you encounter any issues:

1. Check the function logs in Supabase Dashboard
2. Verify all SQL migrations ran without errors
3. Test individual API endpoints using Postman
4. Check browser console for frontend errors

Your Supabase project now has:
- ✅ **SELLER approval system** for 24-hour delivery (NOT admin)
- ✅ **Mandatory signup fields** with address collection
- ✅ **Enhanced profile management** with image upload
- ✅ **Complete notification system** with 5 categories
- ✅ **Secure password change** functionality
- ✅ **Complete API testing suite** with updated flow