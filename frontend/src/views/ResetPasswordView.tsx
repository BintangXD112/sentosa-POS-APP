import React, { useState, useEffect } from 'react';
import { Store, Lock, Eye, EyeOff, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

export const ResetPasswordView: React.FC = () => {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [status, setStatus] = useState<'verifying' | 'form' | 'success' | 'error'>('verifying');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get('token');
    if (!t) {
      setStatus('error');
      setMessage('Token reset password tidak ditemukan. Silakan minta link reset baru.');
      return;
    }

    setToken(t);

    // Verify token validity immediately with backend before displaying the form
    const verifyToken = async () => {
      try {
        const res = await fetch(`/api/v1/auth/verify-reset-token?token=${encodeURIComponent(t)}`);
        const data = await res.json();
        if (!res.ok || !data.valid) {
          setStatus('error');
          setMessage(data.error || 'Link reset password ini sudah tidak valid atau sudah pernah digunakan.');
        } else {
          setStatus('form');
        }
      } catch (err: any) {
        setStatus('error');
        setMessage(err.message || 'Gagal memverifikasi keabsahan link reset password.');
      }
    };

    verifyToken();
  }, []);

  const strength = (() => {
    if (password.length === 0) return 0;
    let s = 0;
    if (password.length >= 8) s++;
    if (/[A-Z]/.test(password)) s++;
    if (/[0-9]/.test(password)) s++;
    if (/[^A-Za-z0-9]/.test(password)) s++;
    return s;
  })();

  const strengthLabel = ['', 'Lemah', 'Cukup', 'Kuat', 'Sangat Kuat'][strength];
  const strengthColor = ['', 'bg-rose-500', 'bg-amber-500', 'bg-emerald-500', 'bg-emerald-400'][strength];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      setMessage('Password minimal 8 karakter.');
      return;
    }
    if (password !== confirm) {
      setMessage('Konfirmasi password tidak cocok.');
      return;
    }
    setLoading(true);
    setMessage('');
    try {
      const res = await fetch('/api/v1/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mereset password');
      setStatus('success');
      setMessage(data.message);
    } catch (err: any) {
      setStatus('error');
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#090d16] flex flex-col justify-center items-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-dot-pattern opacity-60 pointer-events-none" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-gradient-to-b from-emerald-500/10 via-teal-500/5 to-transparent blur-3xl pointer-events-none" />

      <div className="relative z-10 w-full max-w-sm">
        <div className="flex flex-col items-center mb-7">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20 mb-3.5">
            <Store className="w-7 h-7 text-slate-950" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">Sentosa POS</h1>
          <p className="text-slate-400 text-xs mt-1">Atur Password Baru</p>
        </div>

        <div className="bg-[#0e1520]/95 backdrop-blur-xl border border-white/[0.08] rounded-xl p-6 sm:p-7 shadow-2xl shadow-black/60">
          {status === 'verifying' && (
            <div className="flex flex-col items-center text-center gap-4 py-6">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <Loader2 className="w-7 h-7 text-emerald-400 animate-spin" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white mb-1">Memeriksa Link Reset...</h2>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Mohon tunggu sebentar, sistem sedang memverifikasi keabsahan tautan Anda.
                </p>
              </div>
            </div>
          )}

          {status === 'success' && (
            <div className="flex flex-col items-center text-center gap-4 py-2">
              <div className="w-16 h-16 rounded-full bg-emerald-500/15 border-2 border-emerald-500/40 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-400" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white mb-2">Password Berhasil Diperbarui!</h2>
                <p className="text-sm text-slate-400">{message}</p>
              </div>
              <a
                href="/"
                className="mt-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-white font-bold text-sm transition-colors"
              >
                Kembali ke Login
              </a>
            </div>
          )}

          {status === 'error' && (
            <div className="flex flex-col items-center text-center gap-4 py-2 animate-in zoom-in-95 duration-200">
              <div className="w-16 h-16 rounded-full bg-rose-500/15 border-2 border-rose-500/40 flex items-center justify-center shadow-lg shadow-rose-500/10">
                <AlertCircle className="w-8 h-8 text-rose-400" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white mb-1.5">Link Tidak Berlaku</h2>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-xs">{message}</p>
              </div>
              <div className="pt-2 flex flex-col gap-2 w-full">
                <a
                  href="/"
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all text-center"
                >
                  Minta Link Reset Baru
                </a>
                <a
                  href="/"
                  className="w-full py-2 text-slate-400 hover:text-slate-200 text-xs transition-colors text-center"
                >
                  Kembali ke Halaman Login
                </a>
              </div>
            </div>
          )}

          {status === 'form' && (
            <>
              <h2 className="text-base font-bold text-white mb-1">Buat Password Baru</h2>
              <p className="text-xs text-slate-400 mb-5">Password minimal 8 karakter.</p>

              {message && (
                <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/25 rounded-xl text-rose-400 text-xs">
                  {message}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Password */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5" htmlFor="new-password">
                    Password Baru
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      id="new-password"
                      type={showPass ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Minimal 8 karakter"
                      className="w-full pl-10 pr-11 py-2.5 bg-[#090d14] border border-white/[0.08] rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                    >
                      {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {/* Strength bar */}
                  {password.length > 0 && (
                    <div className="mt-2 space-y-1">
                      <div className="flex gap-1">
                        {[1, 2, 3, 4].map((i) => (
                          <div
                            key={i}
                            className={`h-1 flex-1 rounded-full transition-all ${
                              i <= strength ? strengthColor : 'bg-white/[0.06]'
                            }`}
                          />
                        ))}
                      </div>
                      <p className={`text-[11px] font-medium ${strengthColor.replace('bg-', 'text-')}`}>
                        {strengthLabel}
                      </p>
                    </div>
                  )}
                </div>

                {/* Confirm Password */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5" htmlFor="confirm-password">
                    Konfirmasi Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      id="confirm-password"
                      type={showConfirm ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      placeholder="Ulangi password baru"
                      className={`w-full pl-10 pr-11 py-2.5 bg-[#090d14]/80 border rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none transition-colors ${
                        confirm && password !== confirm
                          ? 'border-rose-500 focus:border-rose-400'
                          : confirm && password === confirm
                          ? 'border-emerald-500'
                          : 'border-white/[0.08] focus:border-emerald-500'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                    >
                      {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {confirm && password !== confirm && (
                    <p className="mt-1 text-[11px] text-rose-400">Password tidak cocok</p>
                  )}
                </div>

                <button
                  id="reset-submit"
                  type="submit"
                  disabled={loading || !token}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-bold text-sm rounded-xl shadow-lg shadow-emerald-600/25 transition-all cursor-pointer"
                >
                  {loading ? 'Memperbarui...' : 'Simpan Password Baru'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
