import { useState, useEffect, useMemo } from 'react';
import { Lock, Eye, EyeOff, Fingerprint } from 'lucide-react';
import cerberusLogo from '@/assets/cerberus-logo.png';
import ngfLogo from '@/assets/ngf-logo.png';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { hashMasterPassword, verifyMasterPassword } from '@/lib/crypto';
import { getMasterHash, setMasterHash } from '@/lib/vault-store';
import { isBiometricSupported, isBiometricEnabled, authenticateWithBiometric } from '@/lib/biometric';
import { useToast } from '@/hooks/use-toast';
import MatrixBackground from '@/components/MatrixBackground';

interface VaultLockProps {
  onUnlock: (masterPassword: string) => void;
}

const useTypewriter = (text: string, speed = 45, loop = false, loopDelay = 2000) => {
  const [displayed, setDisplayed] = useState('');

  useEffect(() => {
    setDisplayed('');
    let i = 0;
    let phase: 'typing' | 'waiting' | 'erasing' = 'typing';
    let timeout: ReturnType<typeof setTimeout>;

    const tick = () => {
      if (phase === 'typing') {
        i++;
        setDisplayed(text.slice(0, i));
        if (i >= text.length) {
          if (loop) {
            phase = 'waiting';
            timeout = setTimeout(tick, loopDelay);
          }
          return;
        }
        timeout = setTimeout(tick, speed);
      } else if (phase === 'waiting') {
        phase = 'erasing';
        timeout = setTimeout(tick, speed / 2);
      } else if (phase === 'erasing') {
        i--;
        setDisplayed(text.slice(0, i));
        if (i <= 0) {
          phase = 'typing';
          timeout = setTimeout(tick, speed * 3);
          return;
        }
        timeout = setTimeout(tick, speed / 2);
      }
    };

    timeout = setTimeout(tick, speed * 3);
    return () => clearTimeout(timeout);
  }, [text, speed, loop, loopDelay]);

  return displayed;
};

const VaultParticles = () => {
  const particles = useMemo(() => 
    Array.from({ length: 40 }, (_, i) => ({
      id: i,
      x: 50 + (Math.random() - 0.5) * 10,
      angle: Math.random() * 360,
      speed: 0.5 + Math.random() * 2,
      size: 2 + Math.random() * 4,
      delay: Math.random() * 0.8,
      duration: 1 + Math.random() * 1.2,
      opacity: 0.4 + Math.random() * 0.6,
    })),
  []);

  return (
    <div className="fixed inset-0 z-35 pointer-events-none overflow-hidden">
      {particles.map(p => {
        const rad = (p.angle * Math.PI) / 180;
        const dx = Math.cos(rad) * p.speed * 300;
        const dy = Math.sin(rad) * p.speed * 300;
        return (
          <div
            key={p.id}
            className="absolute rounded-full"
            style={{
              left: `${p.x}%`,
              top: '50%',
              width: p.size,
              height: p.size,
              background: `hsl(var(--primary))`,
              boxShadow: `0 0 ${p.size * 2}px hsl(var(--primary) / 0.8)`,
              opacity: 0,
              animation: `vault-particle ${p.duration}s ease-out ${p.delay}s forwards`,
              '--dx': `${dx}px`,
              '--dy': `${dy}px`,
              '--p-opacity': p.opacity,
            } as React.CSSProperties}
          />
        );
      })}
    </div>
  );
};

