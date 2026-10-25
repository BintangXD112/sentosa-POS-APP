package handlers

import (
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"pos-backend/internal/database"
)

type BusinessResponse struct {
	ID              uuid.UUID `json:"id"`
	Name            string    `json:"name"`
	Currency        string    `json:"currency"`
	Phone           string    `json:"phone"`
	Address         string    `json:"address"`
	ReceiptFooter   string    `json:"receipt_footer"`
	TwoFactorEnabled bool     `json:"two_factor_enabled"`
	CreatedAt       time.Time `json:"created_at"`
}

type UpdateBusinessRequest struct {
	Name          string `json:"name"`
	Currency      string `json:"currency"`
	Phone         string `json:"phone"`
	Address       string `json:"address"`
	ReceiptFooter string `json:"receipt_footer"`
}

type UpdateBranchRequest struct {
	Name     string `json:"name"`
	Address  string `json:"address"`
	Phone    string `json:"phone"`
	IsActive bool   `json:"is_active"`
}

type CreateBranchRequest struct {
	Name     string `json:"name"`
	Address  string `json:"address"`
	Phone    string `json:"phone"`
	IsActive *bool  `json:"is_active"`
}

func GetBusiness(c *fiber.Ctx) error {
	bizID := c.Locals("business_id").(uuid.UUID)

	var biz BusinessResponse
	err := database.Pool.QueryRow(c.Context(), `
		SELECT id, name, currency, COALESCE(phone, ''), COALESCE(address, ''), COALESCE(receipt_footer, ''), COALESCE(two_factor_enabled, TRUE), created_at
		FROM businesses
		WHERE id = $1
	`, bizID).Scan(&biz.ID, &biz.Name, &biz.Currency, &biz.Phone, &biz.Address, &biz.ReceiptFooter, &biz.CreatedAt)

	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Data toko tidak ditemukan"})
	}

	rows, err := database.Pool.Query(c.Context(), `
		SELECT id, name, COALESCE(address, ''), COALESCE(phone, ''), is_active
		FROM branches
		WHERE business_id = $1
		ORDER BY created_at ASC
	`, bizID)
	var branches []BranchResponse
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var b BranchResponse
			if err := rows.Scan(&b.ID, &b.Name, &b.Address, &b.Phone, &b.IsActive); err == nil {
				branches = append(branches, b)
			}
		}
	}

	return c.JSON(fiber.Map{
		"business": biz,
		"branches": branches,
	})
}

func UpdateBusiness(c *fiber.Ctx) error {
	bizID := c.Locals("business_id").(uuid.UUID)

	var req UpdateBusinessRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Payload tidak valid"})
	}

	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Nama toko tidak boleh kosong"})
	}

	if req.Currency == "" {
		req.Currency = "IDR"
	}

	_, err := database.Pool.Exec(c.Context(), `
		UPDATE businesses
		SET name = $1, currency = $2, phone = $3, address = $4, receipt_footer = $5, updated_at = NOW()
		WHERE id = $6
	`, req.Name, req.Currency, req.Phone, req.Address, req.ReceiptFooter, bizID)

	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Gagal menyimpan pengaturan toko"})
	}

	userID := c.Locals("user_id").(uuid.UUID)
	database.LogAudit(c.Context(), bizID, &userID, "business.update", "business", bizID.String(), map[string]interface{}{
		"name":     req.Name,
		"currency": req.Currency,
	}, c.IP(), c.Get("User-Agent"))

	return c.JSON(fiber.Map{
		"message": "Pengaturan toko berhasil diperbarui",
		"business": fiber.Map{
			"id":             bizID,
			"name":           req.Name,
			"currency":       req.Currency,
			"phone":          req.Phone,
			"address":        req.Address,
			"receipt_footer": req.ReceiptFooter,
		},
	})
}

type UpdateTwoFactorRequest struct {
	Enabled bool `json:"enabled"`
}

