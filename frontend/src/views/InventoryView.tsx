import React, { useState, useEffect } from 'react';
import { 
  Boxes, 
  History, 
  AlertTriangle, 
  Edit3, 
  Trash2,
  X, 
  Search, 
  FileText,
  FileDown,
  Plus,
  PackagePlus,
  Tag,
  DollarSign,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { apiRequest } from '../api/client';
import { useAuthStore } from '../store/authStore';
import { exportInventoryReportPdf } from '../utils/pdfExport';
import type { InventoryMovement } from '../types';

interface InventoryItem {
  product_id: string;
  product_name: string;
  sku: string;
  barcode?: string;
  stock_quantity: number;
  min_stock_alert: number;
  unit_symbol?: string;
  category_name?: string;
}

interface CategoryItem { id: string; name: string; }
interface UnitItem { id: string; name: string; symbol: string; }

interface ProductFormState {
  name: string;
  sku: string;
  barcode: string;
  selling_price: string;
  cost_price: string;
  category_id: string;
  unit_id: string;
  initial_stock: string;
  min_stock_alert: string;
}

const emptyForm = (): ProductFormState => ({
  name: '', sku: '', barcode: '', selling_price: '', cost_price: '0',
  category_id: '', unit_id: '', initial_stock: '0', min_stock_alert: '5',
});

export const InventoryView: React.FC = () => {
  const { currentBranch, user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'stocks' | 'movements'>('stocks');
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Stock Adjustment Modal
  const [adjustingItem, setAdjustingItem] = useState<InventoryItem | null>(null);
  const [newStockVal, setNewStockVal] = useState<number>(0);
  const [adjustNotes, setAdjustNotes] = useState<string>('');
  const [adjustLoading, setAdjustLoading] = useState(false);
  const [adjustError, setAdjustError] = useState<string | null>(null);

  const canAdjustStock = user?.role === 'owner' || user?.role === 'branch_manager' || user?.role === 'inventory_staff';
  const canManageProducts = user?.role === 'owner' || user?.role === 'branch_manager' || user?.role === 'inventory_staff';
  const canDeleteProduct = user?.role === 'owner' || user?.role === 'branch_manager';

  // Delete Product Modal state
  const [deleteConfirmProduct, setDeleteConfirmProduct] = useState<InventoryItem | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Add/Edit Product Modal
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [productForm, setProductForm] = useState<ProductFormState>(emptyForm());
  const [productFormError, setProductFormError] = useState<string | null>(null);
  const [productFormLoading, setProductFormLoading] = useState(false);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [units, setUnits] = useState<UnitItem[]>([]);

  const handleDeleteProduct = async (item: InventoryItem) => {
    setDeleteLoading(true);
    try {
      await apiRequest(`/products/${item.product_id}`, {
        method: 'DELETE',
      });
      setDeleteConfirmProduct(null);
      loadStock();
    } catch (err: any) {
      alert(err.message || 'Gagal menghapus produk');
    } finally {
      setDeleteLoading(false);
    }
  };

  const loadStock = async () => {
    if (!currentBranch) return;
    setLoading(true);
    try {
      const res = await apiRequest<{ inventory: InventoryItem[] }>('/inventory');
      setInventory(res.inventory || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const loadMovements = async () => {
    if (!currentBranch) return;
    setLoading(true);
    try {
      const res = await apiRequest<{ movements: InventoryMovement[] }>('/inventory/movements?limit=100');
      setMovements(res.movements || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategoriesAndUnits = async () => {
    try {
      const [catRes, unitRes] = await Promise.all([
        apiRequest<{ categories: CategoryItem[] }>('/categories'),
        apiRequest<{ units: UnitItem[] }>('/units'),
      ]);
      setCategories(catRes.categories || []);
      setUnits(unitRes.units || []);
    } catch (e) {
      console.error(e);
    }
  };

  const handleOpenAdd = async () => {
    await fetchCategoriesAndUnits();
    setEditingProductId(null);
    setProductForm(emptyForm());
    setProductFormError(null);
    setShowProductModal(true);
  };

  const handleOpenEdit = async (item: InventoryItem) => {
    await fetchCategoriesAndUnits();
    setEditingProductId(item.product_id);
    // fetch product detail from /products to get cost_price + category/unit
    try {
      const res = await apiRequest<{ products: any[] }>(`/products?q=${encodeURIComponent(item.sku)}&limit=5`);
      const prod = res.products?.find((p: any) => p.id === item.product_id);
      setProductForm({
        name: item.product_name,
        sku: item.sku,
        barcode: item.barcode || '',
        selling_price: '', // will be filled from prod
        cost_price: prod?.cost_price?.toString() || '0',
        category_id: prod?.category_id || '',
        unit_id: prod?.unit_id || '',
        initial_stock: '',
        min_stock_alert: item.min_stock_alert?.toString() || '5',
      });
      if (prod) {
        setProductForm(prev => ({ ...prev, selling_price: prod.selling_price?.toString() || '' }));
      }
    } catch {
      setProductForm({
        name: item.product_name,
        sku: item.sku,
        barcode: item.barcode || '',
        selling_price: '',
        cost_price: '0',
        category_id: '',
        unit_id: '',
        initial_stock: '',
        min_stock_alert: item.min_stock_alert?.toString() || '5',
      });
    }
    setProductFormError(null);
    setShowProductModal(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = productForm.name.trim();
    const sku = productForm.sku.trim();
    const sellingPrice = parseInt(productForm.selling_price || '0', 10);
    if (!name || !sku) {
      setProductFormError('Nama produk dan SKU wajib diisi');
      return;
    }
    if (isNaN(sellingPrice) || sellingPrice < 0) {
      setProductFormError('Harga jual tidak valid');
      return;
    }

    setProductFormLoading(true);
    setProductFormError(null);
    try {
      const payload = {
        name,
        sku,
        barcode: productForm.barcode.trim(),
        selling_price: sellingPrice,
        cost_price: parseInt(productForm.cost_price || '0', 10),
        category_id: productForm.category_id,
        unit_id: productForm.unit_id,
        initial_stock: editingProductId ? 0 : parseInt(productForm.initial_stock || '0', 10),
        min_stock_alert: parseInt(productForm.min_stock_alert || '5', 10),
      };

      if (editingProductId) {
        await apiRequest(`/products/${editingProductId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        await apiRequest('/products', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }

      setShowProductModal(false);
      loadStock();
    } catch (err: any) {
      setProductFormError(err.message || 'Gagal menyimpan produk');
    } finally {
      setProductFormLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'stocks') {
      loadStock();
    } else {
      loadMovements();
    }
  }, [currentBranch, activeTab]);

  const handleOpenAdjust = (item: InventoryItem) => {
    setAdjustingItem(item);
    setNewStockVal(item.stock_quantity);
    setAdjustNotes('');
    setAdjustError(null);
  };

  const executeAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingItem) return;
    if (newStockVal < 0) {
      setAdjustError('Stok tidak boleh bernilai negatif');
      return;
    }

    setAdjustLoading(true);
    setAdjustError(null);

    try {
      await apiRequest('/inventory/adjust', {
        method: 'POST',
        body: JSON.stringify({
          product_id: adjustingItem.product_id,
          new_stock: newStockVal,
          notes: adjustNotes || 'Penyesuaian stok manual',
        }),
      });

      setAdjustingItem(null);
      loadStock();
    } catch (err: any) {
      setAdjustError(err.message || 'Gagal menyesuaikan stok');
    } finally {
      setAdjustLoading(false);
    }
  };

  const filteredInventory = inventory.filter((item) => {
    const q = searchQuery.toLowerCase();
    return (
      item.product_name.toLowerCase().includes(q) ||
      item.sku.toLowerCase().includes(q) ||
      (item.barcode && item.barcode.toLowerCase().includes(q))
    );
  });
  const activeItems = activeTab === 'stocks' ? filteredInventory : movements;
  const totalPages = Math.max(1, Math.ceil(activeItems.length / pageSize));
  const paginatedInventory = filteredInventory.slice((page - 1) * pageSize, page * pageSize);
  const paginatedMovements = movements.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    setPage(1);
  }, [activeTab, searchQuery]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Manajemen Inventaris</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Kelola stok dan periksa audit pergerakan barang di {currentBranch?.name}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Tab Switcher */}
          <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('stocks')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'stocks'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Boxes className="w-4 h-4" />
              <span>Stok Produk</span>
            </button>
            <button
              onClick={() => setActiveTab('movements')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'movements'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <History className="w-4 h-4" />
              <span>Audit Mutasi Stok</span>
            </button>
          </div>

          {/* Tambah Barang Button */}
          {canManageProducts && (
            <button
              onClick={handleOpenAdd}
              className="flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 transition-all cursor-pointer active:scale-95"
              title="Tambah produk baru ke katalog"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Barang</span>
            </button>
          )}

          {/* Export PDF Button */}
          <button
            onClick={() =>
              exportInventoryReportPdf({
                inventory: filteredInventory,
                branchName: currentBranch?.name,
                businessName: user?.business_name || 'Sentosa Retail Group',
                userName: user?.full_name || 'Petugas Inventaris',
              })
            }
            disabled={inventory.length === 0 || loading}
            className="flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
            title="Ekspor laporan status stok ke format PDF siap cetak"
          >
            <FileDown className="w-4 h-4" />
            <span>Export PDF</span>
          </button>
        </div>
      </div>

      {/* Tab 1: Current Branch Stocks */}
      {activeTab === 'stocks' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          {/* Filter Bar */}
          <div className="p-4 border-b border-slate-800 flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari produk di gudang..."
                className="w-full pl-10 pr-4 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div className="text-xs text-slate-400">
              Total: <span className="font-semibold text-slate-200">{filteredInventory.length} Produk</span>
            </div>
          </div>

          {/* Mobile Card List (Visible on mobile/tablet) */}
          <div className="md:hidden divide-y divide-slate-800/80">
            {loading ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                Memuat data inventaris...
              </div>
            ) : filteredInventory.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                Tidak ada data produk ditemukan.
              </div>
            ) : (
              paginatedInventory.map((item) => {
                const isLow = item.stock_quantity <= item.min_stock_alert;
                const isOut = item.stock_quantity <= 0;

                return (
                  <div key={item.product_id} className="p-4 space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-white leading-snug">{item.product_name}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[11px] text-slate-400 font-mono">{item.sku}</span>
                          {item.category_name && (
                            <span className="text-[10px] text-slate-400 px-1.5 py-0.5 rounded bg-slate-800/80 border border-slate-700/60">
                              {item.category_name}
                            </span>
                          )}
                        </div>
                      </div>
                      <div>
                        {isOut ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-rose-500/15 text-rose-300 border border-rose-500/30">
                            Habis
                          </span>
                        ) : isLow ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                            <AlertTriangle className="w-3 h-3" />
                            Menipis
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                            Tersedia
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <div>
                        <span className="text-[11px] text-slate-400 mr-1.5">Sisa Stok:</span>
                        <span className={`text-base font-bold font-mono ${isOut ? 'text-rose-400' : isLow ? 'text-amber-400' : 'text-emerald-400'}`}>
                          {item.stock_quantity}
                        </span>
                        <span className="text-xs text-slate-400 ml-1">
                          {item.unit_symbol || 'pcs'}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {canManageProducts && (
                          <button
                            onClick={() => handleOpenEdit(item)}
                            className="p-1.5 rounded-xl bg-slate-800 hover:bg-indigo-950/40 text-slate-400 hover:text-indigo-300 border border-slate-700 active:scale-95 transition-all"
                            title="Edit Produk"
                          >
                            <Tag className="w-3.5 h-3.5 text-indigo-400" />
                          </button>
                        )}
                        {canAdjustStock && (
                          <button
                            onClick={() => handleOpenAdjust(item)}
                            className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold inline-flex items-center gap-1 border border-slate-700 active:scale-95 transition-all"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Sesuaikan</span>
                          </button>
                        )}
                        {canDeleteProduct && (
                          <button
                            onClick={() => setDeleteConfirmProduct(item)}
                            className="p-1.5 rounded-xl bg-slate-800 hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 border border-slate-700 active:scale-95 transition-all"
                            title="Hapus Produk"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-800/50 text-slate-400 font-semibold border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3">Produk</th>
                  <th className="px-4 py-3">SKU / Barcode</th>
                  <th className="px-4 py-3">Kategori</th>
                  <th className="px-4 py-3 text-right">Stok Saat Ini</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                      Memuat data inventaris...
                    </td>
                  </tr>
                ) : filteredInventory.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                      Tidak ada data produk ditemukan.
                    </td>
                  </tr>
                ) : (
                  paginatedInventory.map((item) => {
                    const isLow = item.stock_quantity <= item.min_stock_alert;
                    const isOut = item.stock_quantity <= 0;

                    return (
                      <tr key={item.product_id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-4 py-3 font-medium text-white">
                          {item.product_name}
                        </td>
                        <td className="px-4 py-3 text-slate-400 font-mono">
                          <div>{item.sku}</div>
                          {item.barcode && <div className="text-[10px] text-slate-500">{item.barcode}</div>}
                        </td>
                        <td className="px-4 py-3 text-slate-400">
                          {item.category_name || '-'}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-white">
                          <span className={isOut ? 'text-rose-400' : isLow ? 'text-amber-400' : 'text-slate-100'}>
                            {item.stock_quantity}
                          </span>
                          <span className="text-[11px] text-slate-400 ml-1 font-normal">
                            {item.unit_symbol || 'pcs'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {isOut ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                              Habis
                            </span>
                          ) : isLow ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              <AlertTriangle className="w-3 h-3" />
                              Menipis
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              Tersedia
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {canManageProducts && (
                              <button
                                onClick={() => handleOpenEdit(item)}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-indigo-950/40 text-slate-400 hover:text-indigo-300 transition-colors inline-flex items-center"
                                title="Edit Produk"
                              >
                                <Tag className="w-3.5 h-3.5 text-indigo-400" />
                              </button>
                            )}
                            {canAdjustStock && (
                              <button
                                onClick={() => handleOpenAdjust(item)}
                                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors inline-flex items-center gap-1 text-[11px]"
                              >
                                <Edit3 className="w-3.5 h-3.5 text-emerald-400" />
                                <span>Sesuaikan</span>
                              </button>
                            )}
                            {canDeleteProduct && (
                              <button
                                onClick={() => setDeleteConfirmProduct(item)}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950/40 text-slate-400 hover:text-rose-300 transition-colors inline-flex items-center"
                                title="Hapus Produk"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-slate-800 px-4 py-3 text-xs text-slate-400">
            <span>Menampilkan {paginatedInventory.length} dari {filteredInventory.length} produk</span>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1 || loading} className="rounded-lg border border-slate-700 bg-slate-800 p-1.5 disabled:cursor-not-allowed disabled:opacity-40" aria-label="Halaman inventaris sebelumnya"><ChevronLeft className="h-4 w-4" /></button>
              <span className="font-mono text-slate-300">{page}/{totalPages}</span>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages || loading} className="rounded-lg border border-slate-700 bg-slate-800 p-1.5 disabled:cursor-not-allowed disabled:opacity-40" aria-label="Halaman inventaris berikutnya"><ChevronRight className="h-4 w-4" /></button>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Inventory Movements Audit Log */}
      {activeTab === 'movements' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-emerald-400" />
              <h2 className="text-sm font-semibold text-white">Catatan Mutasi & Audit Stok</h2>
            </div>
            <span className="text-xs text-slate-400">100 Aktivitas Terakhir</span>
          </div>

          {/* Mobile Movement Cards (Visible on mobile/tablet) */}
          <div className="md:hidden divide-y divide-slate-800/80">
            {loading ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                Memuat catatan mutasi...
              </div>
            ) : movements.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                Belum ada riwayat mutasi stok.
              </div>
            ) : (
              paginatedMovements.map((m) => {
                const isPositive = m.quantity > 0;
                const typeBadge: Record<string, { label: string; color: string }> = {
                  receiving: { label: 'Masuk / Stok Awal', color: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
                  sale: { label: 'Penjualan', color: 'bg-blue-500/15 text-blue-300 border-blue-500/30' },
                  adjustment: { label: 'Penyesuaian', color: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
                  transfer_in: { label: 'Transfer Masuk', color: 'bg-teal-500/15 text-teal-300 border-teal-500/30' },
                  transfer_out: { label: 'Transfer Keluar', color: 'bg-purple-500/15 text-purple-300 border-purple-500/30' },
                };
                const badge = typeBadge[m.movement_type] || { label: m.movement_type, color: 'bg-slate-800 text-slate-300' };

                return (
                  <div key={m.id} className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-white truncate">{m.product_name}</div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">{new Date(m.created_at).toLocaleString('id-ID')}</div>
                      </div>
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold border ${badge.color}`}>
                        {badge.label}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1">
                      <div className="text-slate-400 text-[11px]">
                        Petugas: <span className="text-slate-200 font-medium">{m.actor_name || '-'}</span>
                      </div>
                      <div className="text-right">
                        <span className={`font-mono font-bold text-xs ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {isPositive ? `+${m.quantity}` : m.quantity}
                        </span>
                        <span className="text-[10px] text-slate-500 ml-1.5 font-mono">
                          (Sisa: {m.balance_after})
                        </span>
                      </div>
                    </div>

                    {(m.notes || m.reference_id) && (
                      <div className="text-[11px] text-slate-400 bg-slate-800/40 p-2 rounded-lg border border-slate-800/80 font-mono">
                        <span className="text-emerald-400 mr-1.5">[{m.reference_id}]</span>
                        <span className="font-sans text-slate-300">{m.notes}</span>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Desktop Table (Hidden on mobile) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-800/50 text-slate-400 font-semibold border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3">Waktu</th>
                  <th className="px-4 py-3">Produk</th>
                  <th className="px-4 py-3 text-center">Tipe Mutasi</th>
                  <th className="px-4 py-3 text-right">Perubahan Qty</th>
                  <th className="px-4 py-3 text-right">Sisa Stok Akhir</th>
                  <th className="px-4 py-3">Referensi / Keterangan</th>
                  <th className="px-4 py-3">Petugas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-500 font-sans">
                      Memuat catatan mutasi...
                    </td>
                  </tr>
                ) : movements.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-500 font-sans">
                      Belum ada riwayat mutasi stok.
                    </td>
                  </tr>
                ) : (
                  paginatedMovements.map((m) => {
                    const isPositive = m.quantity > 0;
                    const typeBadge: Record<string, { label: string; color: string }> = {
                      receiving: { label: 'Masuk / Stok Awal', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
                      sale: { label: 'Penjualan', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
                      adjustment: { label: 'Penyesuaian', color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
                      transfer_in: { label: 'Transfer Masuk', color: 'bg-teal-500/20 text-teal-300 border-teal-500/30' },
                      transfer_out: { label: 'Transfer Keluar', color: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
                    };
                    const badge = typeBadge[m.movement_type] || { label: m.movement_type, color: 'bg-slate-800 text-slate-300' };

                    return (
                      <tr key={m.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-4 py-3 text-slate-400 text-[11px] whitespace-nowrap font-sans">
                          {new Date(m.created_at).toLocaleString('id-ID')}
                        </td>
                        <td className="px-4 py-3 font-sans font-medium text-white">
                          <div>{m.product_name}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{m.sku}</div>
                        </td>
                        <td className="px-4 py-3 text-center font-sans">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold border ${badge.color}`}>
                            {badge.label}
                          </span>
                        </td>
                        <td className={`px-4 py-3 text-right font-bold ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {isPositive ? `+${m.quantity}` : m.quantity}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-slate-200">
                          {m.balance_after}
                        </td>
                        <td className="px-4 py-3 font-sans text-slate-300 max-w-xs truncate text-[11px]">
                          <span className="font-mono text-emerald-400 mr-1">[{m.reference_id}]</span>
                          {m.notes || '-'}
                        </td>
                        <td className="px-4 py-3 font-sans text-slate-400 text-[11px]">
                          {m.actor_name || '-'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-slate-800 px-4 py-3 text-xs text-slate-400">
            <span>Menampilkan {paginatedMovements.length} dari {movements.length} aktivitas</span>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1 || loading} className="rounded-lg border border-slate-700 bg-slate-800 p-1.5 disabled:cursor-not-allowed disabled:opacity-40" aria-label="Halaman mutasi sebelumnya"><ChevronLeft className="h-4 w-4" /></button>
              <span className="font-mono text-slate-300">{page}/{totalPages}</span>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages || loading} className="rounded-lg border border-slate-700 bg-slate-800 p-1.5 disabled:cursor-not-allowed disabled:opacity-40" aria-label="Halaman mutasi berikutnya"><ChevronRight className="h-4 w-4" /></button>
            </div>
          </div>
        </div>
      )}

      {/* Stock Adjustment Dialog */}
      {adjustingItem && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md max-h-[92vh] flex flex-col overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">Sesuaikan Stok Fisik</h3>
              </div>
              <button
                onClick={() => setAdjustingItem(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={executeAdjustment} className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
              {adjustError && (
                <div className="p-3 bg-rose-500/15 border border-rose-500/30 rounded-xl text-rose-400 text-xs">
                  {adjustError}
                </div>
              )}

              <div>
                <label className="block text-xs text-slate-400 mb-0.5">Nama Produk</label>
                <div className="text-sm font-bold text-white">{adjustingItem.product_name}</div>
                <div className="text-xs text-slate-500 font-mono mt-0.5">SKU: {adjustingItem.sku}</div>
              </div>

              <div className="grid grid-cols-2 gap-3 bg-slate-800/50 p-3 rounded-xl border border-slate-800">
                <div>
                  <div className="text-[11px] text-slate-400">Stok Sistem</div>
                  <div className="text-base font-mono font-bold text-slate-300">
                    {adjustingItem.stock_quantity} {adjustingItem.unit_symbol || 'pcs'}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-400">Selisih</div>
                  <div className={`text-base font-mono font-bold ${newStockVal - adjustingItem.stock_quantity >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {newStockVal - adjustingItem.stock_quantity >= 0 ? `+${newStockVal - adjustingItem.stock_quantity}` : newStockVal - adjustingItem.stock_quantity}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Stok Fisik Sebenarnya
                </label>
                <input
                  type="number"
                  min="0"
                  value={newStockVal}
                  onChange={(e) => setNewStockVal(Math.max(0, Number(e.target.value)))}
                  className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-lg font-mono font-bold text-white focus:outline-none focus:border-emerald-500"
                  required
                />
                {/* Fast Nudge Buttons */}
                <div className="flex gap-1.5 mt-2">
                  {[-5, -1, 1, 5, 10].map((delta) => (
                    <button
                      key={delta}
                      type="button"
                      onClick={() => setNewStockVal((curr) => Math.max(0, curr + delta))}
                      className="flex-1 py-1 px-2 bg-slate-800/80 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs font-mono text-slate-300 active:scale-95 transition-all"
                    >
                      {delta > 0 ? `+${delta}` : delta}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Alasan Penyesuaian (Audit Log)
                </label>
                <textarea
                  value={adjustNotes}
                  onChange={(e) => setAdjustNotes(e.target.value)}
                  placeholder="Contoh: Stok opname bulanan, barang rusak, atau retur..."
                  rows={2}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAdjustingItem(null)}
                  className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={adjustLoading}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold shadow-md shadow-emerald-600/30 cursor-pointer active:scale-95 transition-all"
                >
                  {adjustLoading ? 'Menyimpan...' : 'Simpan Penyesuaian'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Delete Product Confirmation Modal */}
      {deleteConfirmProduct && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm p-5 space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30">
                <Trash2 className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-white">Hapus Produk</h3>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Apakah Anda yakin ingin menghapus produk <strong className="text-white">{deleteConfirmProduct.product_name}</strong> (SKU: {deleteConfirmProduct.sku})?
              <br /><br />
              <span className="text-slate-400">
                Produk ini akan dinonaktifkan dari katalog penjualan dan tidak akan muncul lagi di kasir. Riwayat transaksi sebelumnya tetap aman tersimpan.
              </span>
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setDeleteConfirmProduct(null)}
                className="px-3.5 py-2 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-semibold"
              >
                Batal
              </button>
              <button
                onClick={() => handleDeleteProduct(deleteConfirmProduct)}
                disabled={deleteLoading}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-bold shadow-md shadow-rose-600/30 cursor-pointer active:scale-95 transition-all"
              >
                {deleteLoading ? 'Menghapus...' : 'Ya, Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Product Modal */}
      {showProductModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl max-h-[94vh] flex flex-col overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
                  <PackagePlus className="w-4 h-4 text-indigo-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    {editingProductId ? 'Edit Data Produk' : 'Tambah Produk Baru'}
                  </h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {editingProductId ? 'Perbarui informasi produk di katalog' : 'Daftarkan produk baru ke katalog & stok cabang'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowProductModal(false)}
                className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveProduct} className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
              {productFormError && (
                <div className="p-3 bg-rose-500/15 border border-rose-500/30 rounded-xl text-rose-400 text-xs flex items-start gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                  <span>{productFormError}</span>
                </div>
              )}

              {/* Nama Produk */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Nama Produk <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={productForm.name}
                  onChange={(e) => setProductForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="Contoh: Aqua Botol 600ml"
                  className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                  required
                />
              </div>

              {/* SKU + Barcode */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    SKU <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={productForm.sku}
                    onChange={(e) => setProductForm(p => ({ ...p, sku: e.target.value }))}
                    placeholder="Contoh: AQU-600"
                    className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Barcode</label>
                  <input
                    type="text"
                    value={productForm.barcode}
                    onChange={(e) => setProductForm(p => ({ ...p, barcode: e.target.value }))}
                    placeholder="Scan / ketik barcode"
                    className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors font-mono"
                  />
                </div>
              </div>

              {/* Harga Jual + Harga Modal */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Harga Jual (Rp) <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <DollarSign className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="number"
                      min="0"
                      value={productForm.selling_price}
                      onChange={(e) => setProductForm(p => ({ ...p, selling_price: e.target.value }))}
                      placeholder="0"
                      className="w-full pl-8 pr-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors font-mono"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Harga Modal (Rp)</label>
                  <div className="relative">
                    <DollarSign className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="number"
                      min="0"
                      value={productForm.cost_price}
                      onChange={(e) => setProductForm(p => ({ ...p, cost_price: e.target.value }))}
                      placeholder="0"
                      className="w-full pl-8 pr-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Kategori + Satuan */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Kategori</label>
                  <select
                    value={productForm.category_id}
                    onChange={(e) => setProductForm(p => ({ ...p, category_id: e.target.value }))}
                    className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                  >
                    <option value="">-- Tanpa Kategori --</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Satuan</label>
                  <select
                    value={productForm.unit_id}
                    onChange={(e) => setProductForm(p => ({ ...p, unit_id: e.target.value }))}
                    className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                  >
                    <option value="">-- Tanpa Satuan --</option>
                    {units.map((u) => (
                      <option key={u.id} value={u.id}>{u.name} ({u.symbol})</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Stok Awal (hanya saat tambah baru) + Min Alert */}
              <div className="grid grid-cols-2 gap-3">
                {!editingProductId && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">Stok Awal</label>
                    <input
                      type="number"
                      min="0"
                      value={productForm.initial_stock}
                      onChange={(e) => setProductForm(p => ({ ...p, initial_stock: e.target.value }))}
                      className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors font-mono"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">Tercatat sebagai mutasi 'receiving'</p>
                  </div>
                )}
                <div className={editingProductId ? 'col-span-2' : ''}>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Alert Stok Minimum</label>
                  <input
                    type="number"
                    min="0"
                    value={productForm.min_stock_alert}
                    onChange={(e) => setProductForm(p => ({ ...p, min_stock_alert: e.target.value }))}
                    className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors font-mono"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">Muncul peringatan 'Stok Menipis' di bawah nilai ini</p>
                </div>
              </div>

              {/* Actions */}
              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowProductModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-semibold transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={productFormLoading}
                  className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold shadow-md shadow-indigo-600/30 cursor-pointer active:scale-95 transition-all flex items-center gap-2"
                >
                  <PackagePlus className="w-3.5 h-3.5" />
                  {productFormLoading ? 'Menyimpan...' : (editingProductId ? 'Simpan Perubahan' : 'Tambah Produk')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
