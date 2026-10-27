import React, { useState, useEffect, useRef, useCallback } from 'react';
import QRCodeSVG from 'react-qr-code';
import { 
  Search, 
  Plus, 
  Minus, 
  Trash2, 
  CreditCard, 
  CheckCircle2, 
  X, 
  Printer, 
  ShoppingBag, 
  QrCode, 
  Banknote, 
  Building2, 
  RefreshCw, 
  Wifi, 
  Receipt,
  RotateCcw
} from 'lucide-react';
import { apiRequest } from '../api/client';
import { useAuthStore } from '../store/authStore';
import { useCartStore } from '../store/cartStore';
import type { Category, Product, SaleDetail } from '../types';

export const PosView: React.FC = () => {
  const { currentBranch } = useAuthStore();
  const { items, addItem, updateQuantity, removeItem, clearCart, getSubtotal } = useCartStore();

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loading, setLoading] = useState(false);

  // Checkout dialog states
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer' | 'qris' | 'debit'>('cash');
  const [cashTendered, setCashTendered] = useState<number>(0);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  // Receipt modal state
  const [completedSale, setCompletedSale] = useState<SaleDetail | null>(null);

  // QRIS session state
  const [qrisStatus, setQrisStatus] = useState<'idle' | 'pending' | 'paid'>('idle');
  const [qrisPayUrl, setQrisPayUrl] = useState<string>('');
  const qrisPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut: '/' to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement !== searchInputRef.current) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const loadCategories = async () => {
    try {
      const res = await apiRequest<{ categories: Category[] }>('/categories');
      setCategories(res.categories || []);
    } catch (e) {
      console.error(e);
    }
  };

  const loadProducts = async () => {
    if (!currentBranch) return;
    setLoading(true);
    try {
      let url = `/products?limit=100`;
      if (searchQuery) url += `&q=${encodeURIComponent(searchQuery)}`;
      if (selectedCategory) url += `&category_id=${encodeURIComponent(selectedCategory)}`;

      const res = await apiRequest<{ products: Product[] }>(url);
      setProducts(res.products || []);
    } catch (e) {
      console.error('Failed to load products', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, [currentBranch]);

  useEffect(() => {
    loadProducts();
  }, [currentBranch, selectedCategory, searchQuery]);

  const subtotal = getSubtotal();

  const formatIDR = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(val);
  };

  const stopQrisPoll = useCallback(() => {
    if (qrisPollRef.current) {
      clearInterval(qrisPollRef.current);
      qrisPollRef.current = null;
    }
  }, []);

  // Start QRIS session when QRIS tab is selected
  const startQrisSession = useCallback(async (amount: number) => {
    try {
      setQrisStatus('pending');
      const res = await apiRequest<{ session_id: string; pay_url?: string; server_ip?: string }>('/qris/session', {
        method: 'POST',
        body: JSON.stringify({ amount }),
      });
      const sid = res.session_id;

      // Use backend resolved LAN IP or direct pay_url so phones on the same Wi-Fi can open it
      let payUrl = res.pay_url;
      if (!payUrl) {
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
          const host = res.server_ip || window.location.hostname;
          payUrl = `http://${host}:8080/api/v1/qris/confirm/${sid}`;
        } else {
          payUrl = `${window.location.origin}/api/v1/qris/confirm/${sid}`;
        }
      }
      setQrisPayUrl(payUrl);

      // Poll for payment status every 2 seconds
      stopQrisPoll();
      qrisPollRef.current = setInterval(async () => {
        try {
          const status = await apiRequest<{ status: string }>(`/qris/status/${sid}`);
          if (status.status === 'paid') {
            setQrisStatus('paid');
            stopQrisPoll();
          }
        } catch {
          // silently ignore poll errors
        }
      }, 2000);
    } catch (err: any) {
      setCheckoutError('Gagal membuat sesi QRIS: ' + err.message);
      setQrisStatus('idle');
    }
  }, [stopQrisPoll]);

  // Cleanup poll on unmount
  useEffect(() => () => stopQrisPoll(), [stopQrisPoll]);

  const handleOpenCheckout = () => {
    setCashTendered(subtotal);
    setPaymentMethod('cash');
    setCheckoutError(null);
    setQrisStatus('idle');
    setIsCheckoutOpen(true);
  };

  const handleSelectPaymentMethod = (method: 'cash' | 'transfer' | 'qris' | 'debit') => {
    setPaymentMethod(method);
    if (method === 'qris' && qrisStatus === 'idle') {
      startQrisSession(subtotal);
    }
    if (method !== 'qris') {
      stopQrisPoll();
      setQrisStatus('idle');
    }
  };

  const executeCheckout = async () => {
    if (!currentBranch) return;
    setCheckoutLoading(true);
    setCheckoutError(null);

    const idempotencyKey = crypto.randomUUID();

    try {
      const payload = {
        idempotency_key: idempotencyKey,
        items: items.map((i) => ({
          product_id: i.product.id,
          quantity: i.quantity,
        })),
        payment: {
          method: paymentMethod,
          amount_paid: paymentMethod === 'cash' ? cashTendered : subtotal,
        },
        notes: `Transaksi Kasir Cabang: ${currentBranch.name}`,
      };

      const res = await apiRequest<any>('/checkout', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      // Clear cart
      clearCart();
      setIsCheckoutOpen(false);

      // Fetch complete sale detail for receipt
      const detail = await apiRequest<SaleDetail>(`/sales/${res.sale_id}`);
      setCompletedSale(detail);

      // Refresh product stock
      loadProducts();
    } catch (err: any) {
      setCheckoutError(err.message || 'Checkout gagal');
    } finally {
      setCheckoutLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3.5 sm:py-5 pb-28 lg:pb-8">
      {/* Top Header & Session Bar */}
      <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-white/[0.08] pb-3.5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Receipt className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-white">Kasir Penjualan</h1>
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                ONLINE
              </span>
            </div>
            <p className="text-xs text-slate-400">Pilih produk atau scan barcode untuk transaksi baru</p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 self-end sm:self-auto">
          {currentBranch && (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border border-white/[0.08] bg-white/[0.03] text-slate-300">
              <Building2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="font-semibold text-white">{currentBranch.name}</span>
            </div>
          )}
          <span className="hidden md:inline-flex items-center gap-1.5 text-xs text-slate-400 pl-1">
            Fokus cari <kbd>/</kbd>
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-5">
        {/* Left Column: Product Catalog & Search (8 cols on desktop) */}
        <div className="lg:col-span-8 space-y-3.5">
          {/* Filter Bar: Search + Category Pills */}
          <div className="bg-[#0e1520] border border-white/[0.08] rounded-xl p-3 shadow-sm space-y-2.5">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama produk, SKU, atau scan barcode..."
                className="w-full pl-10 pr-20 py-2.5 bg-[#090d14] border border-white/[0.08] rounded-lg text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/20 transition-all font-sans"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                {searchQuery ? (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                    title="Hapus pencarian"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <kbd className="hidden sm:inline-block text-[10px] text-slate-500 border border-white/10 bg-white/5 px-1.5 py-0.5 rounded font-mono">
                    /
                  </kbd>
                )}
              </div>
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none text-xs">
              <button
                onClick={() => setSelectedCategory('')}
                className={`px-3 py-1.5 rounded-md font-medium whitespace-nowrap transition-all cursor-pointer ${
                  selectedCategory === ''
                    ? 'bg-white/[0.12] text-white border border-white/20 font-semibold shadow-sm'
                    : 'bg-white/[0.03] text-slate-400 border border-white/[0.05] hover:text-slate-200 hover:bg-white/[0.06]'
                }`}
              >
                Semua Produk
              </button>
              {categories.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedCategory(c.id)}
                  className={`px-3 py-1.5 rounded-md font-medium whitespace-nowrap transition-all cursor-pointer ${
                    selectedCategory === c.id
                      ? 'bg-white/[0.12] text-white border border-white/20 font-semibold shadow-sm'
                      : 'bg-white/[0.03] text-slate-400 border border-white/[0.05] hover:text-slate-200 hover:bg-white/[0.06]'
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>

          {/* Product Grid */}
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-3">
              {[...Array(8)].map((_, idx) => (
                <div key={idx} className="h-40 bg-[#0e1520]/80 border border-white/[0.05] rounded-xl animate-pulse p-3 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="h-3 w-16 bg-white/5 rounded" />
                    <div className="h-4 w-3/4 bg-white/10 rounded" />
                    <div className="h-3 w-1/2 bg-white/5 rounded" />
                  </div>
                  <div className="h-4 w-20 bg-white/10 rounded" />
                </div>
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="bg-[#0e1520] border border-white/[0.08] rounded-xl p-10 sm:p-14 text-center text-slate-400">
              <div className="w-12 h-12 rounded-xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-center mx-auto mb-3 text-slate-500">
                <ShoppingBag className="w-5 h-5 stroke-[1.5]" />
              </div>
              <p className="text-sm font-semibold text-slate-200">Tidak ada produk yang cocok</p>
              <p className="text-xs text-slate-500 mt-1">Coba gunakan kata kunci lain atau pilih Semua Produk</p>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="mt-3.5 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-white/[0.06] hover:bg-white/[0.1] text-slate-200 border border-white/10 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset Pencarian</span>
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-3">
              {products.map((p) => {
                const isOutOfStock = p.stock <= 0;
                const cartItem = items.find((i) => i.product.id === p.id);
                const cartQty = cartItem?.quantity || 0;

                return (
                  <div
                    key={p.id}
                    onClick={() => !isOutOfStock && addItem(p)}
                    className={`group relative bg-[#0e1520] border rounded-xl p-3 flex flex-col justify-between transition-all select-none ${
                      isOutOfStock
                        ? 'opacity-40 border-white/[0.04] cursor-not-allowed'
                        : cartQty > 0
                        ? 'border-emerald-500/50 bg-emerald-500/[0.02] shadow-sm hover:border-emerald-400 cursor-pointer active:scale-[0.99]'
                        : 'border-white/[0.08] hover:border-white/20 hover:bg-[#111927] cursor-pointer active:scale-[0.99]'
                    }`}
                  >
                    <div>
                      {/* Top Bar: SKU & Stock Badge */}
                      <div className="flex items-center justify-between gap-1 mb-2">
                        <span className="text-[10px] text-slate-500 font-mono tracking-wider truncate">
                          {p.sku}
                        </span>
                        <span
                          className={`text-[10px] font-mono font-medium px-1.5 py-0.5 rounded ${
                            p.stock > 10
                              ? 'bg-white/[0.04] text-slate-300 border border-white/[0.06]'
                              : p.stock > 0
                              ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          }`}
                        >
                          {p.stock > 0 ? `${p.stock} ${p.unit_symbol || 'pcs'}` : 'Habis'}
                        </span>
                      </div>

                      {/* Product Name */}
                      <h3 className="text-xs sm:text-[13px] font-semibold text-slate-100 line-clamp-2 leading-snug group-hover:text-emerald-300 transition-colors">
                        {p.name}
                      </h3>

                      {p.category_name && (
                        <span className="text-[11px] text-slate-400 mt-1 block truncate font-normal">
                          {p.category_name}
                        </span>
                      )}
                    </div>

                    {/* Price and Cart Indicator */}
                    <div className="mt-3 pt-2.5 border-t border-white/[0.06] flex items-center justify-between">
                      <span className="text-xs sm:text-sm font-bold text-emerald-400 font-mono tracking-tight">
                        {formatIDR(p.selling_price)}
                      </span>

                      {cartQty > 0 ? (
                        <div className="flex items-center gap-1">
                          <span className="px-2 py-0.5 rounded bg-emerald-500 text-slate-950 font-bold font-mono text-xs shadow-sm">
                            {cartQty}
                          </span>
                        </div>
                      ) : (
                        <div
                          className={`w-6 h-6 rounded flex items-center justify-center transition-all ${
                            isOutOfStock
                              ? 'bg-white/[0.02] text-slate-600'
                              : 'bg-white/[0.04] border border-white/[0.08] text-slate-400 group-hover:bg-emerald-500/20 group-hover:border-emerald-500/40 group-hover:text-emerald-300'
                          }`}
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Desktop Sticky Cart Panel (Right Column) */}
        <div className="hidden lg:block lg:col-span-4">
          <div className="bg-[#0e1520] border border-white/[0.08] rounded-xl shadow-xl flex flex-col h-[calc(100vh-90px)] sticky top-4">
            {/* Cart Header */}
            <div className="p-3.5 border-b border-white/[0.08] flex items-center justify-between bg-black/10">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <ShoppingBag className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white tracking-tight">Pesanan Aktif</h2>
                  <p className="text-[10px] text-slate-400 font-mono">
                    {items.reduce((acc, i) => acc + i.quantity, 0)} item terpilih
                  </p>
                </div>
              </div>
              {items.length > 0 && (
                <button
                  onClick={clearCart}
                  className="text-xs text-slate-400 hover:text-rose-400 flex items-center gap-1 transition-colors px-2 py-1 rounded hover:bg-rose-500/10 cursor-pointer"
                  title="Kosongkan seluruh keranjang"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Kosongkan</span>
                </button>
              )}
            </div>

            {/* Cart Items List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {items.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 py-12 px-4 text-center">
                  <div className="w-12 h-12 rounded-xl bg-white/[0.02] border border-dashed border-white/10 flex items-center justify-center mb-3">
                    <ShoppingBag className="w-6 h-6 text-slate-600 stroke-[1.5]" />
                  </div>
                  <p className="text-xs font-semibold text-slate-300">Keranjang masih kosong</p>
                  <p className="text-[11px] text-slate-500 mt-1 max-w-[200px] leading-relaxed">
                    Klik produk di katalog atau scan barcode untuk menambahkan item
                  </p>
                </div>
              ) : (
                items.map((i) => (
                  <div
                    key={i.product.id}
                    className="bg-[#090d14]/70 hover:bg-[#090d14] border border-white/[0.06] hover:border-white/[0.12] rounded-lg p-2.5 flex flex-col justify-between transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-slate-100 truncate">{i.product.name}</div>
                        <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                          {formatIDR(i.product.selling_price)} / {i.product.unit_symbol || 'pcs'}
                        </div>
                      </div>
                      <button
                        onClick={() => removeItem(i.product.id)}
                        className="text-slate-500 hover:text-rose-400 transition-colors p-1 rounded hover:bg-rose-500/10 cursor-pointer"
                        title="Hapus item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      {/* Qty Controls */}
                      <div className="flex items-center gap-0.5 bg-black/40 rounded border border-white/10 p-0.5">
                        <button
                          onClick={() => updateQuantity(i.product.id, i.quantity - 1)}
                          className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-7 text-center text-xs font-bold text-white font-mono">
                          {i.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(i.product.id, i.quantity + 1)}
                          disabled={i.quantity >= i.product.stock}
                          className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 disabled:opacity-20 active:scale-95 transition-all cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Line Subtotal */}
                      <div className="text-xs font-bold text-emerald-400 font-mono">
                        {formatIDR(i.product.selling_price * i.quantity)}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Cart Footer Summary & Pay Button */}
            <div className="p-3.5 border-t border-white/[0.08] bg-[#0c121c] rounded-b-xl space-y-3">
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>Subtotal Produk</span>
                  <span className="font-mono text-slate-200">{formatIDR(subtotal)}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Pajak & Biaya Layanan</span>
                  <span className="font-mono text-slate-400">Termasuk</span>
                </div>
                <div className="flex justify-between items-baseline pt-2 border-t border-white/[0.08]">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">Total Tagihan</span>
                  <span className="text-lg font-bold text-white font-mono tracking-tight">{formatIDR(subtotal)}</span>
                </div>
              </div>

              <button
                disabled={items.length === 0}
                onClick={handleOpenCheckout}
                className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 disabled:hover:bg-emerald-600 text-white font-bold text-xs sm:text-sm rounded-lg shadow-lg shadow-emerald-950/60 flex items-center justify-between transition-all active:scale-[0.99] cursor-pointer disabled:cursor-not-allowed"
              >
                <span className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4" />
                  <span>Proses Pembayaran</span>
                </span>
                <span className="font-mono text-xs sm:text-sm font-black bg-emerald-700/60 px-2 py-0.5 rounded border border-emerald-400/20">
                  {formatIDR(subtotal)}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Bottom Cart Bar for Mobile & Tablet (when items > 0) */}
      {items.length > 0 && (
        <div className="lg:hidden fixed bottom-3 left-3 right-3 z-30 animate-in slide-in-from-bottom-4 duration-200">
          <div className="bg-[#0e1520]/95 backdrop-blur-md border border-white/15 rounded-xl p-2.5 sm:p-3 shadow-2xl flex items-center justify-between gap-3">
            <button
              onClick={() => setIsMobileCartOpen(true)}
              className="flex items-center gap-2.5 text-left flex-1 min-w-0 cursor-pointer"
            >
              <div className="w-9 h-9 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 flex-shrink-0 relative">
                <ShoppingBag className="w-4 h-4" />
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 text-slate-950 font-bold text-[10px] rounded-full flex items-center justify-center shadow">
                  {items.reduce((acc, i) => acc + i.quantity, 0)}
                </span>
              </div>
              <div className="min-w-0">
                <div className="text-[10px] text-slate-400 leading-tight">Total Belanja</div>
                <div className="text-sm font-black text-emerald-400 font-mono truncate leading-snug">{formatIDR(subtotal)}</div>
              </div>
            </button>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => setIsMobileCartOpen(true)}
                className="px-3 py-2 bg-white/[0.06] hover:bg-white/[0.1] text-slate-200 text-xs font-semibold rounded-lg border border-white/10 transition-colors cursor-pointer"
              >
                Lihat Item
              </button>
              <button
                onClick={handleOpenCheckout}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg shadow-md shadow-emerald-950/40 flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>Bayar</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Cart Slide-Up Drawer */}
      {isMobileCartOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setIsMobileCartOpen(false)}
        >
          <div
            className="bg-[#0e1520] border-t border-white/10 rounded-t-2xl max-h-[85vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div className="p-3.5 border-b border-white/[0.08] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-md bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
                  <ShoppingBag className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Keranjang Pesanan</h3>
                  <p className="text-[10px] text-slate-400 font-mono">{items.reduce((acc, i) => acc + i.quantity, 0)} item dipilih</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {items.length > 0 && (
                  <button
                    onClick={clearCart}
                    className="text-xs text-rose-400 hover:text-rose-300 px-2 py-1 rounded cursor-pointer"
                  >
                    Kosongkan
                  </button>
                )}
                <button
                  onClick={() => setIsMobileCartOpen(false)}
                  className="p-1.5 rounded text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Drawer Items */}
            <div className="p-3 space-y-2 overflow-y-auto flex-1 max-h-[50vh]">
              {items.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-xs">
                  Keranjang kosong
                </div>
              ) : (
                items.map((i) => (
                  <div
                    key={i.product.id}
                    className="bg-[#090d14] border border-white/[0.06] rounded-lg p-2.5 flex items-center justify-between gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-white truncate">{i.product.name}</div>
                      <div className="text-[11px] text-emerald-400 font-mono mt-0.5">
                        {formatIDR(i.product.selling_price * i.quantity)}
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5 bg-black/40 rounded border border-white/10 p-0.5">
                      <button
                        onClick={() => updateQuantity(i.product.id, i.quantity - 1)}
                        className="w-7 h-7 rounded flex items-center justify-center text-slate-300 hover:bg-white/10 active:scale-95 cursor-pointer"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="w-7 text-center text-xs font-bold text-white font-mono">
                        {i.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(i.product.id, i.quantity + 1)}
                        disabled={i.quantity >= i.product.stock}
                        className="w-7 h-7 rounded flex items-center justify-center text-slate-300 hover:bg-white/10 disabled:opacity-30 active:scale-95 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Drawer Footer */}
            <div className="p-3.5 border-t border-white/[0.08] bg-[#0c121c] space-y-3">
              <div className="flex justify-between items-baseline text-sm font-bold text-white">
                <span className="text-slate-400 text-xs uppercase tracking-wider font-semibold">Total Tagihan</span>
                <span className="text-lg text-emerald-400 font-mono">{formatIDR(subtotal)}</span>
              </div>
              <button
                disabled={items.length === 0}
                onClick={() => {
                  setIsMobileCartOpen(false);
                  handleOpenCheckout();
                }}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold text-sm rounded-lg shadow-lg shadow-emerald-950/40 flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
              >
                <CreditCard className="w-4 h-4" />
                <span>Lanjut ke Pembayaran ({formatIDR(subtotal)})</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Checkout Dialog Modal */}
      {isCheckoutOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-[#0e1520] border border-white/10 rounded-2xl w-full max-w-lg max-h-[92vh] flex flex-col overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-white/[0.08] flex items-center justify-between flex-shrink-0 bg-black/20">
              <div>
                <h3 className="text-base font-bold text-white tracking-tight">Pembayaran Kasir</h3>
                <p className="text-xs text-slate-400">Pilih metode pembayaran dan selesaikan transaksi</p>
              </div>
              <button
                onClick={() => setIsCheckoutOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-6 space-y-4 sm:space-y-5 overflow-y-auto flex-1">
              {checkoutError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-300 text-xs">
                  {checkoutError}
                </div>
              )}

              {/* Total Display */}
              <div className="bg-[#090d14] border border-white/10 rounded-xl p-4 text-center">
                <div className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold font-mono">Total Tagihan Transaksi</div>
                <div className="text-2xl sm:text-3xl font-black text-white font-mono mt-1 tracking-tight">
                  {formatIDR(subtotal)}
                </div>
              </div>

              {/* Payment Method Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">Metode Pembayaran</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      handleSelectPaymentMethod('cash');
                      setCashTendered(subtotal);
                    }}
                    className={`p-3 rounded-lg border flex flex-col items-center gap-1.5 text-xs transition-all cursor-pointer ${
                      paymentMethod === 'cash'
                        ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300 font-bold shadow-sm'
                        : 'bg-white/[0.03] border-white/[0.08] text-slate-400 hover:bg-white/[0.06] hover:text-slate-200'
                    }`}
                  >
                    <Banknote className="w-5 h-5" />
                    <span>Tunai</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSelectPaymentMethod('qris')}
                    className={`p-3 rounded-lg border flex flex-col items-center gap-1.5 text-xs transition-all cursor-pointer ${
                      paymentMethod === 'qris'
                        ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300 font-bold shadow-sm'
                        : 'bg-white/[0.03] border-white/[0.08] text-slate-400 hover:bg-white/[0.06] hover:text-slate-200'
                    }`}
                  >
                    <QrCode className="w-5 h-5" />
                    <span>QRIS</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSelectPaymentMethod('transfer')}
                    className={`p-3 rounded-lg border flex flex-col items-center gap-1.5 text-xs transition-all cursor-pointer ${
                      paymentMethod === 'transfer'
                        ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300 font-bold shadow-sm'
                        : 'bg-white/[0.03] border-white/[0.08] text-slate-400 hover:bg-white/[0.06] hover:text-slate-200'
                    }`}
                  >
                    <Building2 className="w-5 h-5" />
                    <span>Transfer</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSelectPaymentMethod('debit')}
                    className={`p-3 rounded-lg border flex flex-col items-center gap-1.5 text-xs transition-all cursor-pointer ${
                      paymentMethod === 'debit'
                        ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300 font-bold shadow-sm'
                        : 'bg-white/[0.03] border-white/[0.08] text-slate-400 hover:bg-white/[0.06] hover:text-slate-200'
                    }`}
                  >
                    <CreditCard className="w-5 h-5" />
                    <span>Kartu Debit</span>
                  </button>
                </div>
              </div>

              {/* Cash Panel */}
              {paymentMethod === 'cash' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Jumlah Uang Diterima (Rp)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-mono font-bold text-sm">
                        Rp
                      </span>
                      <input
                        type="number"
                        value={cashTendered || ''}
                        onChange={(e) => setCashTendered(Number(e.target.value))}
                        className="w-full pl-11 pr-4 py-2.5 bg-[#090d14] border border-white/15 rounded-lg text-lg font-mono font-bold text-white focus:outline-none focus:border-emerald-500/60"
                        placeholder="0"
                      />
                    </div>
                  </div>

                  {/* Fast Presets */}
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => setCashTendered(subtotal)}
                      className={`px-2.5 py-1.5 border rounded text-xs font-medium transition-colors cursor-pointer ${
                        cashTendered === subtotal
                          ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                          : 'bg-white/[0.04] border-white/10 hover:bg-white/[0.08] text-slate-300'
                      }`}
                    >
                      Uang Pas ({formatIDR(subtotal)})
                    </button>
                    {[50000, 100000, 200000, 500000].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setCashTendered(preset)}
                        className={`px-2.5 py-1.5 border rounded text-xs font-medium font-mono transition-colors cursor-pointer ${
                          cashTendered === preset
                            ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                            : 'bg-white/[0.04] border-white/10 hover:bg-white/[0.08] text-slate-300'
                        }`}
                      >
                        {formatIDR(preset)}
                      </button>
                    ))}
                  </div>

                  {/* Kembalian Calculation */}
                  <div className="bg-[#090d14] border border-white/[0.08] rounded-lg p-3 flex justify-between items-center text-sm">
                    <span className="text-slate-400 font-medium text-xs">Kembalian:</span>
                    <span
                      className={`font-mono font-bold text-base ${
                        cashTendered >= subtotal ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {cashTendered >= subtotal
                        ? formatIDR(cashTendered - subtotal)
                        : `Kurang ${formatIDR(subtotal - cashTendered)}`}
                    </span>
                  </div>
                </div>
              )}

              {/* QRIS Panel */}
              {paymentMethod === 'qris' && (
                <div className="space-y-3">
                  {qrisStatus === 'pending' && qrisPayUrl && (
                    <div className="flex flex-col items-center gap-3">
                      {/* QR Code Container */}
                      <div className="bg-white p-4 rounded-xl shadow-lg border-2 border-emerald-500/40">
                        <QRCodeSVG
                          value={qrisPayUrl}
                          size={190}
                          level="M"
                          fgColor="#090d14"
                        />
                      </div>

                      {/* Instruction */}
                      <div className="text-center space-y-1">
                        <div className="flex items-center justify-center gap-1.5 text-xs text-slate-300">
                          <Wifi className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                          <span>Menunggu konfirmasi pembayaran pelanggan...</span>
                        </div>
                        <p className="text-[11px] text-slate-400">
                          Pelanggan dapat scan QR di atas dengan kamera HP / aplikasi QRIS.
                        </p>
                      </div>

                      {/* URL hint */}
                      <div className="w-full bg-[#090d14] border border-white/[0.08] rounded-lg p-2.5 text-center space-y-1">
                        <p className="text-[10px] text-slate-400 font-mono break-all">{qrisPayUrl}</p>
                        <p className="text-[10px] text-amber-400/90 font-medium">
                          * Pastikan HP pelanggan dan kasir berada dalam satu jaringan Wi-Fi
                        </p>
                      </div>

                      {/* Refresh button */}
                      <button
                        type="button"
                        onClick={() => { setQrisStatus('idle'); startQrisSession(subtotal); }}
                        className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" /> <span>Generate Ulang QR</span>
                      </button>
                    </div>
                  )}

                  {qrisStatus === 'paid' && (
                    <div className="flex flex-col items-center gap-3 py-4">
                      <div className="w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center">
                        <CheckCircle2 className="w-7 h-7 text-emerald-400" />
                      </div>
                      <div className="text-center">
                        <div className="text-sm font-bold text-emerald-400">Pembayaran QRIS Berhasil!</div>
                        <div className="text-xs text-slate-400 mt-0.5">Transaksi telah diverifikasi dari server</div>
                      </div>
                      <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-5 py-2 text-emerald-300 font-mono font-bold text-base">
                        {formatIDR(subtotal)}
                      </div>
                    </div>
                  )}

                  {qrisStatus === 'idle' && (
                    <div className="flex items-center justify-center gap-2 py-8 text-slate-400 text-xs">
                      <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
                      <span>Menyiapkan sesi QRIS...</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="p-4 border-t border-white/[0.08] bg-black/20 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsCheckoutOpen(false)}
                className="px-4 py-2.5 rounded-lg border border-white/10 text-slate-300 hover:bg-white/5 text-xs font-semibold cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={
                  checkoutLoading ||
                  (paymentMethod === 'cash' && cashTendered < subtotal) ||
                  (paymentMethod === 'qris' && qrisStatus !== 'paid')
                }
                onClick={executeCheckout}
                className="px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-bold shadow-lg shadow-emerald-950/40 flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed"
              >
                {checkoutLoading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Memproses Transaksi...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Konfirmasi & Cetak Struk</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Printable Receipt Modal */}
      {completedSale && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-[#0e1520] border border-white/10 rounded-2xl w-full max-w-sm max-h-[92vh] flex flex-col overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-3.5 border-b border-white/[0.08] flex items-center justify-between flex-shrink-0 bg-black/20">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span className="font-bold text-white text-sm">Transaksi Berhasil</span>
              </div>
              <button
                onClick={() => setCompletedSale(null)}
                className="text-slate-400 hover:text-white p-1 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Thermal Struk Preview Box */}
            <div className="p-4 sm:p-6 bg-[#090d14] flex justify-center overflow-y-auto flex-1">
              <div
                id="printable-receipt"
                className="bg-white text-slate-950 font-mono text-[11px] p-5 w-72 rounded shadow-md border border-slate-200"
              >
                <div className="text-center pb-3 border-b border-dashed border-slate-400">
                  <div className="font-bold text-sm tracking-wide">SENTOSA RETAIL GROUP</div>
                  <div className="text-[10px] text-slate-700">{completedSale.branch_name}</div>
                  <div className="text-[10px] text-slate-600 mt-1">Struk Resmi Penjualan</div>
                </div>

                <div className="py-2 border-b border-dashed border-slate-400 space-y-1 text-[10px]">
                  <div className="flex justify-between">
                    <span>No. Struk:</span>
                    <span className="font-bold">{completedSale.receipt_number}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Tanggal:</span>
                    <span>{new Date(completedSale.created_at).toLocaleString('id-ID')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Kasir:</span>
                    <span>{completedSale.cashier_name}</span>
                  </div>
                </div>

                {/* Items */}
                <div className="py-2 border-b border-dashed border-slate-400 space-y-2">
                  {completedSale.lines.map((line, idx) => (
                    <div key={idx}>
                      <div className="font-semibold text-slate-900">{line.product_name}</div>
                      <div className="flex justify-between text-slate-700">
                        <span>
                          {line.quantity} x {formatIDR(line.unit_price)}
                        </span>
                        <span>{formatIDR(line.subtotal)}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Totals */}
                <div className="py-2 border-b border-dashed border-slate-400 space-y-1 text-slate-800">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span>{formatIDR(completedSale.subtotal)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-xs pt-1 border-t border-slate-300">
                    <span>TOTAL</span>
                    <span>{formatIDR(completedSale.total_amount)}</span>
                  </div>
                  <div className="flex justify-between text-[10px] pt-1">
                    <span>Bayar ({completedSale.payment_method.toUpperCase()})</span>
                    <span>{formatIDR(completedSale.amount_paid)}</span>
                  </div>
                  <div className="flex justify-between text-[10px]">
                    <span>Kembalian</span>
                    <span>{formatIDR(completedSale.change_due)}</span>
                  </div>
                </div>

                <div className="text-center pt-3 text-[10px] text-slate-600">
                  Terima kasih atas kunjungan Anda!<br />
                  Barang yang sudah dibeli tidak dapat ditukar.
                </div>
              </div>
            </div>

            <div className="p-3.5 border-t border-white/[0.08] bg-[#0e1520] flex gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 py-2.5 bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 rounded-lg text-xs font-semibold text-white flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Cetak Struk</span>
              </button>
              <button
                type="button"
                onClick={() => setCompletedSale(null)}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-xs font-bold text-white flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <span>Transaksi Baru</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
