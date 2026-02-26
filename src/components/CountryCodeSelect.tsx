import { countries } from '@/lib/countries';

interface Props {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export default function CountryCodeSelect({ value, onChange, className }: Props) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className={`auth-input appearance-none bg-card ${className || ''}`}
    >
      <option value="">Code</option>
      {countries.map(c => (
        <option key={c.code} value={c.dialCode}>
          {c.flag} {c.dialCode} {c.name}
        </option>
      ))}
    </select>
  );
}
