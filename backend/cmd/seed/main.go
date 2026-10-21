package main

import (
	"context"
	"fmt"
	"log"
	"os"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
	"golang.org/x/crypto/bcrypt"
)

func hashPassword(password string) string {
	bytes, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		log.Fatalf("Failed to hash password: %v", err)
	}
	return string(bytes)
}

func main() {
	_ = godotenv.Load()

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		log.Fatal("DATABASE_URL is required")
	}

	ctx := context.Background()
	pool, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		log.Fatalf("Unable to connect to database: %v", err)
	}
	defer pool.Close()

	// Check if already seeded
	var count int
	_ = pool.QueryRow(ctx, "SELECT COUNT(*) FROM businesses").Scan(&count)
	if count > 0 {
		fmt.Println("Database already contains business data. Skipping seed.")
		return
	}

	tx, err := pool.Begin(ctx)
	if err != nil {
		log.Fatalf("Begin tx failed: %v", err)
	}
	defer tx.Rollback(ctx)

	// 1. Business
	bizID := uuid.New()
	_, err = tx.Exec(ctx, `
		INSERT INTO businesses (id, name, currency) 
		VALUES ($1, $2, $3)
	`, bizID, "Sentosa Retail Group", "IDR")
	if err != nil {
		log.Fatalf("Insert business failed: %v", err)
	}

	// 2. Branches
	branchCentralID := uuid.New()
	branchMallID := uuid.New()
	_, err = tx.Exec(ctx, `
		INSERT INTO branches (id, business_id, name, address, phone) 
		VALUES 
			($1, $2, 'Cabang Pusat (Sudirman)', 'Jl. Jenderal Sudirman No. 45, Jakarta', '021-5551234'),
			($3, $2, 'Cabang Mall (Kelapa Gading)', 'Mall Kelapa Gading Lt. 2, Jakarta Utara', '021-5555678')
	`, branchCentralID, bizID, branchMallID)
	if err != nil {
		log.Fatalf("Insert branches failed: %v", err)
	}

	// 3. Users
	hashedPass := hashPassword("password123")
	userOwnerID := uuid.New()
	userManagerID := uuid.New()
	userCashierID := uuid.New()
	userInventoryID := uuid.New()

	_, err = tx.Exec(ctx, `
		INSERT INTO users (id, business_id, username, email, password_hash, full_name, role)
		VALUES 
			($1, $2, 'owner', 'owner@sentosa.com', $3, 'Budi Santoso (Owner)', 'owner'),
			($4, $2, 'manager', 'manager@sentosa.com', $3, 'Dewi Lestari (Manager)', 'branch_manager'),
			($5, $2, 'cashier', 'cashier@sentosa.com', $3, 'Rian Pratama (Kasir)', 'cashier'),
			($6, $2, 'inventory', 'inventory@sentosa.com', $3, 'Ahmad Fauzi (Gudang)', 'inventory_staff')
	`, userOwnerID, bizID, hashedPass, userManagerID, userCashierID, userInventoryID)
	if err != nil {
		log.Fatalf("Insert users failed: %v", err)
	}

	// 4. User branch assignments
	// Manager, Cashier, Inventory assigned to Central branch
	_, err = tx.Exec(ctx, `
		INSERT INTO user_branch_assignments (user_id, branch_id)
		VALUES 
			($1, $3),
			($2, $3),
			($2, $4)
	`, userCashierID, userInventoryID, branchCentralID, branchMallID)
	if err != nil {
		log.Fatalf("Insert user_branch_assignments failed: %v", err)
	}

	// 5. Units
	unitPcsID := uuid.New()
	unitBoxID := uuid.New()
	unitKgID := uuid.New()
	_, err = tx.Exec(ctx, `
		INSERT INTO units (id, business_id, name, symbol)
		VALUES 
			($1, $2, 'Pieces', 'pcs'),
			($3, $2, 'Box', 'box'),
			($4, $2, 'Kilogram', 'kg')
	`, unitPcsID, bizID, unitBoxID, unitKgID)
	if err != nil {
		log.Fatalf("Insert units failed: %v", err)
	}

	// 6. Categories
	catBeveragesID := uuid.New()
	catSnacksID := uuid.New()
	catGroceriesID := uuid.New()
	_, err = tx.Exec(ctx, `
		INSERT INTO categories (id, business_id, name)
		VALUES 
			($1, $2, 'Minuman & Kopi'),
			($3, $2, 'Makanan Ringan'),
			($4, $2, 'Sembako & Kebutuhan')
	`, catBeveragesID, bizID, catSnacksID, catGroceriesID)
	if err != nil {
		log.Fatalf("Insert categories failed: %v", err)
	}

	// 7. Products
	type prodSeed struct {
		id       uuid.UUID
		catID    uuid.UUID
		unitID   uuid.UUID
		name     string
		sku      string
		barcode  string
		selling  int64
		cost     int64
		stockCen int
		stockMal int
	}

	prods := []prodSeed{
		{uuid.New(), catBeveragesID, unitPcsID, "Kopi Susu Gula Aren 250ml", "BEV-001", "8991001001", 18000, 10000, 50, 25},
		{uuid.New(), catBeveragesID, unitPcsID, "Teh Botol Kotak 250ml", "BEV-002", "8991001002", 5000, 3200, 120, 60},
		{uuid.New(), catBeveragesID, unitPcsID, "Air Mineral 600ml", "BEV-003", "8991001003", 4000, 2200, 150, 80},
		{uuid.New(), catSnacksID, unitPcsID, "Keripik Singkong Balado 150g", "SNK-001", "8992002001", 12500, 8000, 40, 20},
		{uuid.New(), catSnacksID, unitPcsID, "Biskuit Cokelat Roma 200g", "SNK-002", "8992002002", 9500, 6500, 60, 30},
		{uuid.New(), catGroceriesID, unitPcsID, "Mie Instan Goreng Spesial", "GRO-001", "8993003001", 3500, 2600, 200, 100},
		{uuid.New(), catGroceriesID, unitPcsID, "Minyak Goreng Pouch 2L", "GRO-002", "8993003002", 34000, 29000, 35, 15},
		{uuid.New(), catGroceriesID, unitKgID, "Beras Premium Ramos 5kg", "GRO-003", "8993003003", 72000, 64000, 20, 10},
	}

	for _, p := range prods {
		_, err = tx.Exec(ctx, `
			INSERT INTO products (id, business_id, category_id, unit_id, name, sku, barcode, selling_price, cost_price)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		`, p.id, bizID, p.catID, p.unitID, p.name, p.sku, p.barcode, p.selling, p.cost)
		if err != nil {
			log.Fatalf("Insert product %s failed: %v", p.name, err)
		}

		// Insert branch inventory for Central Branch
		_, err = tx.Exec(ctx, `
			INSERT INTO branch_inventory (business_id, branch_id, product_id, stock_quantity, min_stock_alert)
			VALUES ($1, $2, $3, $4, 5)
		`, bizID, branchCentralID, p.id, p.stockCen)
		if err != nil {
			log.Fatalf("Insert inventory Central for %s failed: %v", p.name, err)
		}

		// Insert inventory movements for initial receiving
		_, err = tx.Exec(ctx, `
			INSERT INTO inventory_movements (business_id, branch_id, product_id, movement_type, quantity, balance_after, reference_id, notes, user_id)
			VALUES ($1, $2, $3, 'receiving', $4, $4, 'INITIAL_SEED', 'Stok Awal Cabang Pusat', $5)
		`, bizID, branchCentralID, p.id, p.stockCen, userInventoryID)
		if err != nil {
			log.Fatalf("Insert movement Central for %s failed: %v", p.name, err)
		}

		// Insert branch inventory for Mall Branch
		_, err = tx.Exec(ctx, `
			INSERT INTO branch_inventory (business_id, branch_id, product_id, stock_quantity, min_stock_alert)
			VALUES ($1, $2, $3, $4, 5)
		`, bizID, branchMallID, p.id, p.stockMal)
		if err != nil {
			log.Fatalf("Insert inventory Mall for %s failed: %v", p.name, err)
		}

		_, err = tx.Exec(ctx, `
			INSERT INTO inventory_movements (business_id, branch_id, product_id, movement_type, quantity, balance_after, reference_id, notes, user_id)
			VALUES ($1, $2, $3, 'receiving', $4, $4, 'INITIAL_SEED', 'Stok Awal Cabang Mall', $5)
		`, bizID, branchMallID, p.id, p.stockMal, userInventoryID)
		if err != nil {
			log.Fatalf("Insert movement Mall for %s failed: %v", p.name, err)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		log.Fatalf("Commit seed tx failed: %v", err)
	}

	fmt.Println("Database successfully seeded with initial business, branches, users, and catalog inventory!")
}
