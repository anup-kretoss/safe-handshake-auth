import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'POST, GET, PUT, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return json({ success: false, message: 'Unauthorized' }, 401);
    }

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return json({ success: false, message: 'Unauthorized' }, 401);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // ---- GET PROFILE ----
    if (req.method === 'GET') {
      const { data: profile, error: profileError } = await adminClient
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (profileError) throw profileError;

      // Get location separately if location_id exists
      let location = null;
      if (profile?.location_id) {
        const { data: locationData } = await adminClient
          .from('locations')
          .select('id, name, country')
          .eq('id', profile.location_id)
          .single();
        location = locationData;
      }

      // Get notification settings separately
      const { data: notificationSettings } = await adminClient
        .from('notification_settings')
        .select('*')
        .eq('user_id', user.id)
        .single();

      return json({ 
        success: true, 
        data: {
          ...profile,
          location,
          notification_settings: notificationSettings
        }
      });
    }

    // ---- UPDATE PROFILE ----
    if (req.method === 'POST' || req.method === 'PUT') {
      const contentType = req.headers.get('content-type') || '';
      let profileData: any = {};
      let imageFile: File | null = null;

      // Handle multipart/form-data for image upload
      if (contentType.includes('multipart/form-data')) {
        const formData = await req.formData();
        
        // Extract profile data from form
        const profileDataStr = formData.get('profileData') as string;
        if (profileDataStr) {
          try {
            profileData = JSON.parse(profileDataStr);
          } catch (e) {
            return json({ success: false, message: 'Invalid profile data JSON' }, 400);
          }
        }

        // Extract image file
        imageFile = formData.get('profile_image') as File;
      } else {
        // Handle JSON data
        profileData = await req.json();
      }

      // Validate and sanitize profile data - Now include ALL fields
      const allFields = [
        'first_name', 'last_name', 'phone_number', 'country_code', 'date_of_birth', 
        'gender', 'fcm_token', 'email', 'username', 'user_description', 'location_id', 
        'full_name', 'collection_address', 'delivery_address', 'profile_image'
      ];

      const updateData: any = {};
      
      // Check required fields first
      const requiredFields = ['first_name', 'last_name', 'phone_number', 'country_code'];
      for (const field of requiredFields) {
        if (profileData[field] !== undefined && (!profileData[field] || String(profileData[field]).trim() === '')) {
          return json({ 
            success: false, 
            message: `${field.replace('_', ' ')} is required` 
          }, 400);
        }
      }
      
      for (const [key, value] of Object.entries(profileData)) {
        if (allFields.includes(key) && value !== undefined) {
          if (key === 'gender' && value) {
            if (!['male', 'female', 'other'].includes((value as string).toLowerCase())) {
              return json({ 
                success: false, 
                message: 'Gender must be male, female, or other' 
              }, 400);
            }
            updateData[key] = (value as string).toLowerCase();
          } else if (key === 'date_of_birth' && value) {
            // Validate date format
            const date = new Date(value as string);
            if (isNaN(date.getTime())) {
              return json({ 
                success: false, 
                message: 'Invalid date format for date_of_birth' 
              }, 400);
            }
            updateData[key] = value;
          } else if (key === 'username' && value) {
            // Basic username validation
            if (!/^[a-zA-Z0-9_]{3,30}$/.test(value as string)) {
              return json({ 
                success: false, 
                message: 'Username must be 3-30 characters long and contain only letters, numbers, and underscores' 
              }, 400);
            }
            updateData[key] = value;
          } else if ((key === 'collection_address' || key === 'delivery_address') && value) {
            // Validate address structure
            if (typeof value !== 'object' || !value.address || !value.town_city || !value.postcode) {
              return json({ 
                success: false, 
                message: `${key.replace('_', ' ')} must include address, town_city, and postcode` 
              }, 400);
            }
            updateData[key] = value;
          } else if (key === 'location_id' && value) {
            // Validate location_id exists
            const { data: locationExists } = await adminClient
              .from('locations')
              .select('id')
              .eq('id', value)
              .single();
            
            if (!locationExists) {
              return json({ 
                success: false, 
                message: 'Invalid location_id' 
              }, 400);
            }
            updateData[key] = value;
          } else {
            updateData[key] = value;
          }
        }
      }

      // Handle image upload to Supabase Storage
      let imageUrl = null;
      if (imageFile && imageFile.size > 0) {
        // Validate image file
        if (!imageFile.type.startsWith('image/')) {
          return json({ 
            success: false, 
            message: 'Profile image must be an image file' 
          }, 400);
        }

        // Check file size (max 5MB)
        if (imageFile.size > 5 * 1024 * 1024) {
          return json({ 
            success: false, 
            message: 'Profile image must be less than 5MB' 
          }, 400);
        }

        try {
          // Fixed filename per user — always overwrites, no stale files
          const fileExt = imageFile.name.split('.').pop()?.toLowerCase() || 'jpg';
          const fileName = `${user.id}/profile.${fileExt}`;

          // Convert File to ArrayBuffer for Supabase Storage
          const fileBuffer = await imageFile.arrayBuffer();

          // First, try to create bucket if it doesn't exist
          try {
            const { data: buckets } = await adminClient.storage.listBuckets();
            const profileBucket = buckets?.find(b => b.name === 'profile-images');
            
            if (!profileBucket) {
              await adminClient.storage.createBucket('profile-images', {
                public: true,
                fileSizeLimit: 5242880,
                allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
              });
            }
          } catch (bucketError) {
            console.warn('Bucket creation warning:', bucketError);
          }

          // Upload to Supabase Storage (upsert=true overwrites existing)
          const { error: uploadError } = await adminClient.storage
            .from('profile-images')
            .upload(fileName, fileBuffer, {
              contentType: imageFile.type,
              cacheControl: '3600',
              upsert: true
            });

          if (uploadError) {
            console.error('Storage upload error:', uploadError);
            throw uploadError;
          }

          // Get public URL — append cache-bust so clients reload the new image
          const { data: { publicUrl } } = adminClient.storage
            .from('profile-images')
            .getPublicUrl(fileName);

          imageUrl = `${publicUrl}?t=${Date.now()}`;
          
          // Store image URL in profile_image field
          updateData.profile_image = imageUrl;

        } catch (error) {
          console.error('Image upload failed:', error);
          return json({ 
            success: false, 
            message: `Failed to upload profile image: ${error.message}` 
          }, 500);
        }
      }

      if (Object.keys(updateData).length === 0) {
        return json({ 
          success: false, 
          message: 'No valid fields provided for update' 
        }, 400);
      }

      // Update profile
      updateData.updated_at = new Date().toISOString();

      const { data, error } = await adminClient
        .from('profiles')
        .update(updateData)
        .eq('user_id', user.id)
        .select('*')
        .single();

      if (error) {
        // Handle unique constraint violations
        if (error.code === '23505' && error.message.includes('username')) {
          return json({ 
            success: false, 
            message: 'Username is already taken' 
          }, 409);
        }
        throw error;
      }

      // Get location separately if location_id exists
      let location = null;
      if (data?.location_id) {
        const { data: locationData } = await adminClient
          .from('locations')
          .select('id, name, country')
          .eq('id', data.location_id)
          .single();
        location = locationData;
      }

      // Get notification settings separately
      const { data: notificationSettings } = await adminClient
        .from('notification_settings')
        .select('*')
        .eq('user_id', user.id)
        .single();

      return json({ 
        success: true, 
        data: {
          ...data,
          profile_image_uploaded: !!imageUrl,
          profile_image_url: imageUrl,
          location,
          notification_settings: notificationSettings
        },
        message: 'Profile updated successfully',
        image_uploaded: !!imageUrl
      });
    }

    return json({ success: false, message: 'Method not allowed' }, 405);
  } catch (err) {
    console.error('Update profile error:', err);
    return json({ 
      success: false, 
      message: err.message || 'Internal server error' 
    }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}