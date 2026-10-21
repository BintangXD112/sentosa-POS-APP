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

type RestockRequest struct {
	SupplierID  *uuid.UUID `json:"supplier_id"`
	BranchID    uuid.UUID  `json:"branch_id"`
	ProductID   uuid.UUID  `json:"product_id"`
	Quantity    int        `json:"quantity"`
	ReferenceID string     `json:"reference_id"`
	Notes       string     `json:"notes"`
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

// RestockFromSupplier — Add stock from supplier into branch inventory
func RestockFromSupplier(c *fiber.Ctx) error {
	bizID := c.Locals("business_id").(uuid.UUID)
	userID := c.Locals("user_id").(uuid.UUID)

	var req RestockRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Data payload tidak valid"})
	}

	if req.Quantity <= 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Jumlah pasokan stok harus lebih dari 0"})
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

	// Fetch product name
	var productName string
	err := database.Pool.QueryRow(c.Context(), `SELECT name FROM products WHERE id = $1 AND business_id = $2`, req.ProductID, bizID).Scan(&productName)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Produk tidak ditemukan"})
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

	// Upsert branch inventory
	var currentStock int
	var invID uuid.UUID
	err = tx.QueryRow(c.Context(), `
		SELECT id, stock_quantity 
		FROM branch_inventory 
		WHERE branch_id = $1 AND product_id = $2
		FOR UPDATE
	`, req.BranchID, req.ProductID).Scan(&invID, &currentStock)

	var newStock int
	if err != nil {
		// New inventory row
		invID = uuid.New()
		newStock = req.Quantity
		_, err = tx.Exec(c.Context(), `
			INSERT INTO branch_inventory (id, business_id, branch_id, product_id, stock_quantity)
			VALUES ($1, $2, $3, $4, $5)
		`, invID, bizID, req.BranchID, req.ProductID, newStock)
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Gagal membuat data stok: " + err.Error()})
		}
	} else {
		newStock = currentStock + req.Quantity
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
	`, bizID, req.BranchID, req.ProductID, req.Quantity, newStock, refID, notes, userID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Gagal mencatat mutasi stok: " + err.Error()})
	}

	if err := tx.Commit(c.Context()); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Gagal menyimpan pasokan stok"})
	}

	database.LogAudit(c.Context(), bizID, &userID, "inventory.restock", "product", req.ProductID.String(), map[string]interface{}{
		"supplier":  supplierName,
		"product":   productName,
		"quantity":  req.Quantity,
		"new_stock": newStock,
		"reference": refID,
	}, c.IP(), c.Get("User-Agent"))

	return c.JSON(fiber.Map{
		"message":       fmt.Sprintf("Berhasil menambah %d stok untuk %s", req.Quantity, productName),
		"product_name":  productName,
		"supplier_name": supplierName,
		"initial_stock": currentStock,
		"added_qty":     req.Quantity,
		"new_stock":     newStock,
		"reference_id":  refID,
	})
}
