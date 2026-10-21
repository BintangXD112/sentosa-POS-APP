package handlers

import (
	"fmt"
	"strconv"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"pos-backend/internal/database"
)

type StockItem struct {
	ProductID     uuid.UUID `json:"product_id"`
	ProductName   string    `json:"product_name"`
	SKU           string    `json:"sku"`
	Barcode       *string   `json:"barcode"`
	StockQuantity int       `json:"stock_quantity"`
	MinStockAlert int       `json:"min_stock_alert"`
	UnitSymbol    *string   `json:"unit_symbol"`
	CategoryName  *string   `json:"category_name"`
}

type StockAdjustmentRequest struct {
	ProductID uuid.UUID `json:"product_id"`
	NewStock  int       `json:"new_stock"`
	Notes     string    `json:"notes"`
}

type MovementRecord struct {
	ID           uuid.UUID `json:"id"`
	ProductName  string    `json:"product_name"`
	SKU          string    `json:"sku"`
	MovementType string    `json:"movement_type"`
	Quantity     int       `json:"quantity"`
	BalanceAfter int       `json:"balance_after"`
	ReferenceID  *string   `json:"reference_id"`
	Notes        *string   `json:"notes"`
	ActorName    *string   `json:"actor_name"`
	CreatedAt    time.Time `json:"created_at"`
}

func GetBranchInventory(c *fiber.Ctx) error {
	branchID := c.Locals("branch_id").(uuid.UUID)
	bizID := c.Locals("business_id").(uuid.UUID)

	query := `
		SELECT 
			p.id, p.name, p.sku, p.barcode,
			COALESCE(bi.stock_quantity, 0) as stock_quantity,
			COALESCE(bi.min_stock_alert, 5) as min_stock_alert,
			u.symbol, c.name
		FROM products p
		LEFT JOIN branch_inventory bi ON p.id = bi.product_id AND bi.branch_id = $1
		LEFT JOIN units u ON p.unit_id = u.id
		LEFT JOIN categories c ON p.category_id = c.id
		WHERE p.business_id = $2 AND p.is_active = true
		ORDER BY p.name ASC
	`

	rows, err := database.Pool.Query(c.Context(), query, branchID, bizID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to fetch inventory"})
	}
	defer rows.Close()

	var items []StockItem
	for rows.Next() {
		var item StockItem
		if err := rows.Scan(
			&item.ProductID, &item.ProductName, &item.SKU, &item.Barcode,
			&item.StockQuantity, &item.MinStockAlert, &item.UnitSymbol, &item.CategoryName,
		); err == nil {
			items = append(items, item)
		}
	}

	if items == nil {
		items = []StockItem{}
	}

	return c.JSON(fiber.Map{"inventory": items})
}

func AdjustStock(c *fiber.Ctx) error {
	branchID := c.Locals("branch_id").(uuid.UUID)
	bizID := c.Locals("business_id").(uuid.UUID)
	userID := c.Locals("user_id").(uuid.UUID)

	var req StockAdjustmentRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request payload"})
	}

	if req.NewStock < 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Negative stock is disallowed"})
	}

	tx, err := database.Pool.Begin(c.Context())
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to begin transaction"})
	}
	defer tx.Rollback(c.Context())

	var currentStock int
	var invID uuid.UUID
	err = tx.QueryRow(c.Context(), `
		SELECT id, stock_quantity 
		FROM branch_inventory 
		WHERE branch_id = $1 AND product_id = $2
		FOR UPDATE
	`, branchID, req.ProductID).Scan(&invID, &currentStock)

	if err != nil {
		// Insert if not yet exists
		invID = uuid.New()
		currentStock = 0
		_, err = tx.Exec(c.Context(), `
			INSERT INTO branch_inventory (id, business_id, branch_id, product_id, stock_quantity)
			VALUES ($1, $2, $3, $4, $5)
		`, invID, bizID, branchID, req.ProductID, req.NewStock)
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create inventory record: " + err.Error()})
		}
	} else {
		_, err = tx.Exec(c.Context(), `
			UPDATE branch_inventory 
			SET stock_quantity = $1, updated_at = NOW() 
			WHERE id = $2
		`, req.NewStock, invID)
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to update inventory"})
		}
	}

	diff := req.NewStock - currentStock
	notes := req.Notes
	if notes == "" {
		notes = fmt.Sprintf("Penyesuaian stok manual dari %d ke %d", currentStock, req.NewStock)
	}

	_, err = tx.Exec(c.Context(), `
		INSERT INTO inventory_movements (
			business_id, branch_id, product_id, movement_type, quantity, balance_after, reference_id, notes, user_id
		) VALUES ($1, $2, $3, 'adjustment', $4, $5, 'ADJUST', $6, $7)
	`, bizID, branchID, req.ProductID, diff, req.NewStock, notes, userID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to record movement: " + err.Error()})
	}

	if err := tx.Commit(c.Context()); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to commit adjustment"})
	}

	database.LogAudit(c.Context(), bizID, &userID, "inventory.adjust", "product", req.ProductID.String(), map[string]interface{}{
		"initial_stock": currentStock,
		"new_stock":     req.NewStock,
		"diff":          diff,
		"notes":         notes,
	}, c.IP(), c.Get("User-Agent"))

	return c.JSON(fiber.Map{
		"message":       "Stock successfully adjusted",
		"product_id":    req.ProductID,
		"initial_stock": currentStock,
		"new_stock":     req.NewStock,
		"diff":          diff,
	})
}

func GetInventoryMovements(c *fiber.Ctx) error {
	branchID := c.Locals("branch_id").(uuid.UUID)
	bizID := c.Locals("business_id").(uuid.UUID)

	page, _ := strconv.Atoi(c.Query("page", "1"))
	limit, _ := strconv.Atoi(c.Query("limit", "50"))
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 50
	}
	offset := (page - 1) * limit

	query := `
		SELECT 
			im.id, p.name as product_name, p.sku,
			im.movement_type, im.quantity, im.balance_after,
			im.reference_id, im.notes, u.full_name as actor_name, im.created_at
		FROM inventory_movements im
		JOIN products p ON im.product_id = p.id
		LEFT JOIN users u ON im.user_id = u.id
		WHERE im.business_id = $1 AND im.branch_id = $2
		ORDER BY im.created_at DESC
		LIMIT $3 OFFSET $4
	`

	rows, err := database.Pool.Query(c.Context(), query, bizID, branchID, limit, offset)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to fetch movements: " + err.Error()})
	}
	defer rows.Close()

	var movements []MovementRecord
	for rows.Next() {
		var m MovementRecord
		if err := rows.Scan(
			&m.ID, &m.ProductName, &m.SKU,
			&m.MovementType, &m.Quantity, &m.BalanceAfter,
			&m.ReferenceID, &m.Notes, &m.ActorName, &m.CreatedAt,
		); err == nil {
			movements = append(movements, m)
		}
	}

	if movements == nil {
		movements = []MovementRecord{}
	}

	return c.JSON(fiber.Map{
		"page":      page,
		"limit":     limit,
		"movements": movements,
	})
}
