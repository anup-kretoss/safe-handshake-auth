import { getPasswordStrength } from '@/lib/validators';

export default function PasswordStrengthBar({ password }: { password: string }) {
  if (!password) return null;

  const { score, label, color } = getPasswordStrength(password);
  const percentage = (score / 6) * 100;

  return (
    <div className="space-y-1.5">
      <div className="h-1.5 w-full rounded-full bg-muted">
        <div
          className={`password-strength-bar ${color}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Strength: <span className="font-medium">{label}</span>
      </p>
    </div>
  );
}
