import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, User, Mail, Phone, Calendar, LogOut, ChevronRight, ShoppingBag, Bell, Lock, MapPin, Camera } from 'lucide-react';
import BottomNav from '@/components/BottomNav';
import ChangePasswordModal from '@/components/ChangePasswordModal';
import { toast } from 'sonner';
import { updateProfile } from '@/lib/api';
import { requestFCMToken } from '@/lib/firebase';
import { useUploadImages, useUpdateProfile, useNotificationSettings, useUpdateNotificationSettings, useCreateNotificationSettings } from '@/hooks/useApi';

export default function ProfilePage() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [showChangePassword, setShowChangePassword] = useState(false);
  const uploadMutation = useUploadImages();
  const updateProfileMutation = useUpdateProfile();
  const { data: notifSettings } = useNotificationSettings();
  const updateNotifMutation = useUpdateNotificationSettings();
  const createNotifMutation = useCreateNotificationSettings();

  const handleNotifToggle = async (key: string, value: boolean) => {
    const current = notifSettings || {
      general_notifications: true,
      email_notifications: true,
      message_notifications: true,
      payment_notifications: true,
      update_notifications: true,
    };
    const updated = { ...current, [key]: value };
    try {
      if (notifSettings) {
        await updateNotifMutation.mutateAsync(updated);
      } else {
        await createNotifMutation.mutateAsync(updated);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to update notification settings');
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const handleAvatarClick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;

      try {
        toast.loading('Uploading profile image...', { id: 'profile-upload' });
        const urls = await uploadMutation.mutateAsync({ files: [file], type: 'profile' });
        await updateProfileMutation.mutateAsync({ profile_image: urls[0] });
        toast.success('Profile image updated!', { id: 'profile-upload' });
      } catch (err: any) {
        toast.error(err.message || 'Failed to upload image', { id: 'profile-upload' });
      }
    };
    input.click();
  };

  const handleEnablePushNotifications = async () => {
    try {
      toast.loading('Enabling push notifications...', { id: 'fcm' });
      const token = await requestFCMToken();
      if (!token) {
        toast.error('Permission denied or browser not supported. Please allow notifications in browser settings.', { id: 'fcm' });
        return;
      }
      // Save FCM token directly via Supabase client (bypasses edge function auth issues)
      const { supabase } = await import('@/integrations/supabase/client');
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not logged in');
      const { error } = await supabase
        .from('profiles')
        .update({ fcm_token: token })
        .eq('user_id', user.id);
      if (error) throw error;
      toast.success('Push notifications enabled!', { id: 'fcm' });
    } catch (err: any) {
      toast.error(err.message || 'Failed to enable notifications', { id: 'fcm' });
    }
  };

  const handleChangePassword = () => {
    setShowChangePassword(true);
  };

  const initials = `${(profile?.first_name || '')[0] || ''}${(profile?.last_name || '')[0] || ''}`.toUpperCase() || 'U';

  const infoItems = [
    { icon: Mail, label: 'Email', value: profile?.email || user?.email || 'Not set' },
    { icon: Phone, label: 'Phone', value: profile?.country_code && profile?.phone_number ? `${profile.country_code} ${profile.phone_number}` : 'Not set' },
    { icon: Calendar, label: 'Date of Birth', value: profile?.date_of_birth ? new Date(profile.date_of_birth).toLocaleDateString() : 'Not set' },
    { icon: User, label: 'Gender', value: profile?.gender || 'Not set' },
    { icon: User, label: 'Username', value: profile?.username || 'Not set' },
  ];

  const addressItems = [
    {
      label: 'Collection Address',
      value: profile?.collection_address
        ? `${profile.collection_address.address}, ${profile.collection_address.town_city}, ${profile.collection_address.postcode}`
        : 'Not set'
    },
    {
      label: 'Delivery Address',
      value: profile?.delivery_address
        ? `${profile.delivery_address.address}, ${profile.delivery_address.town_city}, ${profile.delivery_address.postcode}`
        : 'Not set'
    },
  ];

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-40 bg-card border-b border-border px-4 py-3 flex items-center gap-3">
        <Link to="/dashboard">
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </Link>
        <h1 className="text-base font-semibold text-foreground">Profile</h1>
      </header>

      <main className="px-4 py-6 space-y-6">
        {/* Avatar & Name */}
        <div className="flex flex-col items-center gap-3">
          <div className="relative group cursor-pointer" onClick={handleAvatarClick}>
            <div className="h-24 w-24 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-3xl font-bold overflow-hidden border-4 border-background shadow-xl">
              {profile?.profile_image ? (
                <img src={profile.profile_image} alt="" className="h-full w-full object-cover" />
              ) : (
                initials
              )}
            </div>
            <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Camera className="h-6 w-6 text-white" />
            </div>
          </div>
          <div className="text-center">
            <h2 className="text-lg font-bold text-foreground">{profile?.first_name} {profile?.last_name}</h2>
            <p className="text-xs text-muted-foreground font-medium bg-secondary px-3 py-1 rounded-full mt-1 inline-block">
              {profile?.email || user?.email}
            </p>
          </div>
        </div>

        {/* Info Cards */}
        <div className="space-y-2">
          {infoItems.map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card">
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <Icon className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-sm font-medium text-foreground truncate capitalize">{value}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
          ))}
        </div>

        {/* Address Cards */}
        <div className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">Addresses</h3>
          {addressItems.map(({ label, value }) => (
            <div key={label} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card">
              <div className="h-9 w-9 rounded-lg bg-orange-500/10 flex items-center justify-center">
                <MapPin className="h-4 w-4 text-orange-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-sm font-medium text-foreground truncate">{value}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">Quick Actions</h3>
          <div className="space-y-2">
            <Link
              to="/orders"
              className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card hover:bg-muted/50 transition-colors"
            >
              <div className="h-9 w-9 rounded-lg bg-green-500/10 flex items-center justify-center">
                <ShoppingBag className="h-4 w-4 text-green-500" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">My Orders</p>
                <p className="text-[10px] text-muted-foreground">View buying & selling orders</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>

            <Link
              to="/seller-dashboard"
              className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card hover:bg-muted/50 transition-colors"
            >
              <div className="h-9 w-9 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <ShoppingBag className="h-4 w-4 text-purple-500" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">Seller Dashboard</p>
                <p className="text-[10px] text-muted-foreground">Manage your listings & sales</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>

            <Link
              to="/notifications"
              className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card hover:bg-muted/50 transition-colors"
            >
              <div className="h-9 w-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Bell className="h-4 w-4 text-blue-500" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">Notifications</p>
                <p className="text-[10px] text-muted-foreground">View all alerts & updates</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>

            {/* Admin Dashboard - Only show for admin users */}
            {profile?.role && ['admin', 'super_admin'].includes(profile.role) && (
              <Link
                to="/admin-dashboard"
                className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card hover:bg-muted/50 transition-colors"
              >
                <div className="h-9 w-9 rounded-lg bg-red-500/10 flex items-center justify-center">
                  <User className="h-4 w-4 text-red-500" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Admin Dashboard</p>
                  <p className="text-[10px] text-muted-foreground">Manage delivery requests</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            )}
          </div>
        </div>

        {/* Settings */}
        <div className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">Notification Settings</h3>
          <div className="p-3 rounded-xl border border-border bg-card space-y-4">
            {[
              { key: 'general_notifications', label: 'General Notifications', desc: 'All app alerts', color: 'blue' },
              { key: 'email_notifications', label: 'Email Alerts', desc: 'Receive updates via email', color: 'green' },
              { key: 'message_notifications', label: 'Message Alerts', desc: 'New messages & offers', color: 'purple' },
              { key: 'payment_notifications', label: 'Payment Alerts', desc: 'Orders & payments', color: 'orange' },
              { key: 'update_notifications', label: 'App Updates', desc: 'New features & news', color: 'pink' },
            ].map(({ key, label, desc, color }) => (
              <div key={key} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`h-9 w-9 rounded-lg bg-${color}-500/10 flex items-center justify-center`}>
                    <Bell className={`h-4 w-4 text-${color}-500`} />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-[10px] text-muted-foreground">{desc}</p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={notifSettings ? (notifSettings as any)[key] ?? true : true}
                  onChange={e => handleNotifToggle(key, e.target.checked)}
                  className="h-5 w-5 accent-primary"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">Account</h3>
          <div className="space-y-2">
            <button
              onClick={handleEnablePushNotifications}
              className="w-full flex items-center gap-3 p-3 rounded-xl border border-border bg-card transition hover:bg-muted/50"
            >
              <div className="h-9 w-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Bell className="h-4 w-4 text-blue-500" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-medium">Enable Push Notifications</p>
                <p className="text-[10px] text-muted-foreground">Allow browser push notifications</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>

            <button
              onClick={handleChangePassword}
              className="w-full flex items-center gap-3 p-3 rounded-xl border border-border bg-card transition hover:bg-muted/50"
            >
              <div className="h-9 w-9 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <Lock className="h-4 w-4 text-purple-500" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-medium">Change Password</p>
                <p className="text-[10px] text-muted-foreground">Update your account password</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>

            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-3 p-3 rounded-xl border border-destructive/20 bg-destructive/5 transition hover:bg-destructive/10"
            >
              <div className="h-9 w-9 rounded-lg bg-destructive/10 flex items-center justify-center">
                <LogOut className="h-4 w-4 text-destructive" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-medium text-destructive">Sign Out</p>
                <p className="text-[10px] text-destructive/70">Log out of your account</p>
              </div>
            </button>
          </div>
        </div>
      </main>
      <BottomNav />
      <ChangePasswordModal open={showChangePassword} onClose={() => setShowChangePassword(false)} />
    </div>
  );
}
