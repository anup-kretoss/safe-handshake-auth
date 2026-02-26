import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { updateProfileSchema, type UpdateProfileFormData } from '@/lib/validators';
import { supabase } from '@/integrations/supabase/client';
import CountryCodeSelect from '@/components/CountryCodeSelect';
import { User, LogOut, Save, Loader2, X, Mail, Phone, Calendar } from 'lucide-react';
import { toast } from 'sonner';

export default function ProfileDropdown() {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<UpdateProfileFormData>({
    resolver: zodResolver(updateProfileSchema),
    values: {
      firstName: profile?.first_name || '',
      lastName: profile?.last_name || '',
      dateOfBirth: profile?.date_of_birth || '',
      countryCode: profile?.country_code || '',
      phoneNumber: profile?.phone_number || '',
    },
  });

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setEditing(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const onSubmit = async (data: UpdateProfileFormData) => {
    if (!user) return;
    setSaving(true);
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
      setEditing(false);
      toast.success('Profile updated!');
    } catch {
      toast.error('Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  const initials = `${(profile?.first_name || '')[0] || ''}${(profile?.last_name || '')[0] || ''}`.toUpperCase() || 'U';

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => { setOpen(!open); if (!open) setEditing(false); }}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-semibold transition hover:opacity-90"
      >
        {initials}
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-50 w-80 rounded-xl border border-border bg-card shadow-lg animate-fade-in">
          {editing ? (
            <form onSubmit={handleSubmit(onSubmit)} className="p-4 space-y-3">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-sm font-semibold text-foreground">Edit Profile</h3>
                <button type="button" onClick={() => setEditing(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">First Name</label>
                  <input {...register('firstName')} className="auth-input w-full h-9 text-xs" />
                  {errors.firstName && <p className="text-xs text-destructive">{errors.firstName.message}</p>}
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Last Name</label>
                  <input {...register('lastName')} className="auth-input w-full h-9 text-xs" />
                  {errors.lastName && <p className="text-xs text-destructive">{errors.lastName.message}</p>}
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Date of Birth</label>
                <input {...register('dateOfBirth')} type="date" className="auth-input w-full h-9 text-xs" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Phone</label>
                <div className="grid grid-cols-5 gap-2">
                  <div className="col-span-2">
                    <CountryCodeSelect
                      value={watch('countryCode') || ''}
                      onChange={(v) => setValue('countryCode', v)}
                      className="h-9 text-xs"
                    />
                  </div>
                  <div className="col-span-3">
                    <input {...register('phoneNumber')} type="tel" placeholder="Phone" className="auth-input w-full h-9 text-xs" />
                  </div>
                </div>
              </div>
              <button type="submit" disabled={saving} className="auth-btn h-9 flex items-center justify-center gap-2 text-xs">
                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                {saving ? 'Saving...' : 'Save'}
              </button>
            </form>
          ) : (
            <div className="p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">
                    {profile?.first_name} {profile?.last_name}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{profile?.email || user?.email}</p>
                </div>
              </div>

              <div className="space-y-2 pt-1">
                <InfoItem icon={Calendar} label="Date of Birth" value={profile?.date_of_birth ? new Date(profile.date_of_birth).toLocaleDateString() : 'Not set'} />
                <InfoItem icon={Phone} label="Phone" value={profile?.country_code && profile?.phone_number ? `${profile.country_code} ${profile.phone_number}` : 'Not set'} />
              </div>

              <div className="border-t border-border pt-3 flex gap-2">
                <button
                  onClick={() => setEditing(true)}
                  className="flex-1 h-8 rounded-lg border border-border text-xs font-medium text-foreground transition hover:bg-muted"
                >
                  Edit Profile
                </button>
                <button
                  onClick={() => { signOut(); setOpen(false); }}
                  className="flex items-center gap-1.5 h-8 rounded-lg px-3 text-xs font-medium text-destructive transition hover:bg-destructive/10"
                >
                  <LogOut className="h-3 w-3" />
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function InfoItem({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      <span className="text-xs text-muted-foreground">{label}:</span>
      <span className="text-xs font-medium text-foreground">{value}</span>
    </div>
  );
}
