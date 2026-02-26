import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { forgotPasswordSchema, type ForgotPasswordFormData } from '@/lib/validators';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, Mail, Loader2, Shield } from 'lucide-react';
import { toast } from 'sonner';

export default function ForgotPassword() {
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onSubmit = async (data: ForgotPasswordFormData) => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) { toast.error(error.message); return; }
      setSent(true);
      toast.success('Check your email for a reset link.');
    } catch {
      toast.error('Something went wrong.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-6 animate-fade-in">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Forgot password?</h1>
            <p className="mt-1 text-sm text-muted-foreground">Enter your email and we'll send a reset link.</p>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          {sent ? (
            <div className="text-center space-y-3 py-4">
              <Mail className="h-10 w-10 mx-auto text-primary" />
              <p className="text-sm text-muted-foreground">We've sent a reset link to your email. Check your inbox.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Email</label>
                <input {...register('email')} type="email" placeholder="john@example.com" className="auth-input w-full" />
                {errors.email && <p className="mt-1 text-xs text-destructive">{errors.email.message}</p>}
              </div>
              <button type="submit" disabled={isLoading} className="auth-btn flex items-center justify-center gap-2">
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                {isLoading ? 'Sending...' : 'Send reset link'}
              </button>
            </form>
          )}
          <div className="mt-4 text-center">
            <Link to="/login" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-3 w-3" /> Back to sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
