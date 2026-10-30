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
    <div className="min-h-screen bg-[#080d14] flex flex-col justify-center items-center p-4 relative overflow-hidden select-none">
      <div className="absolute inset-0 bg-dot-pattern opacity-40 pointer-events-none" />

      <div className="relative z-10 w-full max-w-sm">
        <div className="flex flex-col items-center mb-6">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-3 shadow-md shadow-emerald-950/40">
            <Store className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">Sentosa POS</h1>
          <p className="text-slate-400 text-xs mt-0.5">Atur Ulang Kata Sandi Akun</p>
        </div>

        <div className="bg-[#0e1520] border border-white/[0.08] rounded-2xl p-6 shadow-2xl">
          {status === 'verifying' && (
            <div className="flex flex-col items-center text-center gap-4 py-6">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-emerald-400 animate-spin" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white mb-1">Memeriksa Tautan Reset...</h2>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Sistem sedang memverifikasi keabsahan token keamanan Anda.
                </p>
              </div>
            </div>
          )}

          {status === 'success' && (
            <div className="flex flex-col items-center text-center gap-4 py-2">
              <div className="w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center">
                <CheckCircle2 className="w-7 h-7 text-emerald-400" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white mb-1">Kata Sandi Berhasil Diperbarui!</h2>
                <p className="text-xs text-slate-400">{message}</p>
              </div>
              <a
                href="/"
                className="mt-2 w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-white font-bold text-xs text-center transition-colors"
              >
                Masuk dengan Kata Sandi Baru
              </a>
            </div>
          )}

          {status === 'error' && (
            <div className="flex flex-col items-center text-center gap-4 py-2 animate-in zoom-in-95 duration-150">
              <div className="w-14 h-14 rounded-full bg-rose-500/15 border border-rose-500/40 flex items-center justify-center">
                <AlertCircle className="w-7 h-7 text-rose-400" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white mb-1">Tautan Tidak Berlaku</h2>
                <p className="text-xs text-slate-300 leading-relaxed max-w-xs">{message}</p>
              </div>
              <div className="pt-2 flex flex-col gap-2 w-full">
                <a
                  href="/"
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all text-center"
                >
                  Minta Tautan Reset Baru
                </a>
                <a
                  href="/"
                  className="w-full py-2 text-slate-400 hover:text-slate-200 text-xs transition-colors text-center font-medium"
                >
                  Kembali ke Halaman Login
                </a>
              </div>
            </div>
          )}

          {status === 'form' && (
            <>
              <h2 className="text-sm font-bold text-white mb-1">Buat Password Baru</h2>
              <p className="text-xs text-slate-400 mb-4">Gunakan kombinasi minimal 8 karakter.</p>

              {message && (
                <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-400 text-xs">
                  {message}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Password */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5" htmlFor="new-password">
                    Kata Sandi Baru
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      id="new-password"
                      type={showPass ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Minimal 8 karakter"
                      className="w-full pl-10 pr-10 py-2.5 bg-[#080d15] border border-white/10 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/60 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
                    >
                      {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {/* Strength Bar */}
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
                      <p className={`text-[10px] font-mono font-medium ${strengthColor.replace('bg-', 'text-')}`}>
                        Kekuatan: {strengthLabel}
                      </p>
                    </div>
                  )}
                </div>

                {/* Confirm Password */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5" htmlFor="confirm-password">
                    Ulangi Kata Sandi
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      id="confirm-password"
                      type={showConfirm ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      placeholder="Ketik ulang kata sandi"
                      className={`w-full pl-10 pr-10 py-2.5 bg-[#080d15] border rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none transition-colors ${
                        confirm && password !== confirm
                          ? 'border-rose-500 focus:border-rose-400'
                          : confirm && password === confirm
                          ? 'border-emerald-500'
                          : 'border-white/10 focus:border-emerald-500/60'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
                    >
                      {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {confirm && password !== confirm && (
                    <p className="mt-1 text-[11px] text-rose-400">Kata sandi tidak cocok</p>
                  )}
                </div>

                <button
                  id="reset-submit"
                  type="submit"
                  disabled={loading || !token}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs rounded-lg shadow-md shadow-emerald-950/40 transition-all cursor-pointer"
                >
                  {loading ? 'Menyimpan Kata Sandi...' : 'Simpan Kata Sandi Baru'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
