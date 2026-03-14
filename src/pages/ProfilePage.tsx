import { useAuth } from '@/context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, User, Mail, Phone, Calendar, LogOut, ChevronRight, ShoppingBag, Bell, Lock } from 'lucide-react';
import BottomNav from '@/components/BottomNav';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export default function ProfilePage() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const handleChangePassword = async () => {
    const oldPassword = prompt('Enter current password:');
    if (!oldPassword) return;
    const newPassword = prompt('Enter new password (min 6 chars):');
    if (!newPassword || newPassword.length < 6) {
      if (newPassword) toast.error('Password too short');
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('change-password', {
        method: 'POST',
        body: { old_password: oldPassword, new_password: newPassword }
      });
      if (error) throw error;
      toast.success('Password updated successfully');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update password');
    }
  };

  const initials = `${(profile?.first_name || '')[0] || ''}${(profile?.last_name || '')[0] || ''}`.toUpperCase() || 'U';

  const infoItems = [
    { icon: Mail, label: 'Email', value: profile?.email || user?.email || 'Not set' },
    { icon: Phone, label: 'Phone', value: profile?.country_code && profile?.phone_number ? `${profile.country_code} ${profile.phone_number}` : 'Not set' },
    { icon: Calendar, label: 'Date of Birth', value: profile?.date_of_birth ? new Date(profile.date_of_birth).toLocaleDateString() : 'Not set' },
    { icon: User, label: 'Gender', value: profile?.gender || 'Not set' },
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
          <div className="h-20 w-20 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-2xl font-bold">
            {initials}
          </div>
          <div className="text-center">
            <h2 className="text-lg font-bold text-foreground">{profile?.first_name} {profile?.last_name}</h2>
            <p className="text-sm text-muted-foreground">{profile?.email || user?.email}</p>
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
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">Settings</h3>
          <div className="p-3 rounded-xl border border-border bg-card space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Bell className="h-4 w-4 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm font-medium">Push Notifications</p>
                  <p className="text-[10px] text-muted-foreground">Receive alerts on your device</p>
                </div>
              </div>
              <input type="checkbox" defaultChecked className="h-5 w-5 accent-primary" />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <Mail className="h-4 w-4 text-green-500" />
                </div>
                <div>
                  <p className="text-sm font-medium">Email Alerts</p>
                  <p className="text-[10px] text-muted-foreground">Receive status updates via email</p>
                </div>
              </div>
              <input type="checkbox" defaultChecked className="h-5 w-5 accent-primary" />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">Account</h3>
          <div className="space-y-2">
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
    </div>
  );
}
