package handlers

import (
	"fmt"
	"strconv"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"pos-backend/internal/database"
)

type SaleSummary struct {
	ID            uuid.UUID `json:"id"`
	ReceiptNumber string    `json:"receipt_number"`
	BranchName    string    `json:"branch_name"`
	CashierName   string    `json:"cashier_name"`
	TotalAmount   int64     `json:"total_amount"`
	PaymentMethod string    `json:"payment_method"`
	Status        string    `json:"status"`
	CreatedAt     time.Time `json:"created_at"`
}

type SaleDetailResponse struct {
	ID            uuid.UUID             `json:"id"`
	ReceiptNumber string                `json:"receipt_number"`
	BranchName    string                `json:"branch_name"`
	CashierName   string                `json:"cashier_name"`
	Subtotal      int64                 `json:"subtotal"`
	Discount      int64                 `json:"discount_amount"`
	Tax           int64                 `json:"tax_amount"`
	TotalAmount   int64                 `json:"total_amount"`
	PaymentMethod string                `json:"payment_method"`
	AmountPaid    int64                 `json:"amount_paid"`
	ChangeDue     int64                 `json:"change_due"`
	Status        string                `json:"status"`
	Notes         string                `json:"notes"`
	CreatedAt     time.Time             `json:"created_at"`
	Lines         []CheckoutReceiptLine `json:"lines"`
}

func GetSales(c *fiber.Ctx) error {
	bizID := c.Locals("business_id").(uuid.UUID)
	branchID := c.Locals("branch_id").(uuid.UUID)

	page, _ := strconv.Atoi(c.Query("page", "1"))
	limit, _ := strconv.Atoi(c.Query("limit", "20"))
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}
	offset := (page - 1) * limit

	query := `
		SELECT 
			s.id, s.receipt_number, b.name as branch_name, 
			COALESCE(u.full_name, 'Kasir') as cashier_name,
			s.total_amount, COALESCE(p.payment_method, 'cash') as payment_method,
			s.status, s.created_at
		FROM sales s
		JOIN branches b ON s.branch_id = b.id
		LEFT JOIN users u ON s.user_id = u.id
		LEFT JOIN LATERAL (
			SELECT payment_method FROM payments WHERE sale_id = s.id LIMIT 1
		) p ON true
		WHERE s.business_id = $1 AND s.branch_id = $2
		ORDER BY s.created_at DESC
		LIMIT $3 OFFSET $4
	`

	rows, err := database.Pool.Query(c.Context(), query, bizID, branchID, limit, offset)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to fetch sales: " + err.Error()})
	}
	defer rows.Close()

	var sales []SaleSummary
	for rows.Next() {
		var s SaleSummary
		err := rows.Scan(
			&s.ID, &s.ReceiptNumber, &s.BranchName, &s.CashierName,
			&s.TotalAmount, &s.PaymentMethod, &s.Status, &s.CreatedAt,
		)
		if err == nil {
			sales = append(sales, s)
		}
	}

	if sales == nil {
		sales = []SaleSummary{}
	}

	return c.JSON(fiber.Map{
		"page":  page,
		"limit": limit,
		"sales": sales,
	})
}

func GetSaleByID(c *fiber.Ctx) error {
	bizID := c.Locals("business_id").(uuid.UUID)
	saleIDStr := c.Params("id")

	saleID, err := uuid.Parse(saleIDStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid sale ID format"})
	}

	var detail SaleDetailResponse
	var notes *string

	err = database.Pool.QueryRow(c.Context(), `
		SELECT 
			s.id, s.receipt_number, b.name as branch_name,
			COALESCE(u.full_name, 'Kasir') as cashier_name,
			s.subtotal, s.discount_amount, s.tax_amount, s.total_amount,
			COALESCE(p.payment_method, 'cash'), COALESCE(p.amount_paid, s.total_amount), COALESCE(p.change_due, 0),
			s.status, s.notes, s.created_at
		FROM sales s
		JOIN branches b ON s.branch_id = b.id
		LEFT JOIN users u ON s.user_id = u.id
		LEFT JOIN LATERAL (
			SELECT payment_method, amount_paid, change_due FROM payments WHERE sale_id = s.id LIMIT 1
		) p ON true
		WHERE s.id = $1 AND s.business_id = $2
	`, saleID, bizID).Scan(
		&detail.ID, &detail.ReceiptNumber, &detail.BranchName,
		&detail.CashierName, &detail.Subtotal, &detail.Discount, &detail.Tax, &detail.TotalAmount,
		&detail.PaymentMethod, &detail.AmountPaid, &detail.ChangeDue,
		&detail.Status, &notes, &detail.CreatedAt,
	)

	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Sale not found"})
	}

	if notes != nil {
		detail.Notes = *notes
	}

	// Fetch lines
	lineRows, err := database.Pool.Query(c.Context(), `
		SELECT product_id, product_name, unit_price, quantity, subtotal
		FROM sale_lines
		WHERE sale_id = $1
		ORDER BY id ASC
	`, saleID)
	if err == nil {
		defer lineRows.Close()
		for lineRows.Next() {
			var line CheckoutReceiptLine
			if err := lineRows.Scan(&line.ProductID, &line.ProductName, &line.UnitPrice, &line.Quantity, &line.Subtotal); err == nil {
				detail.Lines = append(detail.Lines, line)
			}
		}
	}

	if detail.Lines == nil {
		detail.Lines = []CheckoutReceiptLine{}
	}

	return c.JSON(detail)
}

