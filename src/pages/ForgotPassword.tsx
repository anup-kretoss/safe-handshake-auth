import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { forgotPasswordSchema, type ForgotPasswordFormData } from '@/lib/validators';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, Mail, Loader2, Shield, KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';

type Step = 'email' | 'otp' | 'newPassword';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('email');
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  const { register, handleSubmit, formState: { errors } } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const sendOtp = useCallback(async (emailAddr: string) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-otp', {
        body: { email: emailAddr },
      });
      if (error) { toast.error('Failed to send OTP'); return false; }
      if (!data.success) { toast.error(data.message); return false; }
      toast.success('OTP sent to your email!');
      return true;
    } catch {
      toast.error('Something went wrong.');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const onSubmitEmail = async (data: ForgotPasswordFormData) => {
    setEmail(data.email);
    const sent = await sendOtp(data.email);
    if (sent) {
      setStep('otp');
      setResendCooldown(30);
    }
  };

  const onResend = async () => {
    if (resendCooldown > 0) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('resend-otp', {
        body: { email },
      });
      if (error) { toast.error('Failed to resend OTP'); return; }
      if (!data.success) { toast.error(data.message); return; }
      toast.success('OTP resent to your email!');
      setResendCooldown(30);
    } catch {
      toast.error('Something went wrong.');
    } finally {
      setIsLoading(false);
    }
  };

  const onVerifyOtp = async () => {
    if (otp.length !== 4) { toast.error('Please enter the 4-digit OTP'); return; }
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('verify-otp', {
        body: { email, otp },
      });
      if (error || !data.success) { toast.error(data?.message || 'Invalid OTP'); return; }
      setResetToken(data.reset_token);
      setStep('newPassword');
      toast.success('OTP verified!');
    } catch {
      toast.error('Something went wrong.');
    } finally {
      setIsLoading(false);
    }
  };

  const onResetPassword = async () => {
    if (newPassword.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    if (newPassword !== confirmPassword) { toast.error('Passwords do not match'); return; }
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('reset-password-otp', {
        body: { email, reset_token: resetToken, new_password: newPassword },
      });
      if (error || !data.success) { toast.error(data?.message || 'Failed to reset password'); return; }
      toast.success('Password updated successfully!');
      navigate('/login');
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
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {step === 'email' && 'Forgot password?'}
              {step === 'otp' && 'Enter OTP'}
              {step === 'newPassword' && 'Set new password'}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {step === 'email' && "Enter your email and we'll send a 4-digit OTP."}
              {step === 'otp' && `We've sent a 4-digit code to ${email}`}
              {step === 'newPassword' && 'Enter your new password below.'}
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          {/* Step 1: Email */}
          {step === 'email' && (
            <form onSubmit={handleSubmit(onSubmitEmail)} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Email</label>
                <input {...register('email')} type="email" placeholder="john@example.com" className="auth-input w-full" />
                {errors.email && <p className="mt-1 text-xs text-destructive">{errors.email.message}</p>}
              </div>
              <button type="submit" disabled={isLoading} className="auth-btn flex items-center justify-center gap-2">
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                {isLoading ? 'Sending...' : 'Send OTP'}
              </button>
            </form>
          )}

          {/* Step 2: OTP */}
          {step === 'otp' && (
            <div className="space-y-4">
              <div className="flex justify-center">
                <InputOTP maxLength={4} value={otp} onChange={setOtp}>
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                  </InputOTPGroup>
                </InputOTP>
              </div>
              <button onClick={onVerifyOtp} disabled={isLoading || otp.length !== 4} className="auth-btn flex items-center justify-center gap-2 w-full">
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                {isLoading ? 'Verifying...' : 'Verify OTP'}
              </button>
              <div className="text-center">
                <button
                  type="button"
                  onClick={onResend}
                  disabled={resendCooldown > 0 || isLoading}
                  className="text-sm text-primary hover:underline disabled:text-muted-foreground disabled:no-underline"
                >
                  {resendCooldown > 0 ? `Resend OTP in ${resendCooldown}s` : 'Resend OTP'}
                </button>
              </div>
            </div>
          )}

          {/* Step 3: New Password */}
          {step === 'newPassword' && (
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min 8 characters"
                  className="auth-input w-full"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Confirm Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat password"
                  className="auth-input w-full"
                />
              </div>
              <button onClick={onResetPassword} disabled={isLoading} className="auth-btn flex items-center justify-center gap-2 w-full">
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                {isLoading ? 'Updating...' : 'Update password'}
              </button>
            </div>
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
