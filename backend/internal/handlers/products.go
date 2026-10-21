package handlers

import (
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"pos-backend/internal/database"
)

type CreateProductBody struct {
	Name         string     `json:"name"`
	SKU          string     `json:"sku"`
	Barcode      string     `json:"barcode"`
	SellingPrice int64      `json:"selling_price"`
	CostPrice    int64      `json:"cost_price"`
	CategoryID   string     `json:"category_id"`
	UnitID       string     `json:"unit_id"`
	InitialStock int        `json:"initial_stock"`
	MinStockAlert int       `json:"min_stock_alert"`
}

// CreateProduct — Tambah produk baru + inisialisasi stok cabang
func CreateProduct(c *fiber.Ctx) error {
	bizID := c.Locals("business_id").(uuid.UUID)
	branchID := c.Locals("branch_id").(uuid.UUID)
	userID := c.Locals("user_id").(uuid.UUID)

	var body CreateProductBody
	if err := c.BodyParser(&body); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Payload tidak valid"})
	}

	name := strings.TrimSpace(body.Name)
	sku := strings.TrimSpace(body.SKU)
	if name == "" || sku == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Nama dan SKU wajib diisi"})
	}
	if body.SellingPrice < 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Harga jual tidak boleh negatif"})
	}

	// Parse optional UUIDs
	var catID *uuid.UUID
	if body.CategoryID != "" {
		parsed, err := uuid.Parse(body.CategoryID)
		if err == nil {
			catID = &parsed
		}
	}
	var unitID *uuid.UUID
	if body.UnitID != "" {
		parsed, err := uuid.Parse(body.UnitID)
		if err == nil {
			unitID = &parsed
		}
	}
	barcode := strings.TrimSpace(body.Barcode)
	var barcodePtr *string
	if barcode != "" {
		barcodePtr = &barcode
	}

	minStock := body.MinStockAlert
	if minStock < 0 {
		minStock = 5
	}

	productID := uuid.New()
	now := time.Now()

	// Insert product
	_, err := database.Pool.Exec(c.Context(), `
		INSERT INTO products (id, business_id, category_id, unit_id, name, sku, barcode, selling_price, cost_price, is_active, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, $10, $10)
	`, productID, bizID, catID, unitID, name, sku, barcodePtr, body.SellingPrice, body.CostPrice, now)
	if err != nil {
		if strings.Contains(err.Error(), "uq_products_business_sku") {
			return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": "SKU sudah digunakan oleh produk lain"})
		}
		if strings.Contains(err.Error(), "uq_products_business_barcode") {
			return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": "Barcode sudah digunakan oleh produk lain"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Gagal menyimpan produk: " + err.Error()})
	}

	// Initialize branch inventory
	_, err = database.Pool.Exec(c.Context(), `
		INSERT INTO branch_inventory (id, business_id, branch_id, product_id, stock_quantity, min_stock_alert, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, NOW())
		ON CONFLICT (branch_id, product_id) DO NOTHING
	`, uuid.New(), bizID, branchID, productID, body.InitialStock, minStock)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Produk tersimpan tapi gagal inisialisasi stok: " + err.Error()})
	}

	// Record inventory movement if initial stock > 0
	if body.InitialStock > 0 {
		_, _ = database.Pool.Exec(c.Context(), `
			INSERT INTO inventory_movements (id, business_id, branch_id, product_id, movement_type, quantity, balance_after, reference_id, notes, user_id, created_at)
			VALUES ($1, $2, $3, $4, 'receiving', $5, $5, $6, 'Stok awal saat penambahan produk', $7, NOW())
		`, uuid.New(), bizID, branchID, productID, body.InitialStock, "INIT-"+productID.String()[:8], userID)
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"message":    "Produk berhasil ditambahkan",
		"product_id": productID,
	})
}

