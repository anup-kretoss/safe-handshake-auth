# 📋 Souk IT - Complete Postman Collection Guide

## 🎯 **Collection Overview**
This comprehensive Postman collection includes all enhanced features with mandatory signup fields, profile management, and notification settings.

**File**: `Souk_IT_Final_Complete_Collection.json`

---

## 🔧 **Collection Variables**

### **🌐 Environment Configuration**
| Variable | Value | Description |
|----------|-------|-------------|
| `SUPABASE_URL` | `https://ciywuwcwixbvmsezppya.supabase.co` | Your Supabase project URL |
| `SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` | Supabase anonymous key |

### **🔐 Authentication Tokens**
| Variable | Value | Description |
|----------|-------|-------------|
| `ACCESS_TOKEN` | *Auto-populated* | JWT token after login/signup |
| `USER_ID` | *Auto-populated* | User ID after authentication |

### **👤 Buyer Test Data**
| Variable | Value | Description |
|----------|-------|-------------|
| `BUYER_EMAIL` | `john.buyer@example.com` | Buyer email address |
| `BUYER_PASSWORD` | `BuyerPass123!` | Buyer password |
| `BUYER_FIRST_NAME` | `John` | Buyer first name |
| `BUYER_LAST_NAME` | `Buyer` | Buyer last name |
| `BUYER_PHONE` | `501234567` | Buyer phone number |
| `BUYER_COUNTRY_CODE` | `+971` | UAE country code |
| `BUYER_DOB` | `1990-01-15` | Date of birth (YYYY-MM-DD) |
| `BUYER_COLLECTION_ADDRESS` | JSON object | Collection address data |
| `BUYER_DELIVERY_ADDRESS` | JSON object | Delivery address data |

### **🏪 Seller Test Data**
| Variable | Value | Description |
|----------|-------|-------------|
| `SELLER_EMAIL` | `jane.seller@example.com` | Seller email address |
| `SELLER_PASSWORD` | `SellerPass123!` | Seller password |
| `SELLER_FIRST_NAME` | `Jane` | Seller first name |
| `SELLER_LAST_NAME` | `Seller` | Seller last name |
| `SELLER_PHONE` | `507654321` | Seller phone number |
| `SELLER_COUNTRY_CODE` | `+971` | UAE country code |
| `SELLER_DOB` | `1985-05-20` | Date of birth (YYYY-MM-DD) |
| `SELLER_COLLECTION_ADDRESS` | JSON object | Collection address data |
| `SELLER_DELIVERY_ADDRESS` | JSON object | Delivery address data |

### **🔧 Admin Test Data**
| Variable | Value | Description |
|----------|-------|-------------|
| `ADMIN_EMAIL` | `admin@soukit.com` | Admin email address |
| `ADMIN_PASSWORD` | `AdminPass123!` | Admin password |

### **🧪 Testing Data**
| Variable | Value | Description |
|----------|-------|-------------|
| `TEST_USER_EMAIL` | `testuser@example.com` | Test user email |
| `TEST_USER_PASSWORD` | `TestPass123!` | Test user password |
| `OTP_CODE` | `123456` | Sample OTP for testing |

### **📦 Product Data**
| Variable | Value | Description |
|----------|-------|-------------|
| `PRODUCT_ID` | *Auto-populated* | Product ID after creation |
| `CATEGORY_ID` | `1` | Electronics category |
| `SUB_CATEGORY_ID` | `1` | Mobile Phones sub-category |
| `SAMPLE_PRODUCT_TITLE` | `iPhone 14 Pro Max 256GB` | Sample product title |
| `SAMPLE_PRODUCT_DESCRIPTION` | `Brand new iPhone...` | Sample product description |
| `SAMPLE_PRODUCT_PRICE` | `4500` | Sample product price |
| `SAMPLE_PRODUCT_IMAGES` | JSON array | Sample product images |

### **💬 Communication Data**
| Variable | Value | Description |
|----------|-------|-------------|
| `ORDER_ID` | *Auto-populated* | Order ID after creation |
| `DELIVERY_REQUEST_ID` | *Auto-populated* | Delivery request ID |
| `CONVERSATION_ID` | *Auto-populated* | Conversation ID |
| `MESSAGE_ID` | *Auto-populated* | Message ID |
| `NOTIFICATION_ID` | *Auto-populated* | Notification ID |
| `SAMPLE_MESSAGE_CONTENT` | `Hi! Is this item still available?...` | Sample message text |
| `SAMPLE_OFFER_AMOUNT` | `4200` | Sample offer amount |

### **🌍 Location Data**
| Variable | Value | Description |
|----------|-------|-------------|
| `LOCATION_ID` | *Auto-populated* | Location ID from API |
| `UAE_LOCATIONS` | JSON array | List of UAE cities |

