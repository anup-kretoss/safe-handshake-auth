import { Shield, Lock, Zap } from 'lucide-react';

export default function AuthBrandPanel() {
  return (
    <div className="auth-brand-panel">
      {/* Floating orbs */}
      <div className="absolute top-20 left-20 w-72 h-72 rounded-full bg-primary/10 blur-3xl animate-float" />
      <div className="absolute bottom-32 right-16 w-96 h-96 rounded-full bg-accent/10 blur-3xl animate-float" style={{ animationDelay: '-3s' }} />

      <div className="relative z-10 max-w-md space-y-8">
        <div className="glass-card p-8 space-y-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <h2 className="text-xl font-bold text-primary-foreground">Secure Platform</h2>
          </div>
          <p className="text-sm leading-relaxed" style={{ color: 'hsl(0 0% 100% / 0.7)' }}>
            Enterprise-grade authentication with end-to-end encryption, JWT tokens, and row-level security.
          </p>

          <div className="space-y-4 pt-2">
            <Feature icon={Lock} text="JWT-based authentication" />
            <Feature icon={Shield} text="Row-level security policies" />
            <Feature icon={Zap} text="Real-time push notifications" />
          </div>
        </div>
      </div>
    </div>
  );
}

function Feature({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: 'hsl(0 0% 100% / 0.1)' }}>
        <Icon className="h-4 w-4 text-accent" />
      </div>
      <span className="text-sm font-medium" style={{ color: 'hsl(0 0% 100% / 0.8)' }}>
        {text}
      </span>
    </div>
  );
}
