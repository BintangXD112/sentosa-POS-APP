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
  Building,
  RefreshCw,
  Wifi,
  WifiOff
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
        const host = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
          ? (res.server_ip || window.location.hostname)
          : window.location.hostname;
        payUrl = `http://${host}:8080/api/v1/qris/confirm/${sid}`;
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
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 pb-28 lg:pb-8">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6">
        
        {/* Left Column: Product Catalog & Search (8 cols on desktop, full width on mobile) */}
        <div className="lg:col-span-8 space-y-4">
          
          {/* Top Bar: Search and Category Pills */}
          <div className="bg-slate-900/95 backdrop-blur border border-slate-800 rounded-2xl p-3 sm:p-4 shadow-sm">
            <div className="relative mb-3">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama produk, SKU, barcode... (Tekan '/' untuk fokus)"
                className="w-full pl-10 pr-9 py-2.5 bg-slate-800/80 border border-slate-700/80 rounded-xl text-xs sm:text-sm text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1 scrollbar-none text-xs">
              <button
                onClick={() => setSelectedCategory('')}
                className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-all active:scale-95 ${
                  selectedCategory === ''
                    ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 font-semibold shadow-sm shadow-emerald-500/10'
                    : 'bg-slate-800/80 text-slate-400 border border-slate-700/60 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                Semua Kategori
              </button>
              {categories.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedCategory(c.id)}
                  className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-all active:scale-95 ${
                    selectedCategory === c.id
                      ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 font-semibold shadow-sm shadow-emerald-500/10'
                      : 'bg-slate-800/80 text-slate-400 border border-slate-700/60 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>

          {/* Product Grid */}
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-3.5">
              {[...Array(8)].map((_, idx) => (
                <div key={idx} className="h-44 bg-slate-900/60 border border-slate-800/80 rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-10 sm:p-14 text-center text-slate-400">
              <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto mb-3 text-slate-500">
                <ShoppingBag className="w-6 h-6 stroke-[1.5]" />
              </div>
              <p className="text-sm font-medium text-slate-300">Tidak ada produk ditemukan</p>
              <p className="text-xs text-slate-500 mt-1">Coba gunakan kata kunci lain atau pilih kategori Semua</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-3.5">
              {products.map((p) => {
                const isOutOfStock = p.stock <= 0;
                const cartQty = items.find((i) => i.product.id === p.id)?.quantity || 0;

                return (
                  <div
                    key={p.id}
                    onClick={() => !isOutOfStock && addItem(p)}
                    className={`group relative bg-slate-900 border rounded-2xl p-3 sm:p-3.5 flex flex-col justify-between transition-all select-none ${
                      isOutOfStock
                        ? 'opacity-40 border-slate-800/70 cursor-not-allowed'
                        : 'border-slate-800 hover:border-emerald-500/40 hover:shadow-lg hover:shadow-emerald-500/5 cursor-pointer active:scale-[0.98]'
                    }`}
                  >
                    <div>
                      {/* Top Badges */}
                      <div className="flex items-center justify-between gap-1 mb-2">
                        <span className="text-[10px] text-slate-500 font-mono truncate">
                          {p.sku}
                        </span>
                        <span
                          className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${
                            p.stock > 10
                              ? 'bg-slate-800/90 text-slate-300 border border-slate-700/60'
                              : p.stock > 0
                              ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                              : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                          }`}
                        >
                          {p.stock > 0 ? `${p.stock} ${p.unit_symbol || 'pcs'}` : 'Habis'}
                        </span>
                      </div>

                      {/* Product Name */}
                      <h3 className="text-xs sm:text-sm font-semibold text-slate-100 line-clamp-2 leading-snug group-hover:text-emerald-300 transition-colors">
                        {p.name}
                      </h3>

                      {p.category_name && (
                        <span className="inline-block text-[10px] text-slate-500 mt-1 font-medium">
                          {p.category_name}
                        </span>
                      )}
                    </div>

                    {/* Price and Cart Indicator */}
                    <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between">
                      <span className="text-xs sm:text-sm font-bold text-emerald-400 font-mono">
                        {formatIDR(p.selling_price)}
                      </span>

                      {cartQty > 0 ? (
                        <span className="w-6 h-6 rounded-lg bg-emerald-500 text-slate-950 font-bold text-xs flex items-center justify-center shadow-md shadow-emerald-500/20 animate-in zoom-in-75 duration-150">
                          {cartQty}
                        </span>
                      ) : (
                        <div
                          className={`w-6 h-6 rounded-lg flex items-center justify-center transition-colors ${
                            isOutOfStock
                              ? 'bg-slate-800/40 text-slate-600'
                              : 'bg-slate-800 group-hover:bg-emerald-500/20 group-hover:text-emerald-300 text-slate-400'
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

        {/* Desktop Sticky Cart Panel (Visible only on lg screens) */}
        <div className="hidden lg:block lg:col-span-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl flex flex-col h-[calc(100vh-100px)] sticky top-6">
            {/* Cart Header */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                  <ShoppingBag className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white">Keranjang Kasir</h2>
                  <p className="text-[10px] text-slate-400">{items.reduce((acc, i) => acc + i.quantity, 0)} item dipilih</p>
                </div>
              </div>
              {items.length > 0 && (
                <button
                  onClick={clearCart}
                  className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 transition-colors px-2 py-1 rounded-lg hover:bg-rose-500/10"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Kosongkan</span>
                </button>
              )}
            </div>

            {/* Cart Items List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
              {items.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 py-12">
                  <div className="w-14 h-14 rounded-2xl bg-slate-800/60 border border-slate-800 flex items-center justify-center mb-3">
                    <ShoppingBag className="w-7 h-7 text-slate-600 stroke-[1.5]" />
                  </div>
                  <p className="text-xs font-semibold text-slate-400">Keranjang masih kosong</p>
                  <p className="text-[11px] text-slate-600 mt-1 text-center">Klik produk pada katalog di sebelah kiri untuk menambah pesanan</p>
                </div>
              ) : (
                items.map((i) => (
                  <div
                    key={i.product.id}
                    className="bg-slate-800/50 hover:bg-slate-800/80 border border-slate-700/60 rounded-xl p-3 flex flex-col justify-between transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-white truncate">{i.product.name}</div>
                        <div className="text-[11px] text-slate-400 font-mono mt-0.5">{formatIDR(i.product.selling_price)} / {i.product.unit_symbol || 'pcs'}</div>
                      </div>
                      <button
                        onClick={() => removeItem(i.product.id)}
                        className="text-slate-400 hover:text-rose-400 transition-colors p-1 rounded-md hover:bg-slate-700/50"
                        title="Hapus item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      {/* Qty Controls */}
                      <div className="flex items-center gap-1 bg-slate-900/90 rounded-lg p-0.5 border border-slate-700/80">
                        <button
                          onClick={() => updateQuantity(i.product.id, i.quantity - 1)}
                          className="w-6 h-6 rounded flex items-center justify-center text-slate-300 hover:bg-slate-800 active:scale-95 transition-all"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-7 text-center text-xs font-bold text-white font-mono">
                          {i.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(i.product.id, i.quantity + 1)}
                          disabled={i.quantity >= i.product.stock}
                          className="w-6 h-6 rounded flex items-center justify-center text-slate-300 hover:bg-slate-800 disabled:opacity-30 active:scale-95 transition-all"
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
            <div className="p-4 border-t border-slate-800 bg-slate-900/95 rounded-b-2xl">
              <div className="space-y-1.5 mb-4 text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>Subtotal</span>
                  <span className="font-mono text-slate-200">{formatIDR(subtotal)}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Pajak & Layanan</span>
                  <span className="font-mono text-slate-400">Termasuk</span>
                </div>
                <div className="flex justify-between text-sm font-bold text-white pt-2 border-t border-slate-800">
                  <span>Total Pembayaran</span>
                  <span className="text-base text-emerald-400 font-mono">{formatIDR(subtotal)}</span>
                </div>
              </div>

              <button
                disabled={items.length === 0}
                onClick={handleOpenCheckout}
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:hover:bg-emerald-600 text-white font-bold text-sm rounded-xl shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer"
              >
                <CreditCard className="w-4 h-4" />
                <span>Bayar Sekarang ({formatIDR(subtotal)})</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Bottom Cart Bar for Mobile & Tablet (when items > 0) */}
      {items.length > 0 && (
        <div className="lg:hidden fixed bottom-3 left-3 right-3 z-30 animate-in slide-in-from-bottom-4 duration-200">
          <div className="bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-2xl p-2.5 sm:p-3 shadow-2xl flex items-center justify-between gap-3">
            <button
              onClick={() => setIsMobileCartOpen(true)}
              className="flex items-center gap-2.5 text-left flex-1 min-w-0"
            >
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 flex-shrink-0 relative">
                <ShoppingBag className="w-5 h-5" />
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
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition-colors"
              >
                Keranjang
              </button>
              <button
                onClick={handleOpenCheckout}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-600/30 flex items-center gap-1.5 transition-all active:scale-95"
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
          className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setIsMobileCartOpen(false)}
        >
          <div
            className="bg-slate-900 border-t border-slate-800 rounded-t-3xl max-h-[85vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
                  <ShoppingBag className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Keranjang Pesanan</h3>
                  <p className="text-[10px] text-slate-400">{items.reduce((acc, i) => acc + i.quantity, 0)} item dipilih</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {items.length > 0 && (
                  <button
                    onClick={clearCart}
                    className="text-xs text-rose-400 hover:text-rose-300 px-2 py-1 rounded-lg"
                  >
                    Kosongkan
                  </button>
                )}
                <button
                  onClick={() => setIsMobileCartOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Drawer Items */}
            <div className="p-4 space-y-2.5 overflow-y-auto flex-1 max-h-[50vh]">
              {items.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-xs">
                  Keranjang kosong
                </div>
              ) : (
                items.map((i) => (
                  <div
                    key={i.product.id}
                    className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3 flex items-center justify-between gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-white truncate">{i.product.name}</div>
                      <div className="text-[11px] text-emerald-400 font-mono mt-0.5">
                        {formatIDR(i.product.selling_price * i.quantity)}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 bg-slate-900/90 rounded-lg p-0.5 border border-slate-700/80">
                      <button
                        onClick={() => updateQuantity(i.product.id, i.quantity - 1)}
                        className="w-7 h-7 rounded flex items-center justify-center text-slate-300 hover:bg-slate-800 active:scale-95"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="w-7 text-center text-xs font-bold text-white font-mono">
                        {i.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(i.product.id, i.quantity + 1)}
                        disabled={i.quantity >= i.product.stock}
                        className="w-7 h-7 rounded flex items-center justify-center text-slate-300 hover:bg-slate-800 disabled:opacity-30 active:scale-95"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Drawer Footer */}
            <div className="p-4 border-t border-slate-800 bg-slate-900/95 space-y-3">
              <div className="flex justify-between items-center text-sm font-bold text-white">
                <span>Total Tagihan</span>
                <span className="text-lg text-emerald-400 font-mono">{formatIDR(subtotal)}</span>
              </div>
              <button
                disabled={items.length === 0}
                onClick={() => {
                  setIsMobileCartOpen(false);
                  handleOpenCheckout();
                }}
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold text-sm rounded-xl shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all active:scale-95"
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
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg max-h-[92vh] flex flex-col overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between flex-shrink-0">
              <div>
                <h3 className="text-base font-bold text-white">Pembayaran Kasir</h3>
                <p className="text-xs text-slate-400">Pilih metode pembayaran dan masukkan jumlah uang</p>
              </div>
              <button
                onClick={() => setIsCheckoutOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-6 space-y-4 sm:space-y-5 overflow-y-auto flex-1">
              {checkoutError && (
                <div className="p-3 bg-rose-500/15 border border-rose-500/30 rounded-xl text-rose-400 text-xs">
                  {checkoutError}
                </div>
              )}

              {/* Total Display */}
              <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-3.5 sm:p-4 text-center">
                <div className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">Total Tagihan</div>
                <div className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono mt-1">
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
                    className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 text-xs transition-colors ${
                      paymentMethod === 'cash'
                        ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 font-bold'
                        : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    <Banknote className="w-5 h-5" />
                    <span>Tunai</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSelectPaymentMethod('qris')}
                    className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 text-xs transition-colors ${
                      paymentMethod === 'qris'
                        ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 font-bold'
                        : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    <QrCode className="w-5 h-5" />
                    <span>QRIS</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSelectPaymentMethod('transfer')}
                    className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 text-xs transition-colors ${
                      paymentMethod === 'transfer'
                        ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 font-bold'
                        : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    <Building className="w-5 h-5" />
                    <span>Transfer</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSelectPaymentMethod('debit')}
                    className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 text-xs transition-colors ${
                      paymentMethod === 'debit'
                        ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 font-bold'
                        : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    <CreditCard className="w-5 h-5" />
                    <span>Debit</span>
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
                    <input
                      type="number"
                      value={cashTendered || ''}
                      onChange={(e) => setCashTendered(Number(e.target.value))}
                      className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-lg font-mono font-bold text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  {/* Fast Presets */}
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setCashTendered(subtotal)}
                      className="px-3 py-1.5 bg-slate-800 border border-slate-700 hover:bg-slate-700 rounded-lg text-xs font-medium text-slate-200"
                    >
                      Uang Pas ({formatIDR(subtotal)})
                    </button>
                    {[50000, 100000, 200000, 500000].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setCashTendered(preset)}
                        className="px-3 py-1.5 bg-slate-800 border border-slate-700 hover:bg-slate-700 rounded-lg text-xs font-medium text-slate-200"
                      >
                        {formatIDR(preset)}
                      </button>
                    ))}
                  </div>

                  {/* Kembalian */}
                  <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-3 flex justify-between items-center text-sm">
                    <span className="text-slate-400">Kembalian:</span>
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
                      {/* QR Code */}
                      <div className="bg-white p-4 rounded-2xl shadow-lg border-4 border-emerald-500/40">
                        <QRCodeSVG
                          value={qrisPayUrl}
                          size={200}
                          level="M"
                          fgColor="#0f172a"
                        />
                      </div>

                      {/* Instruction */}
                      <div className="text-center space-y-1">
                        <div className="flex items-center justify-center gap-1.5 text-xs text-slate-400">
                          <Wifi className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                          <span>Menunggu pembayaran dari pelanggan...</span>
                        </div>
                        <p className="text-[11px] text-slate-500">
                          Scan QR di atas dengan kamera HP, lalu tekan <strong className="text-slate-400">Konfirmasi Pembayaran</strong>
                        </p>
                      </div>

                      {/* URL hint */}
                      <div className="w-full bg-slate-800/60 border border-slate-700 rounded-xl p-2.5 text-center space-y-1">
                        <p className="text-[10px] text-slate-500 break-all">{qrisPayUrl}</p>
                        <p className="text-[10px] text-amber-400/90 font-medium">
                          * Pastikan HP terhubung ke Wi-Fi / jaringan yang sama dengan kasir
                        </p>
                      </div>

                      {/* Refresh button */}
                      <button
                        type="button"
                        onClick={() => { setQrisStatus('idle'); startQrisSession(subtotal); }}
                        className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 transition-colors"
                      >
                        <RefreshCw className="w-3 h-3" /> Generate ulang QR
                      </button>
                    </div>
                  )}

                  {qrisStatus === 'paid' && (
                    <div className="flex flex-col items-center gap-3 py-4">
                      <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-500 flex items-center justify-center">
                        <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                      </div>
                      <div className="text-center">
                        <div className="text-sm font-bold text-emerald-400">Pembayaran Diterima!</div>
                        <div className="text-xs text-slate-400 mt-1">QRIS dikonfirmasi dari perangkat pelanggan</div>
                      </div>
                      <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-6 py-2 text-emerald-300 font-mono font-bold text-lg">
                        {formatIDR(subtotal)}
                      </div>
                    </div>
                  )}

                  {qrisStatus === 'idle' && (
                    <div className="flex items-center justify-center gap-2 py-6 text-slate-400 text-xs">
                      <WifiOff className="w-4 h-4" />
                      <span>Mempersiapkan sesi QRIS...</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="p-5 border-t border-slate-800 bg-slate-900/60 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsCheckoutOpen(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-semibold"
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
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold shadow-lg shadow-emerald-600/30 flex items-center gap-2 cursor-pointer"
              >
                {checkoutLoading ? (
                  <span>Memproses Transaksi...</span>
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
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm max-h-[92vh] flex flex-col overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <span className="font-bold text-white text-sm">Transaksi Berhasil</span>
              </div>
              <button
                onClick={() => setCompletedSale(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Thermal Struk Preview Box */}
            <div className="p-4 sm:p-6 bg-slate-950 flex justify-center overflow-y-auto flex-1">
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

            <div className="p-4 border-t border-slate-800 bg-slate-900 flex gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-xs font-semibold text-white flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Cetak Struk</span>
              </button>
              <button
                type="button"
                onClick={() => setCompletedSale(null)}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
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
