import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { forgotPasswordSchema, type ForgotPasswordFormData } from '@/lib/validators';
import { supabase } from '@/integrations/supabase/client';
import AuthBrandPanel from '@/components/AuthBrandPanel';
import { ArrowLeft, Mail, Loader2 } from 'lucide-react';
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

      if (error) {
        toast.error(error.message);
        return;
      }

      setSent(true);
      toast.success('Check your email for a reset link.');
    } catch {
      toast.error('Something went wrong.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <AuthBrandPanel />
      <div className="auth-panel">
        <div className="auth-card animate-fade-in">
          <div>
            <Link to="/login" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6">
              <ArrowLeft className="h-4 w-4" /> Back to sign in
            </Link>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Forgot password?</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Enter your email and we'll send you a reset link.
            </p>
          </div>

          {sent ? (
            <div className="rounded-lg border border-border bg-muted/50 p-6 text-center space-y-3">
              <Mail className="h-10 w-10 mx-auto text-primary" />
              <p className="text-sm text-muted-foreground">
                We've sent a password reset link to your email. Please check your inbox.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <input {...register('email')} type="email" placeholder="Email address" className="auth-input w-full" />
                {errors.email && <p className="mt-1 text-xs text-destructive">{errors.email.message}</p>}
              </div>

              <button type="submit" disabled={isLoading} className="auth-btn flex items-center justify-center gap-2">
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                {isLoading ? 'Sending...' : 'Send reset link'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
