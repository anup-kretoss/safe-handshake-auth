import { useAuth } from '@/context/AuthContext';
import ProfileDropdown from '@/components/ProfileDropdown';
import { Shield } from 'lucide-react';

export default function Dashboard() {
  const { profile } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Shield className="h-4 w-4 text-primary" />
            </div>
            <span className="font-semibold text-foreground text-sm">Home</span>
          </div>
          <ProfileDropdown />
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="animate-fade-in space-y-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Welcome, {profile?.first_name || 'User'} 👋
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              You're logged in. Click your profile icon in the top right to view or edit your details.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard title="Status" value="Active" />
            <StatCard title="Account" value="Verified" />
            <StatCard title="Notifications" value="Enabled" />
          </div>
        </div>
      </main>
    </div>
  );
}

function StatCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <p className="text-xs font-medium text-muted-foreground">{title}</p>
      <p className="mt-1 text-lg font-semibold text-foreground">{value}</p>
    </div>
  );
}
