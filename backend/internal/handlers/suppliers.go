package handlers

import (
	"fmt"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"pos-backend/internal/database"
)

type SupplierItem struct {
	ID            uuid.UUID `json:"id"`
	Name          string    `json:"name"`
	ContactPerson string    `json:"contact_person"`
	Phone         string    `json:"phone"`
	Email         string    `json:"email"`
	Address       string    `json:"address"`
	Notes         string    `json:"notes"`
	CreatedAt     time.Time `json:"created_at"`
	TotalSupplies int       `json:"total_supplies"`
}

type CreateSupplierRequest struct {
	Name          string `json:"name"`
	ContactPerson string `json:"contact_person"`
	Phone         string `json:"phone"`
	Email         string `json:"email"`
	Address       string `json:"address"`
	Notes         string `json:"notes"`
}

type RestockItemInput struct {
	ProductID uuid.UUID `json:"product_id"`
	Quantity  int       `json:"quantity"`
}

type RestockItemResult struct {
	ProductID    uuid.UUID `json:"product_id"`
	ProductName  string    `json:"product_name"`
	InitialStock int       `json:"initial_stock"`
	AddedQty     int       `json:"added_qty"`
	NewStock     int       `json:"new_stock"`
}

type RestockRequest struct {
	SupplierID  *uuid.UUID         `json:"supplier_id"`
	BranchID    uuid.UUID          `json:"branch_id"`
	ProductID   *uuid.UUID         `json:"product_id,omitempty"` // For backwards compatibility
	Quantity    *int               `json:"quantity,omitempty"`   // For backwards compatibility
	Items       []RestockItemInput `json:"items,omitempty"`
	ReferenceID string             `json:"reference_id"`
	Notes       string             `json:"notes"`
}

// GetSuppliers — List all suppliers for this business
func GetSuppliers(c *fiber.Ctx) error {
	bizID := c.Locals("business_id").(uuid.UUID)

	query := `
		SELECT 
			s.id, s.name, COALESCE(s.contact_person, ''), COALESCE(s.phone, ''), 
			COALESCE(s.email, ''), COALESCE(s.address, ''), COALESCE(s.notes, ''), 
			s.created_at,
			(SELECT COUNT(*) FROM inventory_movements im WHERE im.movement_type = 'receiving' AND im.business_id = s.business_id AND im.notes ILIKE '%' || s.name || '%') as total_supplies
		FROM suppliers s
		WHERE s.business_id = $1
		ORDER BY s.name ASC
	`

	rows, err := database.Pool.Query(c.Context(), query, bizID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Gagal mengambil daftar supplier: " + err.Error()})
	}
	defer rows.Close()

	var suppliers []SupplierItem
	for rows.Next() {
		var s SupplierItem
		if err := rows.Scan(
			&s.ID, &s.Name, &s.ContactPerson, &s.Phone,
			&s.Email, &s.Address, &s.Notes, &s.CreatedAt, &s.TotalSupplies,
		); err == nil {
			suppliers = append(suppliers, s)
		}
	}

	if suppliers == nil {
		suppliers = []SupplierItem{}
	}

	return c.JSON(fiber.Map{"suppliers": suppliers})
}

// CreateSupplier — Add a new supplier
func CreateSupplier(c *fiber.Ctx) error {
	bizID := c.Locals("business_id").(uuid.UUID)

	var req CreateSupplierRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Data payload tidak valid"})
	}

	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Nama supplier wajib diisi"})
	}

	newID := uuid.New()
	_, err := database.Pool.Exec(c.Context(), `
		INSERT INTO suppliers (id, business_id, name, contact_person, phone, email, address, notes, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
	`, newID, bizID, req.Name, req.ContactPerson, req.Phone, req.Email, req.Address, req.Notes)

	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Gagal menambahkan supplier: " + err.Error()})
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"message": "Supplier berhasil ditambahkan",
		"supplier": fiber.Map{
			"id":             newID,
			"name":           req.Name,
			"contact_person": req.ContactPerson,
			"phone":          req.Phone,
			"email":          req.Email,
			"address":        req.Address,
			"notes":          req.Notes,
		},
	})
}

// UpdateSupplier — Edit existing supplier
func UpdateSupplier(c *fiber.Ctx) error {
	bizID := c.Locals("business_id").(uuid.UUID)
	supplierID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "ID supplier tidak valid"})
	}

	var req CreateSupplierRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Data payload tidak valid"})
	}

	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Nama supplier wajib diisi"})
	}

	res, err := database.Pool.Exec(c.Context(), `
		UPDATE suppliers
		SET name = $1, contact_person = $2, phone = $3, email = $4, address = $5, notes = $6, updated_at = NOW()
		WHERE id = $7 AND business_id = $8
	`, req.Name, req.ContactPerson, req.Phone, req.Email, req.Address, req.Notes, supplierID, bizID)

	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Gagal memperbarui data supplier"})
	}

	if res.RowsAffected() == 0 {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Supplier tidak ditemukan"})
	}

	return c.JSON(fiber.Map{
		"message": "Data supplier berhasil diperbarui",
	})
}

// DeleteSupplier — Remove supplier
func DeleteSupplier(c *fiber.Ctx) error {
	bizID := c.Locals("business_id").(uuid.UUID)
	supplierID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "ID supplier tidak valid"})
	}

	res, err := database.Pool.Exec(c.Context(), `
		DELETE FROM suppliers WHERE id = $1 AND business_id = $2
	`, supplierID, bizID)

	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Gagal menghapus supplier: " + err.Error()})
	}

	if res.RowsAffected() == 0 {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Supplier tidak ditemukan"})
	}

	return c.JSON(fiber.Map{"message": "Supplier berhasil dihapus"})
}

