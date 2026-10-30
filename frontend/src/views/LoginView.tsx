import React, { useState, useEffect } from 'react';
import {
  Store,
  Lock,
  User,
  ArrowRight,
  Eye,
  EyeOff,
  ShieldCheck,
  RefreshCw,
  ArrowLeft,
  CheckCircle2,
  Clock,
  X,
  AlertCircle
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';

interface LoginViewProps {
  onForgotPassword: () => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onForgotPassword }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rememberMe, setRememberMe] = useState(true);

  // 2FA State
  const [is2FA, setIs2FA] = useState(false);
  const [challengeToken, setChallengeToken] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [trustDevice, setTrustDevice] = useState(true);
  const [verifying2FA, setVerifying2FA] = useState(false);
  const [resendingCode, setResendingCode] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendNotice, setResendNotice] = useState<string | null>(null);

  const { setAuth, sessionExpiredReason, setSessionExpiredReason } = useAuthStore();

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((c) => c - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Username dan password wajib diisi.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const storedDeviceToken = localStorage.getItem('sentosa_device_token') || '';

      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Device-Token': storedDeviceToken,
        },
        body: JSON.stringify({
          username,
          password,
          device_token: storedDeviceToken,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login gagal');

      if (data.require_2fa) {
        setChallengeToken(data.challenge_token);
        setMaskedEmail(data.masked_email || 'email Anda');
        setIs2FA(true);
        setOtpCode('');
        setResendCooldown(60);
      } else {
        setAuth(data.token, data.user, rememberMe);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode || otpCode.trim().length !== 6) {
      setError('Masukkan kode verifikasi 6 digit lengkap.');
      return;
    }

    setVerifying2FA(true);
    setError(null);
    try {
      const userAgentDesc = navigator.userAgent.includes('Windows')
        ? 'Windows PC'
        : navigator.userAgent.includes('Macintosh')
        ? 'Mac'
        : navigator.userAgent.includes('Android')
        ? 'Android Phone'
        : navigator.userAgent.includes('iPhone')
        ? 'iPhone'
        : 'Browser Web';

      const res = await fetch('/api/v1/auth/verify-2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challenge_token: challengeToken,
          code: otpCode.trim(),
          trust_device: trustDevice,
          device_name: `${userAgentDesc} (${window.location.hostname})`,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Verifikasi 2FA gagal');

      if (data.device_token) {
        localStorage.setItem('sentosa_device_token', data.device_token);
      }

      setAuth(data.token, data.user, trustDevice);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setVerifying2FA(false);
    }
  };

  const handleResendCode = async () => {
    if (resendCooldown > 0 || !challengeToken) return;
    setResendingCode(true);
    setError(null);
    setResendNotice(null);
    try {
      const res = await fetch('/api/v1/auth/resend-2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challenge_token: challengeToken }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mengirim ulang kode');

      setResendNotice('Kode verifikasi baru telah dikirim ke email Anda.');
      setResendCooldown(60);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setResendingCode(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#080d14] flex flex-col justify-center items-center p-4 relative overflow-hidden select-none">
      {/* Background Dot Texture */}
      <div className="absolute inset-0 bg-dot-pattern opacity-40 pointer-events-none" />

      <div className="relative z-10 w-full max-w-sm">
        {/* Brand Header */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-3 shadow-md shadow-emerald-950/40">
            <Store className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">Sentosa POS</h1>
          <p className="text-slate-400 text-xs mt-0.5">Platform Manajemen & Kasir Retail SaaS</p>
        </div>

        {/* 2FA Challenge Modal Screen */}
        {is2FA ? (
          <div className="bg-[#0e1520] border border-white/[0.08] rounded-2xl p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white">Verifikasi Dua Faktor (2FA)</h2>
                <span className="text-[10px] text-emerald-400 font-mono font-medium">Perangkat Baru Terdeteksi</span>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              Masukkan kode verifikasi 6 digit yang dikirimkan ke email <strong className="text-white font-mono">{maskedEmail}</strong>.
            </p>

            {error && (
              <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{error}</span>
              </div>
            )}

            {resendNotice && (
              <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>{resendNotice}</span>
              </div>
            )}

            <form onSubmit={handleVerify2FA} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5" htmlFor="2fa-code-input">
                  Kode Verifikasi 6-Digit
                </label>
                <input
                  id="2fa-code-input"
                  type="text"
                  maxLength={6}
                  autoFocus
                  autoComplete="one-time-code"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="000000"
                  className="w-full text-center tracking-[10px] text-2xl font-bold font-mono py-2.5 bg-[#080d15] border border-white/10 focus:border-emerald-500/60 rounded-lg text-white focus:outline-none transition-colors"
                />
              </div>

              {/* 30-day Trusted Device Toggle */}
              <div className="p-3 bg-[#080d15] border border-white/[0.06] rounded-xl flex items-start gap-2.5">
                <input
                  id="trust-device-check"
                  type="checkbox"
                  checked={trustDevice}
                  onChange={(e) => setTrustDevice(e.target.checked)}
                  className="w-4 h-4 mt-0.5 rounded text-emerald-600 bg-[#0e1520] border-white/20 focus:ring-emerald-500 cursor-pointer"
                />
                <label htmlFor="trust-device-check" className="text-xs text-slate-300 leading-tight cursor-pointer">
                  <span className="font-semibold text-white block">Ingat perangkat ini (30 Hari)</span>
                  <span className="text-[11px] text-slate-400">
                    Bebas kode 2FA di perangkat ini selama 30 hari ke depan.
                  </span>
                </label>
              </div>

              <button
                type="submit"
                disabled={verifying2FA || otpCode.length !== 6}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs rounded-lg flex items-center justify-center gap-2 shadow-md shadow-emerald-950/40 transition-colors cursor-pointer"
              >
                {verifying2FA ? <span>Memverifikasi Kode...</span> : <span>Verifikasi & Masuk</span>}
              </button>
            </form>

            <div className="mt-4 pt-3 border-t border-white/[0.07] flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={() => {
                  setIs2FA(false);
                  setError(null);
                }}
                className="text-slate-400 hover:text-white transition-colors flex items-center gap-1 cursor-pointer font-medium"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Ganti Akun</span>
              </button>

              <button
                type="button"
                disabled={resendCooldown > 0 || resendingCode}
                onClick={handleResendCode}
                className="text-emerald-400 hover:text-emerald-300 disabled:text-slate-500 transition-colors flex items-center gap-1 font-semibold cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${resendingCode ? 'animate-spin' : ''}`} />
                <span>
                  {resendCooldown > 0 ? `Kirim ulang (${resendCooldown}s)` : 'Kirim Ulang'}
                </span>
              </button>
            </div>
          </div>
        ) : (
          /* STANDARD LOGIN FORM */
          <div className="bg-[#0e1520] border border-white/[0.08] rounded-2xl p-6 shadow-2xl">
            <h2 className="text-sm font-bold text-white mb-4">Masuk ke Akun POS</h2>

            {sessionExpiredReason && (
              <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-300 text-xs flex items-start gap-2.5">
                <Clock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <span className="font-semibold block text-amber-200">Sesi Berakhir</span>
                  <span className="text-slate-300 leading-relaxed text-[11px]">{sessionExpiredReason}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setSessionExpiredReason(null)}
                  className="text-slate-400 hover:text-white p-0.5 transition-colors cursor-pointer"
                  aria-label="Tutup pesan"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {error && (
              <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              {/* Username Input */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5" htmlFor="login-username">
                  Username
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="login-username"
                    type="text"
                    autoComplete="username"
                    value={username}
                    onChange={(e) => {
                      setUsername(e.target.value);
                      if (sessionExpiredReason) setSessionExpiredReason(null);
                    }}
                    placeholder="Masukkan username"
                    className="w-full pl-10 pr-4 py-2.5 bg-[#080d15] border border-white/10 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/60 transition-colors"
                  />
                </div>
              </div>

              {/* Password Input */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5" htmlFor="login-password">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (sessionExpiredReason) setSessionExpiredReason(null);
                    }}
                    placeholder="Masukkan password"
                    className="w-full pl-10 pr-10 py-2.5 bg-[#080d15] border border-white/10 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/60 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                    aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Remember me & Forgot password */}
              <div className="flex items-center justify-between text-xs pt-0.5">
                <label className="flex items-center gap-2 cursor-pointer select-none text-slate-400 hover:text-white transition-colors">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600 bg-[#080d15] border-white/20 focus:ring-emerald-500 cursor-pointer"
                  />
                  <span>Ingat sesi</span>
                </label>
                <button
                  type="button"
                  onClick={onForgotPassword}
                  className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer font-medium"
                >
                  Lupa password?
                </button>
              </div>

              <button
                id="login-submit"
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-bold text-xs rounded-lg flex items-center justify-center gap-2 shadow-md shadow-emerald-950/40 transition-colors cursor-pointer active:scale-95"
              >
                {loading ? (
                  <span>Memverifikasi Akun...</span>
                ) : (
                  <>
                    <span>Masuk ke Sistem</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        <p className="text-center text-xs text-slate-500 mt-6 font-mono">
          © 2026 Sentosa Retail Group · Terenkripsi SHA-256
        </p>
      </div>
    </div>
  );
};
