import React, { useState } from 'react';
import { Store, Mail, ArrowLeft, CheckCircle2 } from 'lucide-react';

interface ForgotPasswordViewProps {
  onBack: () => void;
}

export const ForgotPasswordView: React.FC<ForgotPasswordViewProps> = ({ onBack }) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes('@')) {
      setError('Masukkan email yang valid.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Terjadi kesalahan');
      setSent(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#090d14] flex flex-col justify-center items-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-dot-pattern opacity-40 pointer-events-none" />

      <div className="relative z-10 w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-3 shadow-sm">
            <Store className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">Sentosa POS</h1>
          <p className="text-slate-400 text-xs mt-0.5">Pemulihan Kata Sandi</p>
        </div>

        <div className="bg-[#0e1520] border border-white/[0.08] rounded-2xl p-6 shadow-xl">
          {sent ? (
            /* Success State */
            <div className="flex flex-col items-center text-center gap-4 py-2">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-white mb-2">Email Terkirim!</h2>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Jika email <span className="text-white font-medium">{email}</span> terdaftar,
                  instruksi reset password telah dikirim. Periksa folder inbox atau spam.
                </p>
                <p className="text-[11px] text-slate-500 mt-2 font-mono">Link berlaku selama 1 jam.</p>
              </div>
              <button
                type="button"
                onClick={onBack}
                className="mt-2 flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Kembali ke Login</span>
              </button>
            </div>
          ) : (
            /* Form State */
            <>
              <button
                type="button"
                onClick={onBack}
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white mb-4 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Kembali ke Login</span>
              </button>

              <h2 className="text-sm font-semibold text-white mb-1">Lupa Password?</h2>
              <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                Masukkan email akun Anda. Kami akan mengirimkan link untuk mengatur ulang password.
              </p>

              {error && (
                <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-300 text-xs">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5" htmlFor="forgot-email">
                    Alamat Email
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      id="forgot-email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="email@contoh.com"
                      className="w-full pl-9 pr-4 py-2 bg-[#090d14] border border-white/10 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/60 transition-colors"
                    />
                  </div>
                </div>

                <button
                  id="forgot-submit"
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-semibold text-xs rounded-lg flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer"
                >
                  {loading ? 'Mengirim...' : 'Kirim Link Reset Password'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
