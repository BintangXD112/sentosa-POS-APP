package handlers

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"pos-backend/internal/database"
)

type CartItemInput struct {
	ProductID uuid.UUID `json:"product_id"`
	Quantity  int       `json:"quantity"`
}

type CheckoutPaymentInput struct {
	Method     string `json:"method"` // 'cash', 'transfer', 'qris', 'debit'
	AmountPaid int64  `json:"amount_paid"`
}

type CheckoutRequest struct {
	IdempotencyKey string               `json:"idempotency_key"`
	Items          []CartItemInput      `json:"items"`
	Payment        CheckoutPaymentInput `json:"payment"`
	Notes          string               `json:"notes"`
}

type CheckoutReceiptLine struct {
	ProductID   uuid.UUID `json:"product_id"`
	ProductName string    `json:"product_name"`
	UnitPrice   int64     `json:"unit_price"`
	Quantity    int       `json:"quantity"`
	Subtotal    int64     `json:"subtotal"`
}

type CheckoutResponse struct {
	SaleID        uuid.UUID             `json:"sale_id"`
	ReceiptNumber string                `json:"receipt_number"`
	BranchName    string                `json:"branch_name"`
	CashierName   string                `json:"cashier_name"`
	CreatedAt     time.Time             `json:"created_at"`
	Subtotal      int64                 `json:"subtotal"`
	Discount      int64                 `json:"discount"`
	Tax           int64                 `json:"tax"`
	Total         int64                 `json:"total"`
	PaymentMethod string                `json:"payment_method"`
	AmountPaid    int64                 `json:"amount_paid"`
	ChangeDue     int64                 `json:"change_due"`
	Lines         []CheckoutReceiptLine `json:"lines"`
}

