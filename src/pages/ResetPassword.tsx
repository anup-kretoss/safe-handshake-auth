import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { resetPasswordSchema, type ResetPasswordFormData } from '@/lib/validators';
import { supabase } from '@/integrations/supabase/client';
import AuthBrandPanel from '@/components/AuthBrandPanel';
import PasswordStrengthBar from '@/components/PasswordStrengthBar';
import { Eye, EyeOff, KeyRound, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);

  const { register, handleSubmit, watch, formState: { errors } } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
  });

  const password = watch('password', '');

  useEffect(() => {
    // Check for recovery token in URL hash
    const hash = window.location.hash;
    if (hash.includes('type=recovery')) {
      setIsRecovery(true);
    }

    supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsRecovery(true);
      }
    });
  }, []);

  const onSubmit = async (data: ResetPasswordFormData) => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: data.password });

      if (error) {
        toast.error(error.message);
        return;
      }

      toast.success('Password updated successfully!');
      navigate('/dashboard');
    } catch {
      toast.error('Something went wrong.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isRecovery) {
    return (
      <div className="auth-container">
        <AuthBrandPanel />
        <div className="auth-panel">
          <div className="auth-card animate-fade-in text-center">
            <h1 className="text-2xl font-bold text-foreground">Invalid reset link</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              This link is invalid or expired. Please request a new one.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <AuthBrandPanel />
      <div className="auth-panel">
        <div className="auth-card animate-fade-in">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Set new password</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Enter your new password below.
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <div className="relative">
                <input
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="New password"
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
              <div className="relative">
                <input
                  {...register('confirmPassword')}
                  type={showConfirm ? 'text' : 'password'}
                  placeholder="Confirm new password"
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
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
              {isLoading ? 'Updating...' : 'Update password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