func VoidSale(c *fiber.Ctx) error {
	bizID := c.Locals("business_id").(uuid.UUID)
	userID := c.Locals("user_id").(uuid.UUID)
	saleIDStr := c.Params("id")

	saleID, err := uuid.Parse(saleIDStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid sale ID"})
	}

	tx, err := database.Pool.Begin(c.Context())
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to begin transaction"})
	}
	defer tx.Rollback(c.Context())

	var branchID uuid.UUID
	var status string
	var receiptNumber string
	err = tx.QueryRow(c.Context(), `
		SELECT branch_id, status, receipt_number 
		FROM sales 
		WHERE id = $1 AND business_id = $2 
		FOR UPDATE
	`, saleID, bizID).Scan(&branchID, &status, &receiptNumber)

	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Sale not found"})
	}

	if status == "voided" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Sale is already voided"})
	}

	// Mark sale as voided
	_, err = tx.Exec(c.Context(), "UPDATE sales SET status = 'voided' WHERE id = $1", saleID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to void sale"})
	}

	// Restore inventory
	lines, err := tx.Query(c.Context(), "SELECT product_id, quantity FROM sale_lines WHERE sale_id = $1", saleID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to load sale lines"})
	}
	defer lines.Close()

	type LineRestock struct {
		ProductID uuid.UUID
		Quantity  int
	}
	var restockList []LineRestock
	for lines.Next() {
		var l LineRestock
		if err := lines.Scan(&l.ProductID, &l.Quantity); err == nil {
			restockList = append(restockList, l)
		}
	}
	lines.Close()

	for _, item := range restockList {
		var currentStock int
		_ = tx.QueryRow(c.Context(), "SELECT stock_quantity FROM branch_inventory WHERE branch_id = $1 AND product_id = $2 FOR UPDATE", branchID, item.ProductID).Scan(&currentStock)

		newStock := currentStock + item.Quantity
		_, _ = tx.Exec(c.Context(), "UPDATE branch_inventory SET stock_quantity = $1, updated_at = NOW() WHERE branch_id = $2 AND product_id = $3", newStock, branchID, item.ProductID)

		// Auditable movement
		_, _ = tx.Exec(c.Context(), `
			INSERT INTO inventory_movements (
				business_id, branch_id, product_id, movement_type, quantity, balance_after, reference_id, notes, user_id
			) VALUES ($1, $2, $3, 'adjustment', $4, $5, $6, $7, $8)
		`, bizID, branchID, item.ProductID, item.Quantity, newStock, receiptNumber, "Pembatalan Transaksi "+receiptNumber, userID)
	}

	// Audit log
	_, _ = tx.Exec(c.Context(), `
		INSERT INTO audit_logs (business_id, user_id, action, entity_type, entity_id, details)
		VALUES ($1, $2, 'VOID_SALE', 'sales', $3, $4)
	`, bizID, userID, saleID.String(), fmt.Sprintf(`{"receipt_number":"%s"}`, receiptNumber))

	if err := tx.Commit(c.Context()); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to commit void"})
	}

	return c.JSON(fiber.Map{
		"message":        "Sale successfully voided and inventory restored",
		"sale_id":        saleID,
		"receipt_number": receiptNumber,
	})
}