func UpdateTwoFactorSetting(c *fiber.Ctx) error {
	bizID := c.Locals("business_id").(uuid.UUID)
	userID := c.Locals("user_id").(uuid.UUID)

	var req UpdateTwoFactorRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Payload pengaturan A2F tidak valid"})
	}

	_, err := database.Pool.Exec(c.Context(), `
		UPDATE businesses SET two_factor_enabled = $1, updated_at = NOW() WHERE id = $2
	`, req.Enabled, bizID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Gagal menyimpan pengaturan A2F"})
	}

	database.LogAudit(c.Context(), bizID, &userID, "business.two_factor.update", "business", bizID.String(), map[string]interface{}{
		"enabled": req.Enabled,
	}, c.IP(), c.Get("User-Agent"))

	return c.JSON(fiber.Map{"message": "Pengaturan A2F berhasil diperbarui", "enabled": req.Enabled})
}

func UpdateBranch(c *fiber.Ctx) error {
	bizID := c.Locals("business_id").(uuid.UUID)
	branchIDStr := c.Params("id")
	branchID, err := uuid.Parse(branchIDStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "ID cabang tidak valid"})
	}

	var req UpdateBranchRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Payload tidak valid"})
	}

	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Nama cabang tidak boleh kosong"})
	}

	res, err := database.Pool.Exec(c.Context(), `
		UPDATE branches
		SET name = $1, address = $2, phone = $3, is_active = $4, updated_at = NOW()
		WHERE id = $5 AND business_id = $6
	`, req.Name, req.Address, req.Phone, req.IsActive, branchID, bizID)

	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Gagal memperbarui data cabang"})
	}

	if res.RowsAffected() == 0 {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Cabang tidak ditemukan"})
	}

	userID := c.Locals("user_id").(uuid.UUID)
	database.LogAudit(c.Context(), bizID, &userID, "branch.update", "branch", branchID.String(), map[string]interface{}{
		"name":      req.Name,
		"is_active": req.IsActive,
	}, c.IP(), c.Get("User-Agent"))

	return c.JSON(fiber.Map{
		"message": "Data cabang berhasil diperbarui",
		"branch": fiber.Map{
			"id":        branchID,
			"name":      req.Name,
			"address":   req.Address,
			"phone":     req.Phone,
			"is_active": req.IsActive,
		},
	})
}

// CreateBranch — Tambah cabang / outlet baru (Owner only)
func CreateBranch(c *fiber.Ctx) error {
	bizID := c.Locals("business_id").(uuid.UUID)

	var req CreateBranchRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Payload tidak valid"})
	}

	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Nama cabang tidak boleh kosong"})
	}

	isActive := true
	if req.IsActive != nil {
		isActive = *req.IsActive
	}

	newID := uuid.New()
	_, err := database.Pool.Exec(c.Context(), `
		INSERT INTO branches (id, business_id, name, address, phone, is_active, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
	`, newID, bizID, req.Name, strings.TrimSpace(req.Address), strings.TrimSpace(req.Phone), isActive)

	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Gagal menambahkan data cabang: " + err.Error()})
	}

	// Inisialisasi entri branch_inventory untuk semua produk yang ada di bisnis ini (stok awal 0)
	_, _ = database.Pool.Exec(c.Context(), `
		INSERT INTO branch_inventory (id, business_id, branch_id, product_id, stock_quantity, min_stock_alert)
		SELECT gen_random_uuid(), business_id, $1, id, 0, 5
		FROM products
		WHERE business_id = $2
		ON CONFLICT (branch_id, product_id) DO NOTHING
	`, newID, bizID)

	userID := c.Locals("user_id").(uuid.UUID)
	database.LogAudit(c.Context(), bizID, &userID, "branch.create", "branch", newID.String(), map[string]interface{}{
		"name":      req.Name,
		"address":   req.Address,
		"phone":     req.Phone,
		"is_active": isActive,
	}, c.IP(), c.Get("User-Agent"))

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"message": "Cabang baru berhasil ditambahkan",
		"branch": BranchResponse{
			ID:       newID,
			Name:     req.Name,
			Address:  strings.TrimSpace(req.Address),
			Phone:    strings.TrimSpace(req.Phone),
			IsActive: isActive,
		},
	})
}