// UpdateProduct — Edit data produk (nama, harga, kategori, dll) + update min_stock_alert
func UpdateProduct(c *fiber.Ctx) error {
	bizID := c.Locals("business_id").(uuid.UUID)
	branchID := c.Locals("branch_id").(uuid.UUID)

	productID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "ID produk tidak valid"})
	}

	var body CreateProductBody
	if err := c.BodyParser(&body); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Payload tidak valid"})
	}

	name := strings.TrimSpace(body.Name)
	sku := strings.TrimSpace(body.SKU)
	if name == "" || sku == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Nama dan SKU wajib diisi"})
	}

	var catID *uuid.UUID
	if body.CategoryID != "" {
		parsed, err := uuid.Parse(body.CategoryID)
		if err == nil {
			catID = &parsed
		}
	}
	var unitID *uuid.UUID
	if body.UnitID != "" {
		parsed, err := uuid.Parse(body.UnitID)
		if err == nil {
			unitID = &parsed
		}
	}
	barcode := strings.TrimSpace(body.Barcode)
	var barcodePtr *string
	if barcode != "" {
		barcodePtr = &barcode
	}

	res, err := database.Pool.Exec(c.Context(), `
		UPDATE products SET
			name = $1, sku = $2, barcode = $3,
			selling_price = $4, cost_price = $5,
			category_id = $6, unit_id = $7,
			updated_at = NOW()
		WHERE id = $8 AND business_id = $9
	`, name, sku, barcodePtr, body.SellingPrice, body.CostPrice, catID, unitID, productID, bizID)
	if err != nil {
		if strings.Contains(err.Error(), "uq_products_business_sku") {
			return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": "SKU sudah digunakan oleh produk lain"})
		}
		if strings.Contains(err.Error(), "uq_products_business_barcode") {
			return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": "Barcode sudah digunakan oleh produk lain"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Gagal memperbarui produk: " + err.Error()})
	}
	if res.RowsAffected() == 0 {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Produk tidak ditemukan"})
	}

	// Update min_stock_alert in branch_inventory
	if body.MinStockAlert >= 0 {
		_, _ = database.Pool.Exec(c.Context(), `
			UPDATE branch_inventory SET min_stock_alert = $1, updated_at = NOW()
			WHERE branch_id = $2 AND product_id = $3
		`, body.MinStockAlert, branchID, productID)
	}

	return c.JSON(fiber.Map{"message": "Produk berhasil diperbarui"})
}

type ProductItem struct {
	ID           uuid.UUID  `json:"id"`
	CategoryID   *uuid.UUID `json:"category_id"`
	CategoryName *string    `json:"category_name"`
	UnitID       *uuid.UUID `json:"unit_id"`
	UnitName     *string    `json:"unit_name"`
	UnitSymbol   *string    `json:"unit_symbol"`
	Name         string     `json:"name"`
	SKU          string     `json:"sku"`
	Barcode      *string    `json:"barcode"`
	SellingPrice int64      `json:"selling_price"`
	CostPrice    *int64     `json:"cost_price,omitempty"`
	Stock        int        `json:"stock"`
	IsActive     bool       `json:"is_active"`
}

