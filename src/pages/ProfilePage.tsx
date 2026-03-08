import { useAuth } from '@/context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, User, Mail, Phone, Calendar, LogOut, ChevronRight } from 'lucide-react';
import BottomNav from '@/components/BottomNav';

export default function ProfilePage() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
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

        {/* Actions */}
        <div className="space-y-2 pt-4">
          <Link
            to="/dashboard"
            className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card"
          >
            <div className="h-9 w-9 rounded-lg bg-secondary flex items-center justify-center">
              <User className="h-4 w-4 text-foreground" />
            </div>
            <span className="text-sm font-medium text-foreground">Edit Profile</span>
            <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" />
          </Link>

          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 p-3 rounded-xl border border-destructive/20 bg-destructive/5"
          >
            <div className="h-9 w-9 rounded-lg bg-destructive/10 flex items-center justify-center">
              <LogOut className="h-4 w-4 text-destructive" />
            </div>
            <span className="text-sm font-medium text-destructive">Sign Out</span>
          </button>
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
