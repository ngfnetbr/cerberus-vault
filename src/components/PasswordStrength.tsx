interface PasswordStrengthProps {
  password: string;
}

function getStrength(password: string): { score: number; label: string; color: string } {
  if (!password) return { score: 0, label: '', color: '' };

  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (password.length >= 16) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;

  if (score <= 2) return { score: Math.min(score, 2), label: 'Fraca', color: 'bg-destructive' };
  if (score <= 3) return { score: 3, label: 'Razoável', color: 'bg-vault-warning' };
  if (score <= 4) return { score: 4, label: 'Boa', color: 'bg-primary/70' };
  return { score: 5, label: 'Forte', color: 'bg-primary' };
}

const PasswordStrength = ({ password }: PasswordStrengthProps) => {
  const { score, label, color } = getStrength(password);
  if (!password) return null;

  const maxBars = 5;

  return (
    <div className="flex items-center gap-2 mt-1.5">
      <div className="flex gap-1 flex-1">
        {Array.from({ length: maxBars }).map((_, i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-all duration-300 ${
              i < score ? color : 'bg-border'
            }`}
          />
        ))}
      </div>
      <span className={`text-xs font-mono ${score <= 2 ? 'text-destructive' : score <= 3 ? 'text-vault-warning' : 'text-primary'}`}>
        {label}
      </span>
    </div>
  );
};

export default PasswordStrength;