const VaultLock = ({ onUnlock }: VaultLockProps) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'shake' | 'doors' | 'burst'>('idle');
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const { toast } = useToast();

  const isNewVault = !getMasterHash();
  const fullText = isNewVault ? 'Crie sua senha mestra para começar' : 'Digite a senha mestra para desbloquear!';
  const typedSubtitle = useTypewriter(fullText, 45, true, 2000);

  useEffect(() => {
    // Check if biometric is available and enabled
    if (!isNewVault && isBiometricSupported() && isBiometricEnabled()) {
      setBiometricAvailable(true);
    }
  }, [isNewVault]);

  const playUnlockSequence = (pwd: string) => {
    new Audio('/sounds/rugido-dragao.mp3').play().catch(() => {});
    setPhase('shake');
    setTimeout(() => setPhase('doors'), 600);
    setTimeout(() => setPhase('burst'), 1100);
    setTimeout(() => onUnlock(pwd), 2400);
  };

  const handleBiometricUnlock = async () => {
    if (loading || phase !== 'idle') return;
    setLoading(true);
    try {
      const pw = await authenticateWithBiometric();
      if (pw) {
        // Verify the password is still valid
        const hash = getMasterHash()!;
        const valid = await verifyMasterPassword(pw, hash);
        if (valid) {
          playUnlockSequence(pw);
          return;
        }
      }
      toast({ title: 'Biometria falhou', description: 'Use a senha mestra.', variant: 'destructive' });
    } catch {
      toast({ title: 'Erro na biometria', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || phase !== 'idle') return;

    setLoading(true);
    try {
      if (isNewVault) {
        if (password.length < 8) {
          toast({ title: 'Senha fraca', description: 'A senha mestra deve ter pelo menos 8 caracteres.', variant: 'destructive' });
          setLoading(false);
          return;
        }
        if (password !== confirmPassword) {
          toast({ title: 'Senhas não coincidem', description: 'Confirme sua senha mestra.', variant: 'destructive' });
          setLoading(false);
          return;
        }
        const hash = await hashMasterPassword(password);
        setMasterHash(hash);
        toast({ title: 'Cofre criado!', description: 'Sua senha mestra foi configurada.' });
        playUnlockSequence(password);
      } else {
        const hash = getMasterHash()!;
        const valid = await verifyMasterPassword(password, hash);
        if (valid) {
          playUnlockSequence(password);
        } else {
          new Audio('/sounds/rugido-de-bestia.mp3').play().catch(() => {});
          toast({ title: 'Senha incorreta', description: 'Tente novamente.', variant: 'destructive' });
          setLoading(false);
        }
      }
    } catch {
      toast({ title: 'Erro', description: 'Algo deu errado.', variant: 'destructive' });
      setLoading(false);
    }
  };

  const isUnlocking = phase !== 'idle';

  return (
    <div className={`h-screen flex items-center justify-center p-4 relative overflow-hidden ${phase === 'shake' ? 'vault-shake' : ''}`}>
      <MatrixBackground />

      {/* Vault doors */}
      {isUnlocking && (
        <>
          {/* Left door */}
          <div
            className={`fixed inset-y-0 left-0 w-1/2 z-30 ${phase === 'doors' || phase === 'burst' ? 'vault-door-left-anim' : ''}`}
            style={{
              background: 'linear-gradient(90deg, hsl(220 18% 6%), hsl(220 18% 10%))',
              borderRight: '4px solid hsl(var(--primary) / 0.3)',
              transformOrigin: 'left center',
            }}
          >
            {/* Vault door details - bolts and handle */}
            <div className="absolute right-8 top-1/4 w-4 h-4 rounded-full border-2 border-primary/20 bg-primary/5" />
            <div className="absolute right-8 bottom-1/4 w-4 h-4 rounded-full border-2 border-primary/20 bg-primary/5" />
            <div className="absolute right-8 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full border-2 border-primary/30 bg-primary/10" />
            <div className="absolute right-5 top-1/2 -translate-y-1/2 w-2 h-20 rounded-full bg-primary/10" />
            {/* Horizontal bars */}
            <div className="absolute right-6 top-[35%] w-12 h-[2px] bg-primary/10" />
            <div className="absolute right-6 top-[65%] w-12 h-[2px] bg-primary/10" />
          </div>

          {/* Right door */}
          <div
            className={`fixed inset-y-0 right-0 w-1/2 z-30 ${phase === 'doors' || phase === 'burst' ? 'vault-door-right-anim' : ''}`}
            style={{
              background: 'linear-gradient(-90deg, hsl(220 18% 6%), hsl(220 18% 10%))',
              borderLeft: '4px solid hsl(var(--primary) / 0.3)',
              transformOrigin: 'right center',
            }}
          >
            <div className="absolute left-8 top-1/4 w-4 h-4 rounded-full border-2 border-primary/20 bg-primary/5" />
            <div className="absolute left-8 bottom-1/4 w-4 h-4 rounded-full border-2 border-primary/20 bg-primary/5" />
            <div className="absolute left-8 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full border-2 border-primary/30 bg-primary/10" />
            <div className="absolute left-5 top-1/2 -translate-y-1/2 w-2 h-20 rounded-full bg-primary/10" />
            <div className="absolute left-6 top-[35%] w-12 h-[2px] bg-primary/10" />
            <div className="absolute left-6 top-[65%] w-12 h-[2px] bg-primary/10" />
          </div>

          {/* Particles */}
          {(phase === 'doors' || phase === 'burst') && <VaultParticles />}

          {/* Center light beam */}
          {(phase === 'doors' || phase === 'burst') && (
            <div
              className="fixed top-0 bottom-0 left-1/2 -translate-x-1/2 z-35 vault-center-light pointer-events-none"
              style={{
                background: 'linear-gradient(180deg, transparent, hsl(var(--primary) / 0.8), transparent)',
                height: '100vh',
              }}
            />
          )}

          {/* Radial glow burst */}
          {phase === 'burst' && (
            <div
              className="fixed inset-0 z-40 vault-glow-burst pointer-events-none flex items-center justify-center"
            >
              <div
                className="w-[600px] h-[600px] rounded-full"
                style={{
                  background: 'radial-gradient(circle, hsl(var(--primary) / 0.7) 0%, hsl(var(--primary) / 0.3) 30%, transparent 70%)',
                }}
              />
            </div>
          )}

          {/* White flash at the end */}
          {phase === 'burst' && (
            <div
              className="fixed inset-0 z-50 pointer-events-none"
              style={{
                animation: 'vault-white-flash 1s ease-in forwards',
                animationDelay: '0.8s',
                opacity: 0,
                background: 'hsl(152 60% 95%)',
              }}
            />
          )}
        </>
      )}

      <div className={`w-full max-w-md animate-vault-unlock relative z-10 flex flex-col items-center ${isUnlocking ? 'vault-form-shrink' : ''}`}>
        <div className="flex flex-col items-center mb-8">
          <div className="mb-2 animate-logo-pulse">
            <img
              src={cerberusLogo}
              alt="Cerberus"
              className="w-28 h-28 object-contain drop-shadow-[0_0_15px_hsl(152,60%,45%)] drop-shadow-[0_0_30px_hsl(152,60%,45%)]"
              style={{ filter: 'drop-shadow(0 0 12px hsl(152 60% 45% / 0.6)) drop-shadow(0 0 25px hsl(152 60% 45% / 0.3))' }}
            />
          </div>
          <h1 className="text-3xl font-bold vault-text-gradient animate-scale-in" style={{ fontFamily: "'Cinzel Decorative', serif" }}>
            CERBERUS
          </h1>
          <p className="text-muted-foreground mt-2 text-sm font-mono h-5">
            {typedSubtitle}<span className="animate-pulse">|</span>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 w-full">
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type={showPassword ? 'text' : 'password'}
              placeholder="Senha mestra"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-10 pr-10 h-12 bg-vault-surface border-border focus:border-primary font-mono"
              autoFocus
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {isNewVault && (
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type={showPassword ? 'text' : 'password'}
                placeholder="Confirmar senha mestra"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="pl-10 h-12 bg-vault-surface border-border focus:border-primary font-mono"
              />
            </div>
          )}

          <Button
            type="submit"
            className="w-full h-12 text-base font-semibold transition-all duration-300 hover:scale-[1.03] hover:shadow-[0_0_20px_hsl(152_60%_45%/0.4)] active:scale-95"
            disabled={loading || isUnlocking}
          >
            {loading ? (
              <span className="animate-vault-pulse">Processando...</span>
            ) : isNewVault ? (
              'Criar Cofre'
            ) : (
              'Desbloquear'
            )}
          </Button>

          {/* Biometric button */}
          {biometricAvailable && !isNewVault && (
            <Button
              type="button"
              variant="outline"
              className="w-full h-12 text-base font-semibold gap-2 border-primary/30 hover:border-primary hover:bg-primary/5"
              onClick={handleBiometricUnlock}
              disabled={loading || isUnlocking}
            >
              <Fingerprint className="w-5 h-5" />
              Desbloquear com biometria
            </Button>
          )}
        </form>

        <p className="text-center text-muted-foreground text-xs mt-6">
          Criptografia AES-256 · PBKDF2 · Zero-knowledge
        </p>

        <div className="mt-8 opacity-70 hover:opacity-100 transition-opacity duration-300">
          <img
            src={ngfLogo}
            alt="NGF Soluções em Tecnologia"
            className="h-10 object-contain brightness-0 invert"
          />
        </div>
      </div>
    </div>
  );
};

export default VaultLock;
