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

  const { setAuth } = useAuthStore();

  // Cooldown countdown
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
        // Unrecognized device or expired trust — trigger 2FA OTP screen
        setChallengeToken(data.challenge_token);
        setMaskedEmail(data.masked_email || 'email Anda');
        setIs2FA(true);
        setOtpCode('');
        setResendCooldown(60);
      } else {
        // Recognized trusted device
        setAuth(data.token, data.user);
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

      // If user checked "Ingat perangkat ini selama 30 hari", store device_token in localStorage
      if (data.device_token) {
        localStorage.setItem('sentosa_device_token', data.device_token);
      }

      setAuth(data.token, data.user);
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
    <div className="min-h-screen bg-[#090d16] flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Subtle background mesh and dot pattern */}
      <div className="absolute inset-0 bg-dot-pattern opacity-60 pointer-events-none" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-gradient-to-b from-emerald-500/10 via-teal-500/5 to-transparent blur-3xl pointer-events-none" />

      <div className="relative z-10 w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20 mb-3.5">
            <Store className="w-7 h-7 text-slate-950" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">Sentosa POS</h1>
          <p className="text-slate-400 text-xs mt-1">Platform Manajemen & Kasir Retail</p>
        </div>

        {/* 2FA SCREEN */}
        {is2FA ? (
          <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-2xl shadow-black/60 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white">Verifikasi Dua Faktor (A2F)</h2>
                <span className="text-[10px] text-emerald-400 font-medium">Perangkat Baru Terdeteksi</span>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              Demi keamanan akun, masukkan kode verifikasi 6 digit yang dikirimkan ke email <strong className="text-white font-mono">{maskedEmail}</strong>.
            </p>

            {error && (
              <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/25 rounded-xl text-rose-400 text-xs">
                {error}
              </div>
            )}

            {resendNotice && (
              <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/25 rounded-xl text-emerald-400 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
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
                  className="w-full text-center tracking-[12px] text-2xl font-black font-mono py-3 bg-slate-800 border border-emerald-500/40 focus:border-emerald-500 rounded-xl text-white focus:outline-none transition-colors"
                />
              </div>

              {/* 30-day Trusted Device Checkbox */}
              <div className="p-3 bg-slate-800/50 border border-slate-700/60 rounded-xl flex items-start gap-2.5">
                <input
                  id="trust-device-check"
                  type="checkbox"
                  checked={trustDevice}
                  onChange={(e) => setTrustDevice(e.target.checked)}
                  className="w-4 h-4 mt-0.5 rounded text-emerald-600 bg-slate-900 border-slate-700 focus:ring-emerald-500 cursor-pointer"
                />
                <label htmlFor="trust-device-check" className="text-xs text-slate-300 leading-tight cursor-pointer">
                  <span className="font-semibold text-white block">Ingat perangkat ini (Perangkat Terpercaya)</span>
                  <span className="text-[11px] text-slate-400">
                    Bebas kode 2FA di perangkat ini hingga maksimal 30 hari.
                  </span>
                </label>
              </div>

              <button
                type="submit"
                disabled={verifying2FA || otpCode.length !== 6}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 transition-all cursor-pointer active:scale-95"
              >
                {verifying2FA ? <span>Memverifikasi Kode...</span> : <span>Verifikasi & Masuk</span>}
              </button>
            </form>

            <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={() => {
                  setIs2FA(false);
                  setError(null);
                }}
                className="text-slate-400 hover:text-white transition-colors flex items-center gap-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Ganti Akun</span>
              </button>

              <button
                type="button"
                disabled={resendCooldown > 0 || resendingCode}
                onClick={handleResendCode}
                className="text-emerald-400 hover:text-emerald-300 disabled:text-slate-500 transition-colors flex items-center gap-1 font-semibold"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${resendingCode ? 'animate-spin' : ''}`} />
                <span>
                  {resendCooldown > 0 ? `Kirim ulang (${resendCooldown}s)` : 'Kirim Ulang'}
                </span>
              </button>
            </div>
          </div>
        ) : (
          /* STANDARD USERNAME & PASSWORD LOGIN */
          <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-2xl shadow-black/60">
            <h2 className="text-sm font-bold text-white mb-4">Masuk ke Akun</h2>

            {error && (
              <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/25 rounded-xl text-rose-400 text-xs">
                {error}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              {/* Username */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5" htmlFor="login-username">
                  Username
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="login-username"
                    type="text"
                    autoComplete="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Masukkan username"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
              </div>

              {/* Password with show/hide */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5" htmlFor="login-password">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Masukkan password"
                    className="w-full pl-10 pr-11 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                    aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Forgot password */}
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={onForgotPassword}
                  className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
                >
                  Lupa password?
                </button>
              </div>

              <button
                id="login-submit"
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 transition-all cursor-pointer active:scale-95"
              >
                {loading ? (
                  <span>Memverifikasi...</span>
                ) : (
                  <>
                    <span>Masuk</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        <p className="text-center text-xs text-slate-600 mt-6">
          © 2026 Sentosa Retail Group · Dilindungi A2F & Enkripsi
        </p>
      </div>
    </div>
  );
};
