# Multi-Branch Web POS

Sistem Point of Sale berbasis web untuk multi-kasir dan multi-cabang.  
Stack: **Go + Fiber v2** (backend) · **React + TypeScript + Vite + Tailwind CSS v4** (frontend) · **PostgreSQL** (database).

---

## Akun Seed (Default Credentials)

Akun berikut dibuat oleh `cmd/seed` saat database pertama kali diinisialisasi.

| Role | Username | Password | Akses |
|------|----------|----------|-------|
| **Owner / Super Admin** | `owner` | `password123` | Semua cabang, semua fitur, laporan |
| **Branch Manager** | `manager` | `password123` | Manajemen produk, stok, laporan cabang |
| **Kasir** | `cashier` | `password123` | POS checkout, riwayat transaksi |
| **Staf Gudang** | `inventory` | `password123` | Stok, penyesuaian, mutasi barang |

> **Catatan:** Ubah password semua akun sebelum deploy ke lingkungan produksi.

---

## Struktur Proyek

```
POS/
├── backend/
│   ├── cmd/
│   │   ├── server/      # Entry point server HTTP (Fiber)
│   │   ├── migrate/     # Runner migrasi SQL
│   │   └── seed/        # Seed data awal (bisnis, cabang, user, produk)
│   ├── internal/
│   │   ├── auth/        # JWT token generation & parsing
│   │   ├── database/    # pgxpool connection helper
│   │   ├── handlers/    # HTTP handlers (auth, products, checkout, sales, inventory, reports)
│   │   └── middleware/  # AuthRequired, RequireRoles, ValidateBranchAccess
│   ├── migrations/      # File SQL migrasi berurutan (001_initial_schema.sql)
│   ├── .env             # Environment variables (DATABASE_URL, JWT_SECRET, PORT)
│   └── go.mod
└── frontend/
    ├── src/
    │   ├── api/         # HTTP client dengan injeksi token & X-Branch-ID header
    │   ├── components/  # Navbar (branch switcher, role badge, logout)
    │   ├── store/       # Zustand stores: authStore, cartStore
    │   ├── types/       # TypeScript interfaces domain model
    │   └── views/       # LoginView, PosView, InventoryView, SalesHistoryView, ReportsView
    └── package.json
```

---

## Cara Menjalankan Lokal (Tanpa Docker)

### Prasyarat

- **Go** ≥ 1.21 — [download](https://go.dev/dl/)
- **Node.js** ≥ 20 + **npm** — [download](https://nodejs.org/)
- **PostgreSQL** — tersedia via Aiven Cloud (lihat `pgsl_conn.txt`) atau instalasi lokal

### 1. Konfigurasi Backend

```powershell
cd backend
cp .env.example .env   # atau edit .env langsung
```

Isi `.env`:

```env
DATABASE_URL=postgres://<user>:<pass>@<host>:<port>/<db>?sslmode=require
JWT_SECRET=ganti_dengan_string_rahasia_panjang
PORT=8080
APP_ENV=development
```

### 2. Jalankan Migrasi Database

```powershell
cd backend
go run ./cmd/migrate
```

Output yang diharapkan:
```
Connected to PostgreSQL successfully.
Applying migration: 001_initial_schema.sql ...
Successfully applied migration: 001_initial_schema.sql
All migrations applied successfully!
```

### 3. Seed Data Awal (Opsional — sekali saja)

```powershell
go run ./cmd/seed
```

Perintah ini membuat: 1 bisnis, 2 cabang, 4 user (lihat tabel akun di atas), 3 kategori, 3 unit, 8 produk, dan stok awal.

> Seed aman dijalankan ulang — jika data sudah ada, proses akan dibatalkan otomatis.

### 4. Jalankan Backend Server

```powershell
go run ./cmd/server
# atau build terlebih dahulu:
go build -o pos-server.exe ./cmd/server
./pos-server.exe
```

Server berjalan di: `http://localhost:8080`  
Health check: `GET http://localhost:8080/api/v1/health`

### 5. Jalankan Frontend

```powershell
cd frontend
npm install
npm run dev
```

Aplikasi berjalan di: `http://localhost:8080`  
Proxy `/api` → `http://localhost:8080` sudah dikonfigurasi di `vite.config.ts`.

---

## API Endpoints Utama

| Method | Endpoint | Auth | Deskripsi |
|--------|----------|------|-----------|
| `POST` | `/api/v1/auth/login` | — | Login, kembalikan JWT + daftar cabang |
| `GET` | `/api/v1/auth/me` | ✓ | Info user saat ini |
| `GET` | `/api/v1/products` | ✓ + Branch | Daftar produk + stok cabang (paginated, searchable) |
| `GET` | `/api/v1/categories` | ✓ + Branch | Daftar kategori bisnis |
| `POST` | `/api/v1/checkout` | ✓ + Branch | Checkout atomik (idempotency key wajib) |
| `GET` | `/api/v1/sales` | ✓ + Branch | Riwayat transaksi cabang |
| `GET` | `/api/v1/sales/:id` | ✓ + Branch | Detail & struk transaksi |
| `POST` | `/api/v1/sales/:id/void` | ✓ + Branch + Manager | Batalkan transaksi & kembalikan stok |
| `GET` | `/api/v1/inventory` | ✓ + Branch | Stok semua produk di cabang |
| `POST` | `/api/v1/inventory/adjust` | ✓ + Branch + Staff | Sesuaikan stok fisik (audit log) |
| `GET` | `/api/v1/inventory/movements` | ✓ + Branch | Riwayat mutasi stok cabang |
| `GET` | `/api/v1/reports/summary` | ✓ + Branch + Manager | Laporan penjualan & performa kasir |

> Semua endpoint branch-scoped memerlukan header `X-Branch-ID: <uuid>`.

---

## Fitur Utama

- **Checkout atomik** — sale, sale lines, payments, dan stock movements dalam satu transaksi PostgreSQL
- **Concurrency-safe** — `SELECT FOR UPDATE` mencegah overselling dari dua kasir bersamaan
- **Idempotency** — retry checkout dengan key yang sama tidak membuat duplikat transaksi
- **RBAC** — otorisasi backend per role dan per cabang; tidak bergantung hanya pada UI
- **Audit log stok** — setiap perubahan stok (penjualan, penyesuaian, transfer) tercatat dengan aktor dan referensi
- **Void transaksi** — pembatalan struk dengan pengembalian stok otomatis dan audit log
- **Multi-cabang** — data bisnis, stok, dan laporan terisolasi per cabang

---

## Batasan & Asumsi

- Mata uang default: **IDR** (Rupiah), disimpan dalam `BIGINT` (satuan terkecil)
- **Offline checkout tidak didukung** — koneksi server aktif wajib untuk menjamin lock stok
- Integrasi payment gateway belum diimplementasi — pembayaran non-tunai dicatat manual
- WebSocket real-time direncanakan pada Phase 5
- Tidak menggunakan Docker, Redis, Kafka, atau microservices