// RestockFromSupplier — Add stock from supplier into branch inventory (supports single or multi-item)
func RestockFromSupplier(c *fiber.Ctx) error {
	bizID := c.Locals("business_id").(uuid.UUID)
	userID := c.Locals("user_id").(uuid.UUID)

	var req RestockRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Data payload tidak valid"})
	}

	// Backwards compatibility for single item restock payload
	if len(req.Items) == 0 && req.ProductID != nil && req.Quantity != nil {
		req.Items = append(req.Items, RestockItemInput{
			ProductID: *req.ProductID,
			Quantity:  *req.Quantity,
		})
	}

	if len(req.Items) == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Pilih minimal satu barang untuk dipasok"})
	}

	// Consolidate duplicate products and validate quantity
	mergedQty := make(map[uuid.UUID]int)
	var orderedIDs []uuid.UUID
	for _, it := range req.Items {
		if it.Quantity <= 0 {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Jumlah pasokan setiap barang harus lebih dari 0"})
		}
		if _, exists := mergedQty[it.ProductID]; !exists {
			orderedIDs = append(orderedIDs, it.ProductID)
		}
		mergedQty[it.ProductID] += it.Quantity
	}

	// Fetch supplier name if provided
	supplierName := "Supplier Umum"
	if req.SupplierID != nil {
		var sName string
		err := database.Pool.QueryRow(c.Context(), `SELECT name FROM suppliers WHERE id = $1 AND business_id = $2`, *req.SupplierID, bizID).Scan(&sName)
		if err == nil {
			supplierName = sName
		}
	}

	// Reference ID
	refID := strings.TrimSpace(req.ReferenceID)
	if refID == "" {
		refID = fmt.Sprintf("PO-%d", time.Now().Unix())
	}

	notes := strings.TrimSpace(req.Notes)
	if notes == "" {
		notes = fmt.Sprintf("Pasokan stok dari %s", supplierName)
	} else {
		notes = fmt.Sprintf("Pasokan dari %s: %s", supplierName, notes)
	}

	tx, err := database.Pool.Begin(c.Context())
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Gagal memulai transaksi"})
	}
	defer tx.Rollback(c.Context())

	var processedItems []RestockItemResult
	totalQty := 0

	for _, prodID := range orderedIDs {
		qty := mergedQty[prodID]

		// Fetch product name
		var productName string
		err := tx.QueryRow(c.Context(), `SELECT name FROM products WHERE id = $1 AND business_id = $2`, prodID, bizID).Scan(&productName)
		if err != nil {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": fmt.Sprintf("Produk dengan ID %s tidak ditemukan", prodID)})
		}

		// Upsert branch inventory
		var currentStock int
		var invID uuid.UUID
		err = tx.QueryRow(c.Context(), `
			SELECT id, stock_quantity 
			FROM branch_inventory 
			WHERE branch_id = $1 AND product_id = $2
			FOR UPDATE
		`, req.BranchID, prodID).Scan(&invID, &currentStock)

		var newStock int
		if err != nil {
			// New inventory row
			invID = uuid.New()
			newStock = qty
			_, err = tx.Exec(c.Context(), `
				INSERT INTO branch_inventory (id, business_id, branch_id, product_id, stock_quantity)
				VALUES ($1, $2, $3, $4, $5)
			`, invID, bizID, req.BranchID, prodID, newStock)
			if err != nil {
				return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Gagal membuat data stok: " + err.Error()})
			}
		} else {
			newStock = currentStock + qty
			_, err = tx.Exec(c.Context(), `
				UPDATE branch_inventory 
				SET stock_quantity = $1, updated_at = NOW() 
				WHERE id = $2
			`, newStock, invID)
			if err != nil {
				return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Gagal memperbarui stok"})
			}
		}

		// Log movement
		_, err = tx.Exec(c.Context(), `
			INSERT INTO inventory_movements (
				business_id, branch_id, product_id, movement_type, quantity, balance_after, reference_id, notes, user_id
			) VALUES ($1, $2, $3, 'receiving', $4, $5, $6, $7, $8)
		`, bizID, req.BranchID, prodID, qty, newStock, refID, notes, userID)
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Gagal mencatat mutasi stok: " + err.Error()})
		}

		processedItems = append(processedItems, RestockItemResult{
			ProductID:    prodID,
			ProductName:  productName,
			InitialStock: currentStock,
			AddedQty:     qty,
			NewStock:     newStock,
		})
		totalQty += qty
	}

	if err := tx.Commit(c.Context()); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Gagal menyimpan pasokan stok"})
	}

	database.LogAudit(c.Context(), bizID, &userID, "inventory.restock", "supplier", supplierName, map[string]interface{}{
		"supplier":       supplierName,
		"reference":      refID,
		"total_items":    len(processedItems),
		"total_quantity": totalQty,
	}, c.IP(), c.Get("User-Agent"))

	resp := fiber.Map{
		"message":        fmt.Sprintf("Berhasil menambah pasokan %d barang (total %d unit)", len(processedItems), totalQty),
		"supplier_name":  supplierName,
		"reference_id":   refID,
		"total_items":    len(processedItems),
		"total_quantity": totalQty,
		"items":          processedItems,
	}

	// Legacy single-item fields
	if len(processedItems) == 1 {
		resp["product_name"] = processedItems[0].ProductName
		resp["initial_stock"] = processedItems[0].InitialStock
		resp["added_qty"] = processedItems[0].AddedQty
		resp["new_stock"] = processedItems[0].NewStock
	}

	return c.JSON(resp)
}