---

## 📁 **Collection Structure**

### **🔐 Authentication**
- **Buyer Registration (Enhanced Signup)** - Complete signup with mandatory fields
- **Seller Registration (Enhanced Signup)** - Seller signup with all required data
- **User Login** - Standard authentication

### **👤 Profile Management**
- **Get Complete Profile** - Retrieve all profile data including addresses
- **Update Profile (JSON)** - Update profile via JSON payload
- **Update Profile with Image Upload** - Form-data with file upload
- **Change Password** - Secure password change
- **Get Locations (Dropdown)** - UAE cities for location selection

### **🔔 Notification Settings**
- **Get Notification Settings (via Profile)** - Auto-created settings
- **Update Notification Settings** - 5 categories management

### **📦 Products**
- **Get Categories** - Product categories
- **Create Product (Seller)** - Product creation with variables
- **Get All Products** - Browse marketplace

### **🛒 Orders & Delivery**
- **Create Order (24-Hour Delivery)** - Order with delivery options
- **Get Seller Delivery Requests** - Seller approval queue
- **Approve Delivery Request (Seller)** - Seller approval system

### **💬 Chat & Messaging**
- **Create Conversation** - Buyer-seller communication
- **Send Message** - Chat functionality

### **🔔 Notifications**
- **Get All Notifications** - User notifications
- **Mark Notification as Read** - Notification management

### **🏪 Seller Dashboard**
- **Get Seller Products** - Seller inventory
- **Get Seller Orders** - Seller order management

### **🔧 Admin Functions**
- **Admin Login** - Platform management access
- **Get All Users (Admin)** - User management

### **🧪 Testing Flow**
- **1. Register Buyer** - Complete signup test
- **2. Get Complete Profile** - Profile verification
- **3. Update Profile with New Data** - Profile update test

---

## 🚀 **How to Use**

### **Step 1: Import Collection**
1. Open Postman
2. Click "Import"
3. Select `Souk_IT_Final_Complete_Collection.json`
4. Collection will be imported with all variables

### **Step 2: Run Testing Flow**
1. Go to "🧪 Testing Flow" folder
2. Run requests in order:
   - **1. Register Buyer** (populates ACCESS_TOKEN)
   - **2. Get Complete Profile** (shows all data)
   - **3. Update Profile with New Data** (tests updates)

### **Step 3: Test Individual Features**
- **Authentication**: Use buyer/seller registration
- **Profile Management**: Test JSON and image upload
- **Products**: Create and manage products
- **Orders**: Test 24-hour delivery flow
- **Admin**: Use admin login for management

### **Step 4: Customize Variables**
- Update email addresses to avoid conflicts
- Modify phone numbers for unique users
- Change product data as needed
- Adjust addresses for different locations

---

## ✅ **Mandatory Signup Fields**

All signup requests now require:
- ✅ **Name** (first_name, last_name)
- ✅ **Email** (valid email format)
- ✅ **Phone** (country_code + phone_number)
- ✅ **Collection Address** (address, town_city, postcode)
- ✅ **Delivery Address** (address, town_city, postcode)

### **Address Format**
```json
{
  "address": "123 Street Name, Building, Apt",
  "town_city": "Dubai",
  "postcode": "12345"
}
```

---

## 🎯 **Key Features Tested**

- ✅ **Enhanced Signup** with mandatory fields
- ✅ **Profile Management** with all fields
- ✅ **Image Upload** to Supabase Storage
- ✅ **Notification Settings** (5 categories)
- ✅ **Address Validation** (collection/delivery)
- ✅ **Seller Approval System** for 24-hour delivery
- ✅ **Complete API Coverage** for all endpoints

---

## 🔍 **Troubleshooting**

### **Common Issues**
1. **401 Unauthorized**: Run login/signup first to get ACCESS_TOKEN
2. **Email Already Exists**: Change BUYER_EMAIL/SELLER_EMAIL variables
3. **Phone Already Exists**: Update phone number variables
4. **Missing Fields**: Ensure all mandatory fields are provided
5. **Invalid Address**: Check address JSON format

### **Variable Population**
- ACCESS_TOKEN: Auto-set after login/signup
- USER_ID: Auto-set after authentication
- PRODUCT_ID: Auto-set after product creation
- ORDER_ID: Auto-set after order creation

---

## 📞 **Support**

For issues or questions:
1. Check variable values are populated
2. Verify mandatory fields are included
3. Ensure proper JSON format for addresses
4. Test with the "🧪 Testing Flow" folder first

**Ready to test the complete enhanced Souk IT API!** 🚀