func ProcessCheckout(c *fiber.Ctx) error {
	bizID := c.Locals("business_id").(uuid.UUID)
	branchID := c.Locals("branch_id").(uuid.UUID)
	userID := c.Locals("user_id").(uuid.UUID)
	cashierName := c.Locals("full_name").(string)

	var req CheckoutRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid checkout payload",
		})
	}

	// 1. Idempotency Key validation
	if strings.TrimSpace(req.IdempotencyKey) == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Idempotency key is required",
		})
	}

	// Check if this idempotency key already processed
	var savedStatus int
	var savedBody string
	err := database.Pool.QueryRow(c.Context(), `
		SELECT response_status, response_body 
		FROM idempotency_records 
		WHERE key = $1 AND business_id = $2
	`, req.IdempotencyKey, bizID).Scan(&savedStatus, &savedBody)

	if err == nil {
		// Return saved idempotent response
		c.Set("Content-Type", "application/json")
		c.Set("X-Idempotent-Replay", "true")
		return c.Status(savedStatus).SendString(savedBody)
	}

	if len(req.Items) == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Cart cannot be empty",
		})
	}

	// Validate payment methods
	switch req.Payment.Method {
	case "cash", "transfer", "qris", "debit":
	default:
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Unsupported payment method. Supported: cash, transfer, qris, debit",
		})
	}

	// Begin Atomic Transaction
	tx, err := database.Pool.Begin(c.Context())
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to begin transaction: " + err.Error(),
		})
	}
	defer tx.Rollback(c.Context())

	// Fetch branch details
	var branchName string
	err = tx.QueryRow(c.Context(), "SELECT name FROM branches WHERE id = $1", branchID).Scan(&branchName)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Branch not found",
		})
	}

	// Calculate and Lock products & inventory
	var calculatedSubtotal int64 = 0
	var receiptLines []CheckoutReceiptLine

	for _, item := range req.Items {
		if item.Quantity <= 0 {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "Item quantity must be greater than zero",
			})
		}

		// Fetch authoritative product price & name
		var prod struct {
			Name         string
			SellingPrice int64
			IsActive     bool
		}
		err := tx.QueryRow(c.Context(), `
			SELECT name, selling_price, is_active 
			FROM products 
			WHERE id = $1 AND business_id = $2
		`, item.ProductID, bizID).Scan(&prod.Name, &prod.SellingPrice, &prod.IsActive)

		if err != nil {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
				"error": fmt.Sprintf("Product %s not found in business catalog", item.ProductID),
			})
		}

		if !prod.IsActive {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": fmt.Sprintf("Product %s is not active", prod.Name),
			})
		}

		// Concurrency protection: SELECT FOR UPDATE on branch_inventory
		var inventoryID uuid.UUID
		var currentStock int
		err = tx.QueryRow(c.Context(), `
			SELECT id, stock_quantity 
			FROM branch_inventory 
			WHERE branch_id = $1 AND product_id = $2
			FOR UPDATE
		`, branchID, item.ProductID).Scan(&inventoryID, &currentStock)

		if err != nil {
			if err == pgx.ErrNoRows {
				return c.Status(fiber.StatusConflict).JSON(fiber.Map{
					"error":        fmt.Sprintf("Product '%s' has no stock record in this branch", prod.Name),
					"error_code":   "INSUFFICIENT_STOCK",
					"product_id":   item.ProductID,
					"product_name": prod.Name,
					"available":    0,
					"requested":    item.Quantity,
				})
			}
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "Failed to lock inventory: " + err.Error(),
			})
		}

		if currentStock < item.Quantity {
			return c.Status(fiber.StatusConflict).JSON(fiber.Map{
				"error":        fmt.Sprintf("Insufficient stock for '%s'. Available: %d, Requested: %d", prod.Name, currentStock, item.Quantity),
				"error_code":   "INSUFFICIENT_STOCK",
				"product_id":   item.ProductID,
				"product_name": prod.Name,
				"available":    currentStock,
				"requested":    item.Quantity,
			})
		}

		lineSubtotal := prod.SellingPrice * int64(item.Quantity)
		calculatedSubtotal += lineSubtotal

		// Deduct stock
		newStock := currentStock - item.Quantity
		_, err = tx.Exec(c.Context(), `
			UPDATE branch_inventory 
			SET stock_quantity = $1, updated_at = NOW() 
			WHERE id = $2
		`, newStock, inventoryID)
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "Failed to deduct inventory: " + err.Error(),
			})
		}

		receiptLines = append(receiptLines, CheckoutReceiptLine{
			ProductID:   item.ProductID,
			ProductName: prod.Name,
			UnitPrice:   prod.SellingPrice,
			Quantity:    item.Quantity,
			Subtotal:    lineSubtotal,
		})
	}

	totalAmount := calculatedSubtotal
	if req.Payment.AmountPaid < totalAmount {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":       fmt.Sprintf("Payment amount (%d) is less than total required (%d)", req.Payment.AmountPaid, totalAmount),
			"total":       totalAmount,
			"amount_paid": req.Payment.AmountPaid,
		})
	}

	changeDue := req.Payment.AmountPaid - totalAmount

	// Generate safe sequential receipt number: e.g. RCP-YYYYMMDD-XXXX
	datePrefix := time.Now().Format("20060102")
	var seqCount int
	err = tx.QueryRow(c.Context(), `
		SELECT COUNT(*) FROM sales 
		WHERE business_id = $1 AND receipt_number LIKE $2
	`, bizID, "RCP-"+datePrefix+"-%").Scan(&seqCount)
	if err != nil {
		seqCount = 0
	}
	receiptNumber := fmt.Sprintf("RCP-%s-%04d", datePrefix, seqCount+1)

	// Insert Sale Record
	saleID := uuid.New()
	_, err = tx.Exec(c.Context(), `
		INSERT INTO sales (
			id, business_id, branch_id, user_id, receipt_number,
			subtotal, discount_amount, tax_amount, total_amount, status, notes
		) VALUES ($1, $2, $3, $4, $5, $6, 0, 0, $7, 'completed', $8)
	`, saleID, bizID, branchID, userID, receiptNumber, calculatedSubtotal, totalAmount, req.Notes)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to record sale: " + err.Error(),
		})
	}

	// Insert Sale Lines & Auditable Inventory Movements
	for _, line := range receiptLines {
		lineID := uuid.New()
		_, err = tx.Exec(c.Context(), `
			INSERT INTO sale_lines (
				id, sale_id, product_id, product_name, unit_price, quantity, subtotal
			) VALUES ($1, $2, $3, $4, $5, $6, $7)
		`, lineID, saleID, line.ProductID, line.ProductName, line.UnitPrice, line.Quantity, line.Subtotal)
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "Failed to record sale line: " + err.Error(),
			})
		}

		// Insert inventory movement
		var currentBalance int
		_ = tx.QueryRow(c.Context(), "SELECT stock_quantity FROM branch_inventory WHERE branch_id = $1 AND product_id = $2", branchID, line.ProductID).Scan(&currentBalance)

		_, err = tx.Exec(c.Context(), `
			INSERT INTO inventory_movements (
				business_id, branch_id, product_id, movement_type, quantity, balance_after, reference_id, notes, user_id
			) VALUES ($1, $2, $3, 'sale', $4, $5, $6, $7, $8)
		`, bizID, branchID, line.ProductID, -line.Quantity, currentBalance, receiptNumber, "Penjualan Kasir "+receiptNumber, userID)
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "Failed to record inventory movement: " + err.Error(),
			})
		}
	}

	// Insert Payment Record
	paymentID := uuid.New()
	_, err = tx.Exec(c.Context(), `
		INSERT INTO payments (
			id, sale_id, payment_method, amount_paid, change_due
		) VALUES ($1, $2, $3, $4, $5)
	`, paymentID, saleID, req.Payment.Method, req.Payment.AmountPaid, changeDue)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to record payment: " + err.Error(),
		})
	}

	// Build response object
	resp := CheckoutResponse{
		SaleID:        saleID,
		ReceiptNumber: receiptNumber,
		BranchName:    branchName,
		CashierName:   cashierName,
		CreatedAt:     time.Now(),
		Subtotal:      calculatedSubtotal,
		Discount:      0,
		Tax:           0,
		Total:         totalAmount,
		PaymentMethod: req.Payment.Method,
		AmountPaid:    req.Payment.AmountPaid,
		ChangeDue:     changeDue,
		Lines:         receiptLines,
	}

	respJSON, _ := json.Marshal(resp)

	// Save into idempotency_records within the same transaction!
	_, err = tx.Exec(c.Context(), `
		INSERT INTO idempotency_records (
			key, business_id, endpoint, request_hash, response_status, response_body
		) VALUES ($1, $2, '/api/v1/checkout', '', 200, $3)
	`, req.IdempotencyKey, bizID, string(respJSON))
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to save idempotency record: " + err.Error(),
		})
	}

	// Commit Transaction
	if err := tx.Commit(c.Context()); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to commit checkout transaction: " + err.Error(),
		})
	}

	database.LogAudit(c.Context(), bizID, &userID, "checkout.sale", "sale", saleID.String(), map[string]interface{}{
		"receipt_number": receiptNumber,
		"total_amount":   totalAmount,
		"payment_method": req.Payment.Method,
		"branch_name":    branchName,
		"items_count":    len(receiptLines),
	}, c.IP(), c.Get("User-Agent"))

	return c.JSON(resp)
}
