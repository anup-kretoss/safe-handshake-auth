#!/bin/bash

echo "🔍 Verifying Souk IT Notification Setup..."
echo ""

# Check if .env exists
if [ -f ".env" ]; then
    echo "✅ .env file exists"
else
    echo "❌ .env file not found"
    exit 1
fi

# Check Firebase variables in .env
echo ""
echo "📋 Checking Firebase Configuration in .env:"
echo ""

check_env_var() {
    local var_name=$1
    if grep -q "^${var_name}=" .env && ! grep -q "^${var_name}=\"\"" .env; then
        echo "  ✅ $var_name is set"
        return 0
    else
        echo "  ⏳ $var_name is NOT set (empty or missing)"
        return 1
    fi
}

missing_count=0

check_env_var "VITE_FIREBASE_API_KEY" || ((missing_count++))
check_env_var "VITE_FIREBASE_AUTH_DOMAIN" || ((missing_count++))
check_env_var "VITE_FIREBASE_PROJECT_ID" || ((missing_count++))
check_env_var "VITE_FIREBASE_STORAGE_BUCKET" || ((missing_count++))
check_env_var "VITE_FIREBASE_MESSAGING_SENDER_ID" || ((missing_count++))
check_env_var "VITE_FIREBASE_APP_ID" || ((missing_count++))
check_env_var "VITE_FIREBASE_VAPID_KEY" || ((missing_count++))

echo ""
echo "📋 Checking Supabase Secrets:"
echo ""

# Check Supabase secrets
if command -v supabase &> /dev/null; then
    secrets=$(supabase secrets list 2>/dev/null)
    
    check_secret() {
        local secret_name=$1
        if echo "$secrets" | grep -q "$secret_name"; then
            echo "  ✅ $secret_name is set"
            return 0
        else
            echo "  ❌ $secret_name is NOT set"
            return 1
        fi
    }
    
    check_secret "private_key"
    check_secret "client_email"
    check_secret "project_id"
else
    echo "  ⚠️  Supabase CLI not found, skipping secret check"
fi

echo ""
echo "📋 Checking Files:"
echo ""

check_file() {
    local file_path=$1
    if [ -f "$file_path" ]; then
        echo "  ✅ $file_path exists"
        return 0
    else
        echo "  ❌ $file_path not found"
        return 1
    fi
}

check_file "src/lib/firebase.ts"
check_file "src/hooks/useFCM.ts"
check_file "public/firebase-messaging-sw.js"
check_file "supabase/functions/send-notification/index.ts"
check_file "supabase/functions/wishlist/index.ts"

echo ""
echo "📋 Checking Dependencies:"
echo ""

if [ -f "package.json" ]; then
    if grep -q '"firebase"' package.json; then
        echo "  ✅ firebase package is in package.json"
    else
        echo "  ❌ firebase package not found in package.json"
    fi
else
    echo "  ❌ package.json not found"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ $missing_count -eq 0 ]; then
    echo "🎉 Setup Complete! All Firebase variables are configured."
    echo ""
    echo "Next steps:"
    echo "1. Run: npm run dev"
    echo "2. Login to the app"
    echo "3. Grant notification permission"
    echo "4. Test sending a notification"
    echo ""
    echo "See FCM_QUICK_TEST.md for testing guide"
else
    echo "⏳ Setup Incomplete: $missing_count Firebase variable(s) missing"
    echo ""
    echo "Next steps:"
    echo "1. Follow GET_FIREBASE_WEB_CONFIG.md to get Firebase credentials"
    echo "2. Add them to .env file"
    echo "3. Update public/firebase-messaging-sw.js"
    echo "4. Run this script again to verify"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
