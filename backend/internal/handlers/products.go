package handlers

import (
	"fmt"
	"strconv"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"pos-backend/internal/database"
)

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
