import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { registerSchema, type RegisterFormData } from '@/lib/validators';
import { supabase } from '@/integrations/supabase/client';
import PasswordStrengthBar from '@/components/PasswordStrengthBar';
import CountryCodeSelect from '@/components/CountryCodeSelect';
import { Eye, EyeOff, UserPlus, Loader2, Shield } from 'lucide-react';
import { toast } from 'sonner';

export default function Register() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: { countryCode: '' },
  });

  const password = watch('password', '');

  const onSubmit = async (data: RegisterFormData) => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          emailRedirectTo: window.location.origin,
          data: {
            first_name: data.firstName,
            last_name: data.lastName,
          },
        },
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      // Update profile with extra fields
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData.session?.user) {
        await supabase.from('profiles').update({
          date_of_birth: data.dateOfBirth,
          country_code: data.countryCode,
          phone_number: data.phoneNumber,
        }).eq('user_id', sessionData.session.user.id);
      }

      toast.success('Account created! Check your email to confirm.');
      navigate('/login');
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-md space-y-6 animate-fade-in">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Create account</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Already have an account?{' '}
              <Link to="/login" className="font-medium text-primary hover:underline">Sign in</Link>
            </p>
          </div>
        </div>

        {/* Form */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">First Name</label>
                <input {...register('firstName')} placeholder="John" className="auth-input w-full" />
                {errors.firstName && <p className="mt-1 text-xs text-destructive">{errors.firstName.message}</p>}
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Last Name</label>
                <input {...register('lastName')} placeholder="Doe" className="auth-input w-full" />
                {errors.lastName && <p className="mt-1 text-xs text-destructive">{errors.lastName.message}</p>}
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Email</label>
              <input {...register('email')} type="email" placeholder="john@example.com" className="auth-input w-full" />
              {errors.email && <p className="mt-1 text-xs text-destructive">{errors.email.message}</p>}
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Date of Birth</label>
              <input {...register('dateOfBirth')} type="date" placeholder="Select date" className="auth-input w-full" />
              {errors.dateOfBirth && <p className="mt-1 text-xs text-destructive">{errors.dateOfBirth.message}</p>}
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Phone Number</label>
              <div className="grid grid-cols-5 gap-2">
                <div className="col-span-2">
                  <CountryCodeSelect
                    value={watch('countryCode')}
                    onChange={(v) => setValue('countryCode', v)}
                  />
                </div>
                <div className="col-span-3">
                  <input {...register('phoneNumber')} type="tel" placeholder="Phone number" className="auth-input w-full" />
                </div>
              </div>
              {errors.countryCode && <p className="mt-1 text-xs text-destructive">{errors.countryCode.message}</p>}
              {errors.phoneNumber && <p className="mt-1 text-xs text-destructive">{errors.phoneNumber.message}</p>}
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Password</label>
              <div className="relative">
                <input
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Min 8 characters"
                  className="auth-input w-full pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <div className="mt-2">
                <PasswordStrengthBar password={password} />
              </div>
              {errors.password && <p className="mt-1 text-xs text-destructive">{errors.password.message}</p>}
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Confirm Password</label>
              <div className="relative">
                <input
                  {...register('confirmPassword')}
                  type={showConfirm ? 'text' : 'password'}
                  placeholder="Repeat password"
                  className="auth-input w-full pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.confirmPassword && <p className="mt-1 text-xs text-destructive">{errors.confirmPassword.message}</p>}
            </div>

            <button type="submit" disabled={isLoading} className="auth-btn flex items-center justify-center gap-2">
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              {isLoading ? 'Creating account...' : 'Create account'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
