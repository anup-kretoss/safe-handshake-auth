import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const authHeader = req.headers.get('Authorization');

        if (!authHeader) return json({ success: false, message: 'Unauthorized' }, 401);

        const adminClient = createClient(supabaseUrl, serviceRoleKey);

        // Proper JWT Verification
        const token = authHeader.replace('Bearer ', '').trim();
        const { data: { user }, error: authError } = await adminClient.auth.getUser(token);

        if (authError || !user) {
            return json({ success: false, message: 'Invalid JWT or session expired' }, 401);
        }

        if (req.method !== 'POST') {
            return json({ success: false, message: 'POST required' }, 405);
        }

        const formData = await req.formData();
        const files = formData.getAll('images');
        const imageFiles = files.filter(f => f instanceof File) as File[];

        const uploadType = formData.get('type') as string;

        if (!uploadType) {
            return json({ success: false, message: 'Upload type is required. Must provide "type" field in form data as either "product" or "profile"' }, 400);
        }

        if (!['product', 'profile'].includes(uploadType)) {
            return json({ success: false, message: 'Invalid upload type. Must be exactly "product" or "profile"' }, 400);
        }

        if (imageFiles.length === 0) {
            return json({ success: false, message: 'No valid image files provided in the "images" field' }, 400);
        }

        const bucketName = uploadType === 'profile' ? 'profile-images' : 'product-images';

        // Ensure bucket exists and has correct MIME types (including HEIC)
        const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'];
        const { data: buckets } = await adminClient.storage.listBuckets();
        const targetBucket = buckets?.find(b => b.name === bucketName);

        if (!targetBucket) {
            await adminClient.storage.createBucket(bucketName, {
                public: true,
                fileSizeLimit: 5242880, // 5MB
                allowedMimeTypes,
            });
        } else {
            await adminClient.storage.updateBucket(bucketName, {
                public: true,
                fileSizeLimit: 5242880, // 5MB
                allowedMimeTypes,
            });
        }

        const uploadedUrls: string[] = [];
        const errors: string[] = [];

        for (const file of imageFiles) {
            const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'];
            const fileExt = (file.name.split('.').pop() || '').toLowerCase();
            const isHeic = fileExt === 'heic' || fileExt === 'heif';
            const isValidType = allowedTypes.includes(file.type) || isHeic;

            if (!isValidType) {
                errors.push(`File ${file.name} is not a supported image. Allowed: JPEG, PNG, WebP, GIF, HEIC.`);
                continue;
            }
            if (file.size > 5 * 1024 * 1024) {  // 5MB limit
                errors.push(`File ${file.name} exceeds 5MB limit.`);
                continue;
            }

            const fileName = `uploads/${uploadType}/${user.id}/${crypto.randomUUID()}.${fileExt || 'jpg'}`;

            const { error: uploadError } = await adminClient.storage
                .from(bucketName)
                .upload(fileName, file, {
                    contentType: file.type,
                    upsert: false,
                    cacheControl: '3600'
                });

            if (!uploadError) {
                const { data: urlData } = adminClient.storage
                    .from(bucketName)
                    .getPublicUrl(fileName);

                uploadedUrls.push(urlData.publicUrl);
            } else {
                errors.push(`Failed to upload ${file.name}: ${uploadError.message}`);
            }
        }

        if (uploadedUrls.length === 0) {
            return json({
                success: false,
                message: 'No images were successfully uploaded.',
                errors: errors
            }, 400);
        }

        // For profile uploads, auto-save the first URL to profiles.profile_image
        if (uploadType === 'profile' && uploadedUrls.length > 0) {
            await adminClient
                .from('profiles')
                .update({ profile_image: uploadedUrls[0], updated_at: new Date().toISOString() })
                .eq('user_id', user.id);
        }

        return json({
            success: true,
            message: 'Images uploaded successfully',
            data: {
                urls: uploadedUrls,
                type: uploadType
            },
            errors: errors.length > 0 ? errors : undefined
        });

    } catch (err: any) {
        return json({ success: false, message: err.message || 'Internal server error' }, 500);
    }
});

function json(data: unknown, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
}
