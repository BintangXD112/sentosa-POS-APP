import React, { useState, useEffect } from 'react';
import {
  Truck,
  Plus,
  PackagePlus,
  Search,
  Phone,
  Mail,
  MapPin,
  Building2,
  Edit2,
  Trash2,
  X,
  Boxes,
  History,
  ArrowDownLeft,
  ChevronLeft,
  ChevronRight,
  AlertCircle
} from 'lucide-react';
import { apiRequest } from '../api/client';
import { useAuthStore } from '../store/authStore';
import type { Supplier, Product, InventoryMovement } from '../types';

export const SuppliersView: React.FC = () => {
  const { currentBranch, user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'suppliers' | 'history'>('suppliers');
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [receivingMovements, setReceivingMovements] = useState<InventoryMovement[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 9;

  // Supplier Add/Edit Modal
  const [supplierModalOpen, setSupplierModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [sName, setSName] = useState('');
  const [sContact, setSContact] = useState('');
  const [sPhone, setSPhone] = useState('');
  const [sEmail, setSEmail] = useState('');
  const [sAddress, setSAddress] = useState('');
  const [sNotes, setSNotes] = useState('');
  const [supplierSaving, setSupplierSaving] = useState(false);
  const [supplierError, setSupplierError] = useState<string | null>(null);

  // Delete Supplier Confirmation
  const [deleteConfirmSupplier, setDeleteConfirmSupplier] = useState<Supplier | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Inbound Restock Modal (Supports Multi-Item)
  const [restockModalOpen, setRestockModalOpen] = useState(false);
  const [restockSupplierId, setRestockSupplierId] = useState<string>('');
  const [restockItems, setRestockItems] = useState<
    Array<{ id: string; productId: string; quantity: number }>
  >([]);
  const [restockRef, setRestockRef] = useState<string>('');
  const [restockNotes, setRestockNotes] = useState<string>('');
  const [restockSaving, setRestockSaving] = useState(false);
  const [restockSuccessMsg, setRestockSuccessMsg] = useState<string | null>(null);
  const [restockError, setRestockError] = useState<string | null>(null);

  const canManageSuppliers = user?.role === 'owner' || user?.role === 'branch_manager' || user?.role === 'inventory_staff';

  const loadSuppliers = async () => {
    setLoading(true);
    try {
      const res = await apiRequest<{ suppliers: Supplier[] }>('/suppliers');
      setSuppliers(res.suppliers || []);
    } catch (err) {
      console.error('Failed to load suppliers:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadProducts = async () => {
    if (!currentBranch) return;
    try {
      const res = await apiRequest<{ products: Product[] }>('/products?limit=150');
      setProducts(res.products || []);
    } catch (err) {
      console.error('Failed to load products:', err);
    }
  };

  const loadReceivingHistory = async () => {
    if (!currentBranch) return;
    setLoading(true);
    try {
      const res = await apiRequest<{ movements: InventoryMovement[] }>('/inventory/movements?limit=100');
      const receiving = (res.movements || []).filter((m) => m.movement_type === 'receiving');
      setReceivingMovements(receiving);
    } catch (err) {
      console.error('Failed to load receiving history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSuppliers();
    loadProducts();
  }, [currentBranch]);

  useEffect(() => {
    if (activeTab === 'history') {
      loadReceivingHistory();
    } else {
      loadSuppliers();
    }
  }, [activeTab, currentBranch]);

  const handleOpenAddSupplier = () => {
    setEditingSupplier(null);
    setSName('');
    setSContact('');
    setSPhone('');
    setSEmail('');
    setSAddress('');
    setSNotes('');
    setSupplierError(null);
    setSupplierModalOpen(true);
  };

  const handleOpenEditSupplier = (s: Supplier) => {
    setEditingSupplier(s);
    setSName(s.name);
    setSContact(s.contact_person || '');
    setSPhone(s.phone || '');
    setSEmail(s.email || '');
    setSAddress(s.address || '');
    setSNotes(s.notes || '');
    setSupplierError(null);
    setSupplierModalOpen(true);
  };

  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sName.trim()) {
      setSupplierError('Nama supplier wajib diisi');
      return;
    }

    setSupplierSaving(true);
    setSupplierError(null);
    try {
      if (editingSupplier) {
        await apiRequest(`/suppliers/${editingSupplier.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            name: sName.trim(),
            contact_person: sContact.trim(),
            phone: sPhone.trim(),
            email: sEmail.trim(),
            address: sAddress.trim(),
            notes: sNotes.trim(),
          }),
        });
      } else {
        await apiRequest('/suppliers', {
          method: 'POST',
          body: JSON.stringify({
            name: sName.trim(),
            contact_person: sContact.trim(),
            phone: sPhone.trim(),
            email: sEmail.trim(),
            address: sAddress.trim(),
            notes: sNotes.trim(),
          }),
        });
      }

      setSupplierModalOpen(false);
      loadSuppliers();
    } catch (err: any) {
      setSupplierError(err.message || 'Gagal menyimpan data supplier');
    } finally {
      setSupplierSaving(false);
    }
  };

  const handleDeleteSupplier = async (s: Supplier) => {
    setDeleteLoading(true);
    try {
      await apiRequest(`/suppliers/${s.id}`, {
        method: 'DELETE',
      });
      setDeleteConfirmSupplier(null);
      loadSuppliers();
    } catch (err: any) {
      alert(err.message || 'Gagal menghapus supplier');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleOpenRestock = (preselectSupplierId?: string) => {
    setRestockSupplierId(preselectSupplierId || (suppliers.length > 0 ? suppliers[0].id : ''));
    setRestockItems([
      {
        id: `item-${Date.now()}-1`,
        productId: products.length > 0 ? products[0].id : '',
        quantity: 10,
      },
    ]);
    setRestockRef(`PO-${Date.now().toString().slice(-6)}`);
    setRestockNotes('');
    setRestockError(null);
    setRestockSuccessMsg(null);
    setRestockModalOpen(true);
  };

  const handleAddRestockItem = () => {
    const selectedIds = new Set(restockItems.map((it) => it.productId));
    const available = products.find((p) => !selectedIds.has(p.id));
    const nextProdId = available ? available.id : (products.length > 0 ? products[0].id : '');
    setRestockItems((prev) => [
      ...prev,
      {
        id: `item-${Date.now()}-${prev.length + 1}`,
        productId: nextProdId,
        quantity: 10,
      },
    ]);
  };

  const handleRemoveRestockItem = (id: string) => {
    if (restockItems.length <= 1) return;
    setRestockItems((prev) => prev.filter((it) => it.id !== id));
  };

  const handleUpdateRestockProduct = (id: string, productId: string) => {
    setRestockItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, productId } : it))
    );
  };

  const handleUpdateRestockQty = (id: string, qty: number) => {
    setRestockItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, quantity: Math.max(1, qty) } : it))
    );
  };

  const handleExecuteRestock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentBranch) {
      setRestockError('Cabang tujuan belum dipilih');
      return;
    }
    if (restockItems.length === 0) {
      setRestockError('Pilih minimal satu barang untuk dipasok');
      return;
    }
    for (let i = 0; i < restockItems.length; i++) {
      const it = restockItems[i];
      if (!it.productId) {
        setRestockError(`Baris #${i + 1}: Silakan pilih produk terlebih dahulu`);
        return;
      }
      if (!it.quantity || it.quantity <= 0) {
        setRestockError(`Baris #${i + 1}: Jumlah pasokan harus lebih dari 0`);
        return;
      }
    }

    setRestockSaving(true);
    setRestockError(null);
    setRestockSuccessMsg(null);

    try {
      const res = await apiRequest<{
        message: string;
        total_items: number;
        total_quantity: number;
        items?: Array<{ product_name: string; new_stock: number; added_qty: number }>;
      }>('/suppliers/restock', {
        method: 'POST',
        body: JSON.stringify({
          supplier_id: restockSupplierId || undefined,
          branch_id: currentBranch.id,
          items: restockItems.map((it) => ({
            product_id: it.productId,
            quantity: it.quantity,
          })),
          reference_id: restockRef,
          notes: restockNotes,
        }),
      });

      setRestockSuccessMsg(
        `✓ ${res.message || 'Pasokan stok berhasil diproses'}!`
      );
      loadProducts();
      loadSuppliers();
      if (activeTab === 'history') {
        loadReceivingHistory();
      }
      setTimeout(() => {
        setRestockModalOpen(false);
        setRestockSuccessMsg(null);
      }, 1200);
    } catch (err: any) {
      setRestockError(err.message || 'Gagal memproses pasokan stok');
    } finally {
      setRestockSaving(false);
    }
  };

  const filteredSuppliers = suppliers.filter((s) => {
    const q = searchQuery.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      (s.contact_person && s.contact_person.toLowerCase().includes(q)) ||
      (s.phone && s.phone.toLowerCase().includes(q)) ||
      (s.email && s.email.toLowerCase().includes(q))
    );
  });
  const activeItems = activeTab === 'suppliers' ? filteredSuppliers : receivingMovements;
  const totalPages = Math.max(1, Math.ceil(activeItems.length / pageSize));
  const paginatedSuppliers = filteredSuppliers.slice((page - 1) * pageSize, page * pageSize);
  const paginatedReceiving = receivingMovements.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    setPage(1);
  }, [activeTab, searchQuery]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  return (
    <div className="max-w-[1500px] mx-auto px-4 sm:px-6 py-5 space-y-5">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.07] pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-emerald-400">Rantai Pasokan</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            {currentBranch && (
              <span className="text-xs text-slate-400">
                • Cabang <strong className="text-white font-medium">{currentBranch.name}</strong>
              </span>
            )}
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <span>Supplier & Pasokan Inbound</span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Kelola mitra vendor, pencatatan surat jalan/faktur, dan penerimaan pasokan barang masuk
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {canManageSuppliers && (
            <>
              <button
                onClick={() => handleOpenRestock()}
                className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-950/40 cursor-pointer transition-colors active:scale-95"
              >
                <PackagePlus className="w-4 h-4" />
                <span>+ Pasok Stok (Inbound)</span>
              </button>

              <button
                onClick={handleOpenAddSupplier}
                className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#0e1520] hover:bg-white/[0.06] border border-white/10 text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4 text-emerald-400" />
                <span>Tambah Supplier</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="bg-[#0e1520] border border-white/[0.07] rounded-xl p-4 sm:p-5 flex items-center justify-between hover:border-white/[0.12] transition-colors">
          <div>
            <div className="text-xs text-slate-400 font-medium">Mitra Supplier Terdaftar</div>
            <div className="text-2xl font-bold font-mono text-white mt-1">{suppliers.length}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">Vendor rekanan aktif</div>
          </div>
          <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
            <Truck className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-[#0e1520] border border-white/[0.07] rounded-xl p-4 sm:p-5 flex items-center justify-between hover:border-white/[0.12] transition-colors">
          <div>
            <div className="text-xs text-slate-400 font-medium">Katalog Produk Cabang</div>
            <div className="text-2xl font-bold font-mono text-white mt-1">{products.length}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">Barang siap menerima stok</div>
          </div>
          <div className="w-9 h-9 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center justify-center">
            <Boxes className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-[#0e1520] border border-white/[0.07] rounded-xl p-4 sm:p-5 flex items-center justify-between hover:border-white/[0.12] transition-colors">
          <div>
            <div className="text-xs text-slate-400 font-medium">Cabang Penerima Aktif</div>
            <div className="text-lg font-bold text-emerald-400 mt-1 truncate">
              {currentBranch?.name || 'Semua Cabang'}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">Tujuan alokasi inventaris</div>
          </div>
          <div className="w-9 h-9 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center">
            <Building2 className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Tabs Switcher & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1 bg-[#0b1019] border border-white/[0.08] p-1 rounded-lg">
          <button
            onClick={() => setActiveTab('suppliers')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'suppliers'
                ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Truck className="w-3.5 h-3.5" />
            <span>Direktori Supplier ({suppliers.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'history'
                ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Riwayat Pasokan Masuk</span>
          </button>
        </div>

        {activeTab === 'suppliers' && (
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama supplier, PIC, telepon..."
              className="w-full pl-10 pr-4 py-2 bg-[#080d15] border border-white/10 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/60 font-sans"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Tab 1: Supplier Directory Cards */}
      {activeTab === 'suppliers' && (
        <div>
          {loading ? (
            <div className="py-12 text-center text-xs text-slate-500 font-mono">Memuat data mitra supplier...</div>
          ) : filteredSuppliers.length === 0 ? (
            <div className="bg-[#0e1520] border border-white/[0.07] rounded-xl p-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-xl bg-white/[0.03] border border-white/10 flex items-center justify-center mx-auto text-slate-400">
                <Truck className="w-6 h-6 stroke-[1.5]" />
              </div>
              <div className="text-sm font-bold text-white">Belum Ada Data Mitra Supplier</div>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Daftarkan vendor atau distributor untuk mempermudah pencatatan pasokan stok barang secara rapi dan akuntabel.
              </p>
              {canManageSuppliers && (
                <button
                  onClick={handleOpenAddSupplier}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg shadow-sm cursor-pointer transition-colors inline-flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Tambah Supplier Pertama</span>
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {paginatedSuppliers.map((s) => (
                  <div
                    key={s.id}
                    className="bg-[#0e1520] border border-white/[0.07] hover:border-white/20 rounded-xl p-4 sm:p-5 flex flex-col justify-between shadow-sm transition-all"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <h3 className="text-sm font-bold text-white truncate">{s.name}</h3>
                          {s.contact_person && (
                            <div className="text-xs text-emerald-400 font-medium mt-0.5">
                              PIC: {s.contact_person}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {canManageSuppliers && (
                            <>
                              <button
                                onClick={() => handleOpenEditSupplier(s)}
                                className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-slate-400 hover:text-white border border-white/10 transition-colors cursor-pointer"
                                title="Edit Detail Supplier"
                              >
                                <Edit2 className="w-3.5 h-3.5 text-emerald-400" />
                              </button>
                              <button
                                onClick={() => setDeleteConfirmSupplier(s)}
                                className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition-colors cursor-pointer"
                                title="Hapus Supplier"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Contact Details */}
                      <div className="mt-4 space-y-2 text-xs text-slate-400">
                        {s.phone && (
                          <div className="flex items-center gap-2">
                            <Phone className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                            <a href={`tel:${s.phone}`} className="hover:text-emerald-400 transition-colors font-mono">
                              {s.phone}
                            </a>
                          </div>
                        )}
                        {s.email && (
                          <div className="flex items-center gap-2">
                            <Mail className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                            <a href={`mailto:${s.email}`} className="hover:text-emerald-400 transition-colors truncate">
                              {s.email}
                            </a>
                          </div>
                        )}
                        {s.address && (
                          <div className="flex items-start gap-2">
                            <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                            <span className="line-clamp-2">{s.address}</span>
                          </div>
                        )}
                        {s.notes && (
                          <div className="p-2 rounded-lg bg-[#080d15] border border-white/[0.06] text-[11px] text-slate-400 line-clamp-2">
                            {s.notes}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Restock Action Button */}
                    <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-between">
                      <span className="text-[11px] text-slate-500 font-mono">
                        {s.total_supplies > 0 ? `${s.total_supplies}x pasokan` : 'Belum ada pasokan'}
                      </span>
                      {canManageSuppliers && (
                        <button
                          onClick={() => handleOpenRestock(s.id)}
                          className="px-2.5 py-1 rounded-md bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/20 text-xs font-semibold transition-colors inline-flex items-center gap-1 cursor-pointer"
                        >
                          <PackagePlus className="w-3.5 h-3.5" />
                          <span>Pasok Stok</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              <div className="mt-4 flex items-center justify-between border-t border-white/[0.07] pt-3 text-xs text-slate-400">
                <span className="font-mono">Menampilkan {paginatedSuppliers.length} dari {filteredSuppliers.length} supplier</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1 || loading}
                    className="rounded-lg border border-white/10 bg-white/[0.03] hover:bg-white/[0.08] p-1.5 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer transition-colors"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="font-mono text-slate-300 font-semibold">{page} / {totalPages}</span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages || loading}
                    className="rounded-lg border border-white/10 bg-white/[0.03] hover:bg-white/[0.08] p-1.5 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer transition-colors"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Tab 2: Receiving History Table */}
      {activeTab === 'history' && (
        <div className="bg-[#0e1520] border border-white/[0.07] rounded-xl overflow-hidden shadow-sm">
          <div className="p-3.5 border-b border-white/[0.07] flex items-center justify-between bg-black/10">
            <div className="flex items-center gap-2">
              <ArrowDownLeft className="w-4 h-4 text-emerald-400" />
              <h2 className="text-sm font-bold text-white">Catatan Pasokan Masuk (Receiving Inbound)</h2>
            </div>
            <span className="text-xs text-slate-400 font-mono">100 Riwayat Terakhir di {currentBranch?.name}</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-[#080d15]/80 text-slate-400 font-semibold border-b border-white/[0.07] font-sans">
                <tr>
                  <th className="px-4 py-3">Waktu</th>
                  <th className="px-4 py-3">Produk</th>
                  <th className="px-4 py-3">No. Faktur / Ref</th>
                  <th className="px-4 py-3 text-right">Qty Masuk</th>
                  <th className="px-4 py-3 text-right">Stok Akhir</th>
                  <th className="px-4 py-3">Keterangan / Supplier</th>
                  <th className="px-4 py-3 font-sans">Penerima</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-slate-500 font-mono">
                      Memuat riwayat pasokan...
                    </td>
                  </tr>
                ) : receivingMovements.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-slate-500 font-sans">
                      Belum ada catatan pasokan masuk dari supplier.
                    </td>
                  </tr>
                ) : (
                  paginatedReceiving.map((m) => (
                    <tr key={m.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3 text-slate-400 text-[11px] whitespace-nowrap font-sans">
                        {new Date(m.created_at).toLocaleString('id-ID')}
                      </td>
                      <td className="px-4 py-3 font-sans font-medium text-white">
                        <div>{m.product_name}</div>
                        <div className="text-[10px] text-slate-500 font-mono">{m.sku}</div>
                      </td>
                      <td className="px-4 py-3 text-emerald-400 font-bold">
                        {m.reference_id || '-'}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-emerald-400">
                        +{m.quantity}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-slate-200">
                        {m.balance_after}
                      </td>
                      <td className="px-4 py-3 font-sans text-slate-300 max-w-xs truncate text-[11px]">
                        {m.notes || '-'}
                      </td>
                      <td className="px-4 py-3 font-sans text-slate-400 text-[11px]">
                        {m.actor_name || '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-white/[0.07] px-4 py-3 text-xs text-slate-400 bg-black/10">
            <span className="font-mono">Menampilkan {paginatedReceiving.length} dari {receivingMovements.length} riwayat</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1 || loading}
                className="rounded-lg border border-white/10 bg-white/[0.03] hover:bg-white/[0.08] p-1.5 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="font-mono text-slate-300 font-semibold">{page} / {totalPages}</span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages || loading}
                className="rounded-lg border border-white/10 bg-white/[0.03] hover:bg-white/[0.08] p-1.5 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Restock Multi-Item Modal */}
      {restockModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-[#0e1520] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-white/[0.07] flex items-center justify-between shrink-0 bg-black/20">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <PackagePlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Penerimaan Pasokan Stok Multi-Barang</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">Satu transaksi surat jalan untuk menambah kuantitas berbagai produk</p>
                </div>
              </div>
              <button
                onClick={() => setRestockModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleExecuteRestock} className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
              {restockSuccessMsg && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-300 text-xs font-semibold">
                  {restockSuccessMsg}
                </div>
              )}
              {restockError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{restockError}</span>
                </div>
              )}

              {/* Inbound Metadata Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-[#080d15] p-3.5 rounded-xl border border-white/[0.06]">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Cabang Tujuan Penerimaan
                  </label>
                  <div className="px-3 py-2 bg-[#0e1520] border border-white/10 rounded-lg text-xs text-white font-medium flex items-center gap-2">
                    <Building2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="truncate">{currentBranch?.name || 'Cabang Aktif'}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Pilih Supplier / Vendor
                  </label>
                  <select
                    value={restockSupplierId}
                    onChange={(e) => setRestockSupplierId(e.target.value)}
                    className="w-full px-3 py-2 bg-[#0e1520] border border-white/10 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500/60"
                  >
                    <option value="">-- Supplier Umum / Tanpa Rekanan --</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} {s.contact_person ? `(${s.contact_person})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    No. Faktur / Surat Jalan (Referensi)
                  </label>
                  <input
                    type="text"
                    value={restockRef}
                    onChange={(e) => setRestockRef(e.target.value)}
                    placeholder="Contoh: PO-202610-001"
                    className="w-full px-3 py-2 bg-[#0e1520] border border-white/10 rounded-lg text-xs text-white font-mono placeholder-slate-500 focus:outline-none focus:border-emerald-500/60"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Catatan Pasokan
                  </label>
                  <input
                    type="text"
                    value={restockNotes}
                    onChange={(e) => setRestockNotes(e.target.value)}
                    placeholder="Contoh: Pengiriman batch supplier, segel aman..."
                    className="w-full px-3 py-2 bg-[#0e1520] border border-white/10 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/60"
                  />
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-white/[0.07] pb-2">
                  <div className="flex items-center gap-2">
                    <Boxes className="w-4 h-4 text-emerald-400" />
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                      Daftar Barang yang Dipasok ({restockItems.length})
                    </h4>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddRestockItem}
                    className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md text-xs font-bold transition-colors shadow-sm cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tambah Baris</span>
                  </button>
                </div>

                <div className="space-y-2.5 max-h-[36vh] overflow-y-auto pr-1">
                  {restockItems.map((item, idx) => {
                    const prodObj = products.find((p) => p.id === item.productId);
                    const currentStock = prodObj ? prodObj.stock : 0;
                    const newEstimated = currentStock + (item.quantity || 0);
                    const unit = prodObj?.unit_symbol || 'pcs';

                    return (
                      <div
                        key={item.id}
                        className="p-3 bg-[#080d15] border border-white/[0.06] rounded-xl space-y-2 transition-colors hover:border-white/10"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded bg-white/[0.04] border border-white/10 text-slate-300 font-mono text-[10px] font-bold flex items-center justify-center">
                              {idx + 1}
                            </span>
                            <span className="text-xs font-semibold text-slate-200">
                              Item #{idx + 1}
                            </span>
                          </div>

                          <div className="flex items-center gap-3">
                            {prodObj && (
                              <div className="text-[11px] flex items-center gap-2 bg-white/[0.02] px-2.5 py-0.5 rounded border border-white/10">
                                <span className="text-slate-400">
                                  Stok: <strong className="text-white font-mono">{currentStock}</strong>
                                </span>
                                <span className="text-slate-500">→</span>
                                <span className="text-emerald-400 font-semibold">
                                  Est: <strong className="font-mono">{newEstimated} {unit}</strong>
                                </span>
                              </div>
                            )}

                            {restockItems.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveRestockItem(item.id)}
                                className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                                title="Hapus Barang Ini"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
                          <div className="sm:col-span-8">
                            <label className="block text-[10px] font-semibold text-slate-400 mb-1">
                              Pilih Produk <span className="text-rose-400">*</span>
                            </label>
                            <select
                              required
                              value={item.productId}
                              onChange={(e) => handleUpdateRestockProduct(item.id, e.target.value)}
                              className="w-full px-3 py-1.5 bg-[#0e1520] border border-white/10 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500/60"
                            >
                              <option value="">-- Pilih Produk --</option>
                              {products.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name} (SKU: {p.sku}) — Stok: {p.stock} {p.unit_symbol || 'pcs'}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="sm:col-span-4">
                            <label className="block text-[10px] font-semibold text-slate-400 mb-1">
                              Jumlah Masuk (Qty) <span className="text-rose-400">*</span>
                            </label>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleUpdateRestockQty(item.id, Math.max(1, item.quantity - 1))}
                                className="w-7 h-7 rounded bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-slate-300 font-bold text-xs flex items-center justify-center cursor-pointer transition-colors"
                              >
                                -
                              </button>
                              <input
                                type="number"
                                min="1"
                                required
                                value={item.quantity}
                                onChange={(e) =>
                                  handleUpdateRestockQty(item.id, Math.max(1, Number(e.target.value)))
                                }
                                className="w-full py-1 px-2 bg-[#0e1520] border border-white/10 rounded-lg text-center font-mono font-bold text-xs text-white focus:outline-none focus:border-emerald-500/60"
                              />
                              <button
                                type="button"
                                onClick={() => handleUpdateRestockQty(item.id, item.quantity + 1)}
                                className="w-7 h-7 rounded bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-slate-300 font-bold text-xs flex items-center justify-center cursor-pointer transition-colors"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Total Summary Bar */}
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-center justify-between text-xs">
                <div className="text-slate-300 font-semibold">
                  Ringkasan Pasokan Masuk:
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-slate-300 font-mono">
                    Total: <strong className="text-white font-mono">{restockItems.length}</strong> jenis
                  </span>
                  <span className="text-emerald-400 font-bold font-mono text-sm">
                    {restockItems.reduce((acc, it) => acc + (Number(it.quantity) || 0), 0)} Unit
                  </span>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-white/[0.07]">
                <button
                  type="button"
                  onClick={() => setRestockModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-white/10 bg-white/[0.03] hover:bg-white/[0.08] text-slate-300 text-xs font-semibold cursor-pointer transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={restockSaving}
                  className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold shadow-sm cursor-pointer transition-colors inline-flex items-center gap-1.5"
                >
                  <PackagePlus className="w-4 h-4" />
                  <span>
                    {restockSaving
                      ? 'Menyimpan...'
                      : `Terima Pasokan (${restockItems.length} Barang)`}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Supplier Form Modal (Add / Edit) */}
      {supplierModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-[#0e1520] border border-white/10 rounded-2xl w-full max-w-md max-h-[92vh] flex flex-col overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-white/[0.07] flex items-center justify-between shrink-0 bg-black/20">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">
                  {editingSupplier ? `Edit Supplier: ${editingSupplier.name}` : 'Tambah Mitra Supplier'}
                </h3>
              </div>
              <button
                onClick={() => setSupplierModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSupplier} className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
              {supplierError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-300 text-xs">
                  {supplierError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Nama Perusahaan / Supplier <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={sName}
                  onChange={(e) => setSName(e.target.value)}
                  placeholder="Contoh: PT. Sentosa Pangan Sejahtera"
                  className="w-full px-3.5 py-2.5 bg-[#080d15] border border-white/10 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/60"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Contact Person (PIC Sales)
                </label>
                <input
                  type="text"
                  value={sContact}
                  onChange={(e) => setSContact(e.target.value)}
                  placeholder="Contoh: Bpk. Budi Santoso"
                  className="w-full px-3.5 py-2.5 bg-[#080d15] border border-white/10 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/60"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    No. Telepon / WA
                  </label>
                  <input
                    type="text"
                    value={sPhone}
                    onChange={(e) => setSPhone(e.target.value)}
                    placeholder="08123456789"
                    className="w-full px-3.5 py-2.5 bg-[#080d15] border border-white/10 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/60 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Email Kontak
                  </label>
                  <input
                    type="email"
                    value={sEmail}
                    onChange={(e) => setSEmail(e.target.value)}
                    placeholder="sales@vendor.com"
                    className="w-full px-3.5 py-2.5 bg-[#080d15] border border-white/10 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/60"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Alamat Kantor / Gudang
                </label>
                <textarea
                  value={sAddress}
                  onChange={(e) => setSAddress(e.target.value)}
                  placeholder="Alamat lengkap supplier"
                  rows={2}
                  className="w-full px-3.5 py-2 bg-[#080d15] border border-white/10 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/60 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Catatan Tambahan
                </label>
                <input
                  type="text"
                  value={sNotes}
                  onChange={(e) => setSNotes(e.target.value)}
                  placeholder="Jadwal pengiriman rutin, syarat tempo, dsb."
                  className="w-full px-3.5 py-2.5 bg-[#080d15] border border-white/10 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/60"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-white/[0.07]">
                <button
                  type="button"
                  onClick={() => setSupplierModalOpen(false)}
                  className="px-4 py-2.5 rounded-lg border border-white/10 bg-white/[0.03] hover:bg-white/[0.08] text-slate-300 text-xs font-semibold cursor-pointer transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={supplierSaving}
                  className="px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold shadow-sm cursor-pointer transition-colors"
                >
                  {supplierSaving ? 'Menyimpan...' : 'Simpan Supplier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Supplier Confirmation Modal */}
      {deleteConfirmSupplier && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-[#0e1520] border border-white/10 rounded-2xl w-full max-w-sm p-5 space-y-4 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20">
                <Trash2 className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-white">Hapus Supplier</h3>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Apakah Anda yakin ingin menghapus data supplier <strong className="text-white">{deleteConfirmSupplier.name}</strong>?
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/[0.07]">
              <button
                onClick={() => setDeleteConfirmSupplier(null)}
                className="px-3.5 py-2 rounded-lg border border-white/10 bg-white/[0.03] hover:bg-white/[0.08] text-slate-300 text-xs font-semibold cursor-pointer transition-colors"
              >
                Batal
              </button>
              <button
                onClick={() => handleDeleteSupplier(deleteConfirmSupplier)}
                disabled={deleteLoading}
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-bold shadow-sm cursor-pointer transition-colors"
              >
                {deleteLoading ? 'Menghapus...' : 'Ya, Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
