import type { ReportData, SaleSummary } from '../types';

export const formatIDR = (val: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(val || 0);
};

export const formatDateID = (dateStr?: string | Date) => {
  const d = dateStr ? new Date(dateStr) : new Date();
  return d.toLocaleDateString('id-ID', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

export const formatDateTimeID = (dateStr?: string | Date) => {
  const d = dateStr ? new Date(dateStr) : new Date();
  return d.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getBaseStyles = () => `
  @page {
    size: A4 portrait;
    margin: 12mm 14mm 14mm 14mm;
  }
  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    color: #0f172a;
    background-color: #ffffff;
    font-size: 11px;
    line-height: 1.45;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  .no-print {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: #0f172a;
    color: #f8fafc;
    padding: 12px 20px;
    position: sticky;
    top: 0;
    z-index: 1000;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  }
  .no-print button {
    cursor: pointer;
    border: none;
    padding: 8px 16px;
    border-radius: 8px;
    font-weight: 600;
    font-size: 12px;
    transition: all 0.2s;
  }
  .btn-print {
    background: #059669;
    color: #ffffff;
  }
  .btn-print:hover {
    background: #10b981;
  }
  .btn-close {
    background: #334155;
    color: #cbd5e1;
    margin-right: 8px;
  }
  .btn-close:hover {
    background: #475569;
    color: #ffffff;
  }
  .container {
    max-width: 100%;
    margin: 0 auto;
    padding: 16px 20px;
  }
  @media print {
    .no-print {
      display: none !important;
    }
    .container {
      padding: 0 !important;
    }
  }
  .header {
    border-bottom: 2px solid #059669;
    padding-bottom: 12px;
    margin-bottom: 16px;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }
  .brand-title {
    font-size: 18px;
    font-weight: 800;
    color: #0f172a;
    letter-spacing: -0.5px;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .brand-badge {
    background: #ecfdf5;
    color: #059669;
    border: 1px solid #a7f3d0;
    font-size: 10px;
    font-weight: 700;
    padding: 2px 6px;
    border-radius: 4px;
    text-transform: uppercase;
  }
  .brand-subtitle {
    font-size: 11px;
    color: #475569;
    margin-top: 3px;
  }
  .meta-box {
    text-align: right;
    font-size: 10px;
    color: #475569;
    line-height: 1.5;
  }
  .meta-box strong {
    color: #0f172a;
  }
  .doc-title-block {
    text-align: center;
    margin-bottom: 16px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 10px 14px;
  }
  .doc-title {
    font-size: 14px;
    font-weight: 800;
    text-transform: uppercase;
    color: #0f172a;
    letter-spacing: 0.5px;
  }
  .doc-subtitle {
    font-size: 11px;
    color: #64748b;
    margin-top: 2px;
  }
  .kpi-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 10px;
    margin-bottom: 16px;
  }
  .kpi-card {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 10px 12px;
  }
  .kpi-label {
    font-size: 9.5px;
    font-weight: 600;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 4px;
  }
  .kpi-value {
    font-size: 14px;
    font-weight: 800;
    color: #0f172a;
    font-family: monospace, sans-serif;
  }
  .kpi-sub {
    font-size: 9px;
    color: #94a3b8;
    margin-top: 2px;
  }
  .section-title {
    font-size: 12px;
    font-weight: 700;
    color: #0f172a;
    margin-bottom: 8px;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .section-title::before {
    content: "";
    display: inline-block;
    width: 4px;
    height: 12px;
    background: #059669;
    border-radius: 2px;
  }
  .styled-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 16px;
    font-size: 10.5px;
  }
  .styled-table th {
    background: #f1f5f9;
    color: #334155;
    font-weight: 700;
    text-align: left;
    padding: 7px 10px;
    border-top: 1px solid #cbd5e1;
    border-bottom: 2px solid #cbd5e1;
    text-transform: uppercase;
    font-size: 9.5px;
    letter-spacing: 0.3px;
  }
  .styled-table td {
    padding: 7px 10px;
    border-bottom: 1px solid #e2e8f0;
    color: #1e293b;
    vertical-align: middle;
  }
  .styled-table tbody tr:nth-child(even) {
    background-color: #f8fafc;
  }
  .styled-table tfoot td {
    background: #f1f5f9;
    font-weight: 700;
    border-top: 2px solid #cbd5e1;
    border-bottom: 2px solid #cbd5e1;
    color: #0f172a;
  }
  .text-right {
    text-align: right !important;
  }
  .text-center {
    text-align: center !important;
  }
  .font-mono {
    font-family: monospace, sans-serif;
  }
  .payment-box {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin-bottom: 16px;
  }
  .payment-item {
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 10px 14px;
    background: #ffffff;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .tag {
    display: inline-block;
    padding: 2px 7px;
    border-radius: 9999px;
    font-size: 9.5px;
    font-weight: 600;
  }
  .tag-success {
    background: #ecfdf5;
    color: #065f46;
    border: 1px solid #a7f3d0;
  }
  .tag-blue {
    background: #eff6ff;
    color: #1e40af;
    border: 1px solid #bfdbfe;
  }
  .tag-danger {
    background: #fef2f2;
    color: #991b1b;
    border: 1px solid #fecaca;
  }
  .tag-warning {
    background: #fffbeb;
    color: #92400e;
    border: 1px solid #fde68a;
  }
  .signatures {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 20px;
    margin-top: 32px;
    page-break-inside: avoid;
  }
  .signature-box {
    text-align: center;
    border: 1px dashed #cbd5e1;
    border-radius: 8px;
    padding: 12px 10px 10px;
    background: #ffffff;
  }
  .signature-role {
    font-size: 10px;
    font-weight: 700;
    color: #475569;
    text-transform: uppercase;
    margin-bottom: 48px;
  }
  .signature-line {
    border-top: 1px solid #64748b;
    width: 80%;
    margin: 0 auto 4px;
  }
  .signature-name {
    font-size: 10px;
    font-weight: 600;
    color: #0f172a;
  }
  .footer {
    border-top: 1px solid #e2e8f0;
    margin-top: 24px;
    padding-top: 8px;
    font-size: 9px;
    color: #64748b;
    display: flex;
    justify-content: space-between;
    align-items: center;
    page-break-inside: avoid;
  }
`;

function triggerPrintWindow(title: string, bodyContent: string) {
  const fullHtml = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <style>${getBaseStyles()}</style>
</head>
<body>
  <div class="no-print">
    <div>
      <strong style="font-size: 13px;">Pratinjau PDF: ${title}</strong>
      <span style="font-size: 11px; opacity: 0.8; margin-left: 10px;">
        Pilih tujuan "Save as PDF" / "Simpan sebagai PDF" pada dialog cetak browser
      </span>
    </div>
    <div>
      <button class="btn-close" onclick="window.close()">Tutup Pratinjau</button>
      <button class="btn-print" onclick="window.print()">🖨️ Cetak / Simpan PDF</button>
    </div>
  </div>
  <div class="container">
    ${bodyContent}
  </div>
  <script>
    window.addEventListener('load', () => {
      setTimeout(() => {
        window.print();
      }, 500);
    });
  </script>
</body>
</html>`;

  const printWindow = window.open('', '_blank', 'width=950,height=800');
  if (!printWindow) {
    // Popup fallback via hidden iframe
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(fullHtml);
      doc.close();
      iframe.contentWindow?.focus();
      setTimeout(() => {
        iframe.contentWindow?.print();
        setTimeout(() => document.body.removeChild(iframe), 3000);
      }, 500);
    }
    return;
  }

  printWindow.document.open();
  printWindow.document.write(fullHtml);
  printWindow.document.close();
  printWindow.focus();
}

/**
 * 1. Export Laporan Analitik Penjualan ke PDF (ReportsView)
 */
export function exportSalesReportPdf(params: {
  data: ReportData;
  branchName?: string;
  businessName?: string;
  dateRange: 'today' | '7days' | '30days';
  userName?: string;
}) {
  const { data, branchName = 'Cabang Sentosa', businessName = 'Sentosa Retail Group', dateRange, userName = 'Kasir / Petugas' } = params;
  const summary = data.summary || {
    total_sales: 0,
    total_orders: 0,
    cash_sales: 0,
    non_cash_sales: 0,
    items_sold: 0,
    average_order_value: 0,
  };

  const periodLabel = {
    today: 'Hari Ini (' + formatDateID() + ')',
    '7days': '7 Hari Terakhir (Hingga ' + formatDateID() + ')',
    '30days': '30 Hari Terakhir (Hingga ' + formatDateID() + ')',
  }[dateRange];

  const cashPct = summary.total_sales > 0 ? Math.round((summary.cash_sales / summary.total_sales) * 100) : 0;
  const nonCashPct = summary.total_sales > 0 ? 100 - cashPct : 0;

  const topProductsRows = (data.top_products || [])
    .map((prod, idx) => {
      const sharePct = summary.total_sales > 0 ? Math.round((prod.total_sales / summary.total_sales) * 100) : 0;
      return `
      <tr>
        <td class="text-center font-mono"><strong>#${idx + 1}</strong></td>
        <td><strong>${prod.product_name}</strong></td>
        <td class="text-center font-mono">${prod.total_qty.toLocaleString('id-ID')} unit</td>
        <td class="text-right font-mono">${formatIDR(prod.total_sales)}</td>
        <td class="text-center font-mono">${sharePct}%</td>
      </tr>
    `;
    })
    .join('');

  const cashiersRows = (data.cashier_performance || [])
    .map((c, idx) => `
      <tr>
        <td class="text-center font-mono">${idx + 1}</td>
        <td><strong>${c.cashier_name}</strong></td>
        <td class="text-center font-mono">${c.total_orders.toLocaleString('id-ID')} struk</td>
        <td class="text-right font-mono">${formatIDR(c.total_sales)}</td>
      </tr>
    `)
    .join('');

  const body = `
    <div class="header">
      <div>
        <div class="brand-title">
          <span>${businessName}</span>
          <span class="brand-badge">Sistem POS Resmi</span>
        </div>
        <div class="brand-subtitle">Cabang: <strong>${branchName}</strong></div>
      </div>
      <div class="meta-box">
        <div>Waktu Cetak: <strong>${formatDateTimeID()}</strong></div>
        <div>Dicetak Oleh: <strong>${userName}</strong></div>
        <div>Status Dokumen: <strong style="color: #059669;">Terverifikasi</strong></div>
      </div>
    </div>

    <div class="doc-title-block">
      <div class="doc-title">Laporan Kinerja & Ringkasan Penjualan</div>
      <div class="doc-subtitle">Periode Pelaporan: <strong>${periodLabel}</strong></div>
    </div>

    <!-- KPI Summary Grid -->
    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-label">Total Omset Penjualan</div>
        <div class="kpi-value" style="color: #059669;">${formatIDR(summary.total_sales)}</div>
        <div class="kpi-sub">Pendapatan bersih transaksi</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Total Transaksi Selesai</div>
        <div class="kpi-value">${summary.total_orders} <span style="font-size: 11px; font-weight: normal; color: #64748b;">Struk</span></div>
        <div class="kpi-sub">Transaksi berhasil</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Total Item Terjual</div>
        <div class="kpi-value">${summary.items_sold} <span style="font-size: 11px; font-weight: normal; color: #64748b;">Pcs</span></div>
        <div class="kpi-sub">Kuantitas produk fisik</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Rata-Rata Nilai Struk (AOV)</div>
        <div class="kpi-value">${formatIDR(summary.average_order_value)}</div>
        <div class="kpi-sub">Nilai rata-rata per transaksi</div>
      </div>
    </div>

    <!-- Payment Breakdown -->
    <div class="section-title">Distribusi Metode Pembayaran</div>
    <div class="payment-box">
      <div class="payment-item">
        <div>
          <div style="font-size: 10px; color: #64748b; font-weight: 600;">PEMBAYARAN TUNAI (CASH)</div>
          <div style="font-size: 13px; font-weight: 800; font-family: monospace; color: #059669;">${formatIDR(summary.cash_sales)}</div>
        </div>
        <span class="tag tag-success">${cashPct}% dari Total</span>
      </div>
      <div class="payment-item">
        <div>
          <div style="font-size: 10px; color: #64748b; font-weight: 600;">PEMBAYARAN NON-TUNAI (QRIS / TRANSFER / DEBIT)</div>
          <div style="font-size: 13px; font-weight: 800; font-family: monospace; color: #2563eb;">${formatIDR(summary.non_cash_sales)}</div>
        </div>
        <span class="tag tag-blue">${nonCashPct}% dari Total</span>
      </div>
    </div>

    <!-- Top Products Table -->
    <div class="section-title">Produk Paling Laris (Top Products)</div>
    <table class="styled-table">
      <thead>
        <tr>
          <th style="width: 50px;" class="text-center">Peringkat</th>
          <th>Nama Produk</th>
          <th style="width: 120px;" class="text-center">Kuantitas Terjual</th>
          <th style="width: 150px;" class="text-right">Total Penjualan</th>
          <th style="width: 100px;" class="text-center">Kontribusi</th>
        </tr>
      </thead>
      <tbody>
        ${topProductsRows || '<tr><td colspan="5" class="text-center" style="padding: 16px; color: #94a3b8;">Belum ada penjualan tercatat pada periode ini.</td></tr>'}
      </tbody>
    </table>

    <!-- Cashier Performance Table -->
    <div class="section-title">Performa Petugas Kasir</div>
    <table class="styled-table">
      <thead>
        <tr>
          <th style="width: 50px;" class="text-center">No</th>
          <th>Nama Kasir</th>
          <th style="width: 150px;" class="text-center">Jumlah Transaksi</th>
          <th style="width: 180px;" class="text-right">Total Nilai Penjualan</th>
        </tr>
      </thead>
      <tbody>
        ${cashiersRows || '<tr><td colspan="4" class="text-center" style="padding: 16px; color: #94a3b8;">Belum ada aktivitas kasir tercatat pada periode ini.</td></tr>'}
      </tbody>
    </table>

    <!-- Signatures -->
    <div class="signatures">
      <div class="signature-box">
        <div class="signature-role">Dibuat Oleh</div>
        <div class="signature-line"></div>
        <div class="signature-name">${userName}</div>
      </div>
      <div class="signature-box">
        <div class="signature-role">Diperiksa Oleh</div>
        <div class="signature-line"></div>
        <div class="signature-name">Branch Manager / Supervisor</div>
      </div>
      <div class="signature-box">
        <div class="signature-role">Disetujui Oleh</div>
        <div class="signature-line"></div>
        <div class="signature-name">Owner / Store Management</div>
      </div>
    </div>

    <!-- Document Footer -->
    <div class="footer">
      <div>Dokumen ini dihasilkan secara otomatis oleh sistem <strong>Sentosa POS</strong>.</div>
      <div>Halaman 1 dari 1 · Ref ID: ${Math.random().toString(36).substring(2, 9).toUpperCase()}</div>
    </div>
  `;

  triggerPrintWindow(`Laporan_Penjualan_${branchName.replace(/\s+/g, '_')}_${dateRange}`, body);
}

/**
 * 2. Export Rekapitulasi Riwayat Transaksi ke PDF (SalesHistoryView)
 */
export function exportTransactionsListPdf(params: {
  sales: SaleSummary[];
  branchName?: string;
  businessName?: string;
  userName?: string;
}) {
  const { sales, branchName = 'Cabang Sentosa', businessName = 'Sentosa Retail Group', userName = 'Kasir / Petugas' } = params;

  let totalCompletedAmount = 0;
  let totalCompletedCount = 0;
  let totalVoidCount = 0;

  sales.forEach((s) => {
    if (s.status === 'completed') {
      totalCompletedAmount += s.total_amount;
      totalCompletedCount++;
    } else if (s.status === 'voided') {
      totalVoidCount++;
    }
  });

  const rows = sales
    .map((s, idx) => {
      const isVoid = s.status === 'voided';
      const statusBadge = isVoid
        ? `<span class="tag tag-danger">Dibatalkan (Void)</span>`
        : `<span class="tag tag-success">Selesai</span>`;

      return `
      <tr>
        <td class="text-center font-mono">${idx + 1}</td>
        <td class="font-mono"><strong>${s.receipt_number}</strong></td>
        <td>${formatDateTimeID(s.created_at)}</td>
        <td>${s.cashier_name || '-'}</td>
        <td class="text-center"><span class="tag tag-blue">${s.payment_method.toUpperCase()}</span></td>
        <td class="text-center">${statusBadge}</td>
        <td class="text-right font-mono" style="${isVoid ? 'text-decoration: line-through; color: #94a3b8;' : 'font-weight: 700; color: #059669;'}">
          ${formatIDR(s.total_amount)}
        </td>
      </tr>
    `;
    })
    .join('');

  const body = `
    <div class="header">
      <div>
        <div class="brand-title">
          <span>${businessName}</span>
          <span class="brand-badge">Rekap Transaksi</span>
        </div>
        <div class="brand-subtitle">Cabang: <strong>${branchName}</strong></div>
      </div>
      <div class="meta-box">
        <div>Tanggal Cetak: <strong>${formatDateTimeID()}</strong></div>
        <div>Dicetak Oleh: <strong>${userName}</strong></div>
        <div>Total Data: <strong>${sales.length} Transaksi</strong></div>
      </div>
    </div>

    <div class="doc-title-block">
      <div class="doc-title">Laporan Rekapitulasi Riwayat Transaksi Penjualan</div>
      <div class="doc-subtitle">Daftar transaksi kasir terdata di cabang ${branchName}</div>
    </div>

    <!-- Mini KPI -->
    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-label">Total Omset Berhasil</div>
        <div class="kpi-value" style="color: #059669;">${formatIDR(totalCompletedAmount)}</div>
        <div class="kpi-sub">Total bersih dari transaksi sukses</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Transaksi Berhasil</div>
        <div class="kpi-value">${totalCompletedCount} <span style="font-size: 11px; font-weight: normal; color: #64748b;">Struk</span></div>
        <div class="kpi-sub">Status: Selesai</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Transaksi Dibatalkan</div>
        <div class="kpi-value" style="color: #e11d48;">${totalVoidCount} <span style="font-size: 11px; font-weight: normal; color: #64748b;">Struk</span></div>
        <div class="kpi-sub">Status: Void</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Total Keseluruhan</div>
        <div class="kpi-value">${sales.length} <span style="font-size: 11px; font-weight: normal; color: #64748b;">Record</span></div>
        <div class="kpi-sub">Semua status struk</div>
      </div>
    </div>

    <!-- Transactions Table -->
    <div class="section-title">Rincian Riwayat Transaksi</div>
    <table class="styled-table">
      <thead>
        <tr>
          <th style="width: 40px;" class="text-center">No</th>
          <th style="width: 140px;">No. Struk</th>
          <th style="width: 130px;">Waktu Transaksi</th>
          <th>Kasir</th>
          <th style="width: 90px;" class="text-center">Metode</th>
          <th style="width: 110px;" class="text-center">Status</th>
          <th style="width: 130px;" class="text-right">Total Transaksi</th>
        </tr>
      </thead>
      <tbody>
        ${rows || '<tr><td colspan="7" class="text-center" style="padding: 16px; color: #94a3b8;">Tidak ada riwayat transaksi.</td></tr>'}
      </tbody>
      <tfoot>
        <tr>
          <td colspan="6" class="text-right">TOTAL OMSET TRANSAKSI SUKSES:</td>
          <td class="text-right font-mono" style="color: #059669; font-size: 12px;">${formatIDR(totalCompletedAmount)}</td>
        </tr>
      </tfoot>
    </table>

    <!-- Signatures -->
    <div class="signatures">
      <div class="signature-box">
        <div class="signature-role">Dibuat Oleh</div>
        <div class="signature-line"></div>
        <div class="signature-name">${userName}</div>
      </div>
      <div class="signature-box">
        <div class="signature-role">Diperiksa Oleh</div>
        <div class="signature-line"></div>
        <div class="signature-name">Head Cashier / Supervisor</div>
      </div>
      <div class="signature-box">
        <div class="signature-role">Disetujui Oleh</div>
        <div class="signature-line"></div>
        <div class="signature-name">Store Manager</div>
      </div>
    </div>

    <!-- Document Footer -->
    <div class="footer">
      <div>Dokumen ini dihasilkan secara otomatis oleh sistem <strong>Sentosa POS</strong>.</div>
      <div>Waktu Cetak: ${formatDateTimeID()}</div>
    </div>
  `;

  triggerPrintWindow(`Laporan_Transaksi_${branchName.replace(/\s+/g, '_')}`, body);
}

/**
 * 3. Export Laporan Stok & Inventaris ke PDF (InventoryView)
 */
export function exportInventoryReportPdf(params: {
  inventory: Array<{
    product_id: string;
    product_name: string;
    sku: string;
    stock_quantity: number;
    min_stock_alert: number;
    unit_symbol?: string;
    category_name?: string;
  }>;
  branchName?: string;
  businessName?: string;
  userName?: string;
}) {
  const { inventory, branchName = 'Cabang Sentosa', businessName = 'Sentosa Retail Group', userName = 'Petugas Inventaris' } = params;

  let totalItemsCount = inventory.length;
  let totalPhysicalStock = 0;
  let lowStockCount = 0;
  let outOfStockCount = 0;

  inventory.forEach((item) => {
    totalPhysicalStock += item.stock_quantity;
    if (item.stock_quantity <= 0) {
      outOfStockCount++;
    } else if (item.stock_quantity <= item.min_stock_alert) {
      lowStockCount++;
    }
  });

  const rows = inventory
    .map((item, idx) => {
      let statusBadge = '<span class="tag tag-success">Aman</span>';
      if (item.stock_quantity <= 0) {
        statusBadge = '<span class="tag tag-danger">Habis</span>';
      } else if (item.stock_quantity <= item.min_stock_alert) {
        statusBadge = '<span class="tag tag-warning">Menipis</span>';
      }

      return `
      <tr>
        <td class="text-center font-mono">${idx + 1}</td>
        <td><strong>${item.product_name}</strong></td>
        <td class="font-mono" style="color: #64748b;">${item.sku || '-'}</td>
        <td>${item.category_name || '-'}</td>
        <td class="text-center font-mono" style="font-weight: 700; font-size: 11px;">
          ${item.stock_quantity.toLocaleString('id-ID')}
        </td>
        <td class="text-center">${item.unit_symbol || 'Pcs'}</td>
        <td class="text-center font-mono" style="color: #64748b;">${item.min_stock_alert}</td>
        <td class="text-center">${statusBadge}</td>
      </tr>
    `;
    })
    .join('');

  const body = `
    <div class="header">
      <div>
        <div class="brand-title">
          <span>${businessName}</span>
          <span class="brand-badge">Laporan Stok</span>
        </div>
        <div class="brand-subtitle">Cabang: <strong>${branchName}</strong></div>
      </div>
      <div class="meta-box">
        <div>Tanggal Cetak: <strong>${formatDateTimeID()}</strong></div>
        <div>Dicetak Oleh: <strong>${userName}</strong></div>
        <div>Total Produk Terdaftar: <strong>${totalItemsCount} SKU</strong></div>
      </div>
    </div>

    <div class="doc-title-block">
      <div class="doc-title">Laporan Posisi Stok & Status Inventaris</div>
      <div class="doc-subtitle">Monitoring ketersediaan barang dan peringatan stok minimum</div>
    </div>

    <!-- Mini KPI -->
    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-label">Total Varian Produk</div>
        <div class="kpi-value">${totalItemsCount} <span style="font-size: 11px; font-weight: normal; color: #64748b;">Item</span></div>
        <div class="kpi-sub">Total master produk aktif</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Total Fisik Barang</div>
        <div class="kpi-value" style="color: #059669;">${totalPhysicalStock.toLocaleString('id-ID')} <span style="font-size: 11px; font-weight: normal; color: #64748b;">Unit</span></div>
        <div class="kpi-sub">Akumulasi kuantitas stok</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Stok Menipis (Warning)</div>
        <div class="kpi-value" style="color: #d97706;">${lowStockCount} <span style="font-size: 11px; font-weight: normal; color: #64748b;">Item</span></div>
        <div class="kpi-sub">Di bawah batas aman</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Stok Habis (Kosong)</div>
        <div class="kpi-value" style="color: #dc2626;">${outOfStockCount} <span style="font-size: 11px; font-weight: normal; color: #64748b;">Item</span></div>
        <div class="kpi-sub">Segera lakukan restock</div>
      </div>
    </div>

    <!-- Inventory Table -->
    <div class="section-title">Daftar Stok Produk</div>
    <table class="styled-table">
      <thead>
        <tr>
          <th style="width: 40px;" class="text-center">No</th>
          <th>Nama Produk</th>
          <th style="width: 100px;">SKU</th>
          <th style="width: 120px;">Kategori</th>
          <th style="width: 90px;" class="text-center">Stok Fisik</th>
          <th style="width: 70px;" class="text-center">Satuan</th>
          <th style="width: 80px;" class="text-center">Batas Min</th>
          <th style="width: 90px;" class="text-center">Status</th>
        </tr>
      </thead>
      <tbody>
        ${rows || '<tr><td colspan="8" class="text-center" style="padding: 16px; color: #94a3b8;">Belum ada data inventaris di cabang ini.</td></tr>'}
      </tbody>
    </table>

    <!-- Signatures -->
    <div class="signatures">
      <div class="signature-box">
        <div class="signature-role">Dibuat Oleh</div>
        <div class="signature-line"></div>
        <div class="signature-name">${userName}</div>
      </div>
      <div class="signature-box">
        <div class="signature-role">Diperiksa Oleh</div>
        <div class="signature-line"></div>
        <div class="signature-name">Kepala Gudang / Logistik</div>
      </div>
      <div class="signature-box">
        <div class="signature-role">Disetujui Oleh</div>
        <div class="signature-line"></div>
        <div class="signature-name">Branch Manager</div>
      </div>
    </div>

    <!-- Document Footer -->
    <div class="footer">
      <div>Dokumen ini dihasilkan secara otomatis oleh sistem <strong>Sentosa POS</strong>.</div>
      <div>Waktu Cetak: ${formatDateTimeID()}</div>
    </div>
  `;

  triggerPrintWindow(`Laporan_Stok_${branchName.replace(/\s+/g, '_')}`, body);
}

/**
 * 4. Export Laporan Log Audit ke PDF (AuditLogsView)
 */
export function exportAuditLogsPdf(params: {
  logs: Array<{
    id: string;
    action: string;
    actor_name: string;
    actor_role: string;
    entity_type: string;
    ip_address: string;
    created_at: string;
  }>;
  businessName?: string;
  userName?: string;
}) {
  const { logs, businessName = 'Sentosa Retail Group', userName = 'Administrator' } = params;

  const rows = logs
    .map((log, idx) => `
      <tr>
        <td class="text-center font-mono">${idx + 1}</td>
        <td class="font-mono">${formatDateTimeID(log.created_at)}</td>
        <td><strong>${log.actor_name || 'Sistem'}</strong></td>
        <td><span class="tag tag-blue">${log.actor_role || '-'}</span></td>
        <td class="font-mono" style="color: #059669;"><strong>${log.action}</strong></td>
        <td>${log.entity_type}</td>
        <td class="font-mono" style="color: #64748b;">${log.ip_address || '-'}</td>
      </tr>
    `)
    .join('');

  const body = `
    <div class="header">
      <div>
        <div class="brand-title">
          <span>${businessName}</span>
          <span class="brand-badge">Audit Trail</span>
        </div>
        <div class="brand-subtitle">Log Keamanan, Otorisasi, & Aktivitas Sistem</div>
      </div>
      <div class="meta-box">
        <div>Tanggal Cetak: <strong>${formatDateTimeID()}</strong></div>
        <div>Dicetak Oleh: <strong>${userName}</strong></div>
        <div>Total Log: <strong>${logs.length} Baris</strong></div>
      </div>
    </div>

    <div class="doc-title-block">
      <div class="doc-title">Laporan Log Audit & Integritas Sistem</div>
      <div class="doc-subtitle">Rekaman jejak aktivitas pengguna, transaksi, dan perubahan sistem</div>
    </div>

    <!-- Audit Table -->
    <table class="styled-table">
      <thead>
        <tr>
          <th style="width: 40px;" class="text-center">No</th>
          <th style="width: 120px;">Waktu Kejadian</th>
          <th style="width: 130px;">Petugas / Akun</th>
          <th style="width: 100px;">Peran</th>
          <th>Aksi / Peristiwa</th>
          <th style="width: 100px;">Entitas</th>
          <th style="width: 110px;">IP Address</th>
        </tr>
      </thead>
      <tbody>
        ${rows || '<tr><td colspan="7" class="text-center" style="padding: 16px; color: #94a3b8;">Belum ada log audit yang tercatat.</td></tr>'}
      </tbody>
    </table>

    <!-- Signatures -->
    <div class="signatures">
      <div class="signature-box">
        <div class="signature-role">Dibuat Oleh</div>
        <div class="signature-line"></div>
        <div class="signature-name">${userName}</div>
      </div>
      <div class="signature-box">
        <div class="signature-role">Diperiksa Oleh</div>
        <div class="signature-line"></div>
        <div class="signature-name">IT & Security Compliance</div>
      </div>
      <div class="signature-box">
        <div class="signature-role">Disetujui Oleh</div>
        <div class="signature-line"></div>
        <div class="signature-name">Direksi / Owner</div>
      </div>
    </div>

    <!-- Document Footer -->
    <div class="footer">
      <div>Dokumen ini bersifat RAHASIA & TERPERCAYA (Confidential). Digenerate oleh <strong>Sentosa POS</strong>.</div>
      <div>Waktu Cetak: ${formatDateTimeID()}</div>
    </div>
  `;

  triggerPrintWindow(`Laporan_Audit_Logs`, body);
}
