import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { updateProfileSchema, type UpdateProfileFormData } from '@/lib/validators';
import { supabase } from '@/integrations/supabase/client';
import CountryCodeSelect from '@/components/CountryCodeSelect';
import { LogOut, User, Save, Loader2, Shield, Calendar, Phone, Mail } from 'lucide-react';
import { toast } from 'sonner';

export default function Dashboard() {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<UpdateProfileFormData>({
    resolver: zodResolver(updateProfileSchema),
    values: {
      firstName: profile?.first_name || '',
      lastName: profile?.last_name || '',
      dateOfBirth: profile?.date_of_birth || '',
      countryCode: profile?.country_code || '',
      phoneNumber: profile?.phone_number || '',
    },
  });

  const onSubmit = async (data: UpdateProfileFormData) => {
    if (!user) return;
    setIsSaving(true);
    try {
      const { error } = await supabase.from('profiles').update({
        first_name: data.firstName,
        last_name: data.lastName,
        date_of_birth: data.dateOfBirth || null,
        country_code: data.countryCode || null,
        phone_number: data.phoneNumber || null,
      }).eq('user_id', user.id);

      if (error) {
        toast.error(error.message);
        return;
      }

      await refreshProfile();
      setIsEditing(false);
      toast.success('Profile updated!');
    } catch {
      toast.error('Failed to update profile.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <span className="font-semibold text-foreground">Dashboard</span>
          </div>
          <button
            onClick={signOut}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-10">
        <div className="animate-fade-in space-y-8">
          {/* Welcome */}
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Welcome, {profile?.first_name || 'User'}
            </h1>
            <p className="mt-1 text-muted-foreground">Manage your account and profile settings.</p>
          </div>

          {/* Profile Card */}
          <div className="rounded-xl border border-border bg-card p-6 sm:p-8">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <User className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Profile Information</h2>
                  <p className="text-sm text-muted-foreground">Your personal details</p>
                </div>
              </div>
              {!isEditing && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition hover:bg-muted"
                >
                  Edit
                </button>
              )}
            </div>

            {isEditing ? (
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-foreground">First Name</label>
                    <input {...register('firstName')} className="auth-input w-full" />
                    {errors.firstName && <p className="mt-1 text-xs text-destructive">{errors.firstName.message}</p>}
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-foreground">Last Name</label>
                    <input {...register('lastName')} className="auth-input w-full" />
                    {errors.lastName && <p className="mt-1 text-xs text-destructive">{errors.lastName.message}</p>}
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">Date of Birth</label>
                  <input {...register('dateOfBirth')} type="date" className="auth-input w-full" />
                </div>

                <div className="grid grid-cols-5 gap-3">
                  <div className="col-span-2">
                    <label className="mb-1.5 block text-sm font-medium text-foreground">Country</label>
                    <CountryCodeSelect
                      value={watch('countryCode') || ''}
                      onChange={(v) => setValue('countryCode', v)}
                    />
                  </div>
                  <div className="col-span-3">
                    <label className="mb-1.5 block text-sm font-medium text-foreground">Phone</label>
                    <input {...register('phoneNumber')} type="tel" className="auth-input w-full" />
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button type="submit" disabled={isSaving} className="auth-btn flex items-center justify-center gap-2 max-w-xs">
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {isSaving ? 'Saving...' : 'Save changes'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="auth-btn-outline max-w-xs"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <InfoRow icon={User} label="Name" value={`${profile?.first_name || ''} ${profile?.last_name || ''}`} />
                <InfoRow icon={Mail} label="Email" value={profile?.email || user?.email || ''} />
                <InfoRow icon={Calendar} label="Date of Birth" value={profile?.date_of_birth || 'Not set'} />
                <InfoRow icon={Phone} label="Phone" value={profile?.country_code && profile?.phone_number ? `${profile.country_code} ${profile.phone_number}` : 'Not set'} />
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 rounded-lg bg-muted/50 p-4">
      <Icon className="mt-0.5 h-4 w-4 text-muted-foreground" />
      <div>
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="mt-0.5 text-sm font-medium text-foreground">{value}</p>
      </div>
    </div>
  );
}