func GetProducts(c *fiber.Ctx) error {
	bizID := c.Locals("business_id").(uuid.UUID)
	branchID := c.Locals("branch_id").(uuid.UUID)
	role := c.Locals("role").(string)

	query := c.Query("q", "")
	categoryID := c.Query("category_id", "")
	page, _ := strconv.Atoi(c.Query("page", "1"))
	limit, _ := strconv.Atoi(c.Query("limit", "50"))
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 200 {
		limit = 50
	}
	offset := (page - 1) * limit

	sqlQuery := `
		SELECT 
			p.id, p.category_id, c.name as category_name,
			p.unit_id, u.name as unit_name, u.symbol as unit_symbol,
			p.name, p.sku, p.barcode, p.selling_price, p.cost_price,
			COALESCE(bi.stock_quantity, 0) as stock, p.is_active
		FROM products p
		LEFT JOIN categories c ON p.category_id = c.id
		LEFT JOIN units u ON p.unit_id = u.id
		LEFT JOIN branch_inventory bi ON p.id = bi.product_id AND bi.branch_id = $1
		WHERE p.business_id = $2 AND p.is_active = true
	`

	args := []interface{}{branchID, bizID}
	argIdx := 3

	if query != "" {
		sqlQuery += fmt.Sprintf(" AND (p.name ILIKE $%d OR p.sku ILIKE $%d OR p.barcode ILIKE $%d)", argIdx, argIdx, argIdx)
		args = append(args, "%"+query+"%")
		argIdx++
	}

	if categoryID != "" {
		if catUUID, err := uuid.Parse(categoryID); err == nil {
			sqlQuery += fmt.Sprintf(" AND p.category_id = $%d", argIdx)
			args = append(args, catUUID)
			argIdx++
		}
	}

	sqlQuery += fmt.Sprintf(" ORDER BY p.name ASC LIMIT $%d OFFSET $%d", argIdx, argIdx+1)
	args = append(args, limit, offset)

	rows, err := database.Pool.Query(c.Context(), sqlQuery, args...)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to fetch products: " + err.Error()})
	}
	defer rows.Close()

	var products []ProductItem
	for rows.Next() {
		var p ProductItem
		var costPrice int64
		err := rows.Scan(
			&p.ID, &p.CategoryID, &p.CategoryName,
			&p.UnitID, &p.UnitName, &p.UnitSymbol,
			&p.Name, &p.SKU, &p.Barcode, &p.SellingPrice, &costPrice,
			&p.Stock, &p.IsActive,
		)
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to parse product row"})
		}

		// Only owner and manager can see cost_price
		if role == "owner" || role == "branch_manager" {
			p.CostPrice = &costPrice
		}

		products = append(products, p)
	}

	if products == nil {
		products = []ProductItem{}
	}

	return c.JSON(fiber.Map{
		"page":     page,
		"limit":    limit,
		"products": products,
	})
}

func GetCategories(c *fiber.Ctx) error {
	bizID := c.Locals("business_id").(uuid.UUID)

	rows, err := database.Pool.Query(c.Context(), `
		SELECT id, name FROM categories WHERE business_id = $1 ORDER BY name ASC
	`, bizID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to fetch categories"})
	}
	defer rows.Close()

	type CatItem struct {
		ID   uuid.UUID `json:"id"`
		Name string    `json:"name"`
	}

	var items []CatItem
	for rows.Next() {
		var item CatItem
		if err := rows.Scan(&item.ID, &item.Name); err == nil {
			items = append(items, item)
		}
	}
	if items == nil {
		items = []CatItem{}
	}
	return c.JSON(fiber.Map{"categories": items})
}

func GetUnits(c *fiber.Ctx) error {
	bizID := c.Locals("business_id").(uuid.UUID)

	rows, err := database.Pool.Query(c.Context(), `
		SELECT id, name, symbol FROM units WHERE business_id = $1 ORDER BY name ASC
	`, bizID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to fetch units"})
	}
	defer rows.Close()

	type UnitItem struct {
		ID     uuid.UUID `json:"id"`
		Name   string    `json:"name"`
		Symbol string    `json:"symbol"`
	}

	var items []UnitItem
	for rows.Next() {
		var item UnitItem
		if err := rows.Scan(&item.ID, &item.Name, &item.Symbol); err == nil {
			items = append(items, item)
		}
	}
	if items == nil {
		items = []UnitItem{}
	}
	return c.JSON(fiber.Map{"units": items})
}

// DeleteProduct — Hapus produk (Soft delete is_active = false)
func DeleteProduct(c *fiber.Ctx) error {
	bizID := c.Locals("business_id").(uuid.UUID)
	productID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "ID produk tidak valid"})
	}

	res, err := database.Pool.Exec(c.Context(), `
		UPDATE products
		SET is_active = false, updated_at = NOW()
		WHERE id = $1 AND business_id = $2
	`, productID, bizID)

	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Gagal menghapus produk: " + err.Error()})
	}

	if res.RowsAffected() == 0 {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Produk tidak ditemukan"})
	}

	return c.JSON(fiber.Map{
		"message": "Produk berhasil dihapus dari sistem",
	})
}
