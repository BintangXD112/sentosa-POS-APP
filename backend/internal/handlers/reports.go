package handlers

import (
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"pos-backend/internal/database"
)

type DailySummaryResponse struct {
	TotalSales      int64 `json:"total_sales"`
	TotalOrders     int   `json:"total_orders"`
	CashSales       int64 `json:"cash_sales"`
	NonCashSales    int64 `json:"non_cash_sales"`
	ItemsSold       int   `json:"items_sold"`
	AverageOrderVal int64 `json:"average_order_value"`
}

type TopProductItem struct {
	ProductID   uuid.UUID `json:"product_id"`
	ProductName string    `json:"product_name"`
	TotalQty    int       `json:"total_qty"`
	TotalSales  int64     `json:"total_sales"`
}

type CashierPerformance struct {
	CashierName string `json:"cashier_name"`
	TotalOrders int    `json:"total_orders"`
	TotalSales  int64  `json:"total_sales"`
}

func GetReportsSummary(c *fiber.Ctx) error {
	branchID := c.Locals("branch_id").(uuid.UUID)
	bizID := c.Locals("business_id").(uuid.UUID)

	startDateStr := c.Query("start_date", "")
	endDateStr := c.Query("end_date", "")

	now := time.Now()
	var startTime, endTime time.Time

	if startDateStr != "" {
		parsedStart, err := time.Parse("2006-01-02", startDateStr)
		if err == nil {
			startTime = parsedStart
		} else {
			startTime = time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
		}
	} else {
		startTime = time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	}

	if endDateStr != "" {
		parsedEnd, err := time.Parse("2006-01-02", endDateStr)
		if err == nil {
			endTime = parsedEnd.Add(24 * time.Hour)
		} else {
			endTime = startTime.Add(24 * time.Hour)
		}
	} else {
		endTime = startTime.Add(24 * time.Hour)
	}

	var summary DailySummaryResponse

	// Sales aggregates
	err := database.Pool.QueryRow(c.Context(), `
		SELECT 
			COALESCE(SUM(total_amount), 0),
			COUNT(id)
		FROM sales
		WHERE business_id = $1 AND branch_id = $2 
		  AND status = 'completed'
		  AND created_at >= $3 AND created_at < $4
	`, bizID, branchID, startTime, endTime).Scan(&summary.TotalSales, &summary.TotalOrders)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to aggregate sales summary"})
	}

	if summary.TotalOrders > 0 {
		summary.AverageOrderVal = summary.TotalSales / int64(summary.TotalOrders)
	}

	// Items sold
	_ = database.Pool.QueryRow(c.Context(), `
		SELECT COALESCE(SUM(sl.quantity), 0)
		FROM sale_lines sl
		JOIN sales s ON sl.sale_id = s.id
		WHERE s.business_id = $1 AND s.branch_id = $2
		  AND s.status = 'completed'
		  AND s.created_at >= $3 AND s.created_at < $4
	`, bizID, branchID, startTime, endTime).Scan(&summary.ItemsSold)

	// Payment Breakdown (Cash vs Non-Cash)
	_ = database.Pool.QueryRow(c.Context(), `
		SELECT 
			COALESCE(SUM(CASE WHEN p.payment_method = 'cash' THEN s.total_amount ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN p.payment_method != 'cash' THEN s.total_amount ELSE 0 END), 0)
		FROM sales s
		JOIN LATERAL (SELECT payment_method FROM payments WHERE sale_id = s.id LIMIT 1) p ON true
		WHERE s.business_id = $1 AND s.branch_id = $2
		  AND s.status = 'completed'
		  AND s.created_at >= $3 AND s.created_at < $4
	`, bizID, branchID, startTime, endTime).Scan(&summary.CashSales, &summary.NonCashSales)

	// Top Selling Products
	topRows, err := database.Pool.Query(c.Context(), `
		SELECT 
			sl.product_id, sl.product_name,
			SUM(sl.quantity) as total_qty,
			SUM(sl.subtotal) as total_sales
		FROM sale_lines sl
		JOIN sales s ON sl.sale_id = s.id
		WHERE s.business_id = $1 AND s.branch_id = $2
		  AND s.status = 'completed'
		  AND s.created_at >= $3 AND s.created_at < $4
		GROUP BY sl.product_id, sl.product_name
		ORDER BY total_qty DESC
		LIMIT 5
	`, bizID, branchID, startTime, endTime)

	var topProducts []TopProductItem
	if err == nil {
		defer topRows.Close()
		for topRows.Next() {
			var tp TopProductItem
			if err := topRows.Scan(&tp.ProductID, &tp.ProductName, &tp.TotalQty, &tp.TotalSales); err == nil {
				topProducts = append(topProducts, tp)
			}
		}
	}
	if topProducts == nil {
		topProducts = []TopProductItem{}
	}

	// Cashier performance
	cashierRows, err := database.Pool.Query(c.Context(), `
		SELECT 
			COALESCE(u.full_name, 'Kasir') as cashier_name,
			COUNT(s.id) as total_orders,
			SUM(s.total_amount) as total_sales
		FROM sales s
		LEFT JOIN users u ON s.user_id = u.id
		WHERE s.business_id = $1 AND s.branch_id = $2
		  AND s.status = 'completed'
		  AND s.created_at >= $3 AND s.created_at < $4
		GROUP BY u.full_name
		ORDER BY total_sales DESC
	`, bizID, branchID, startTime, endTime)

	var cashierStats []CashierPerformance
	if err == nil {
		defer cashierRows.Close()
		for cashierRows.Next() {
			var cp CashierPerformance
			if err := cashierRows.Scan(&cp.CashierName, &cp.TotalOrders, &cp.TotalSales); err == nil {
				cashierStats = append(cashierStats, cp)
			}
		}
	}
	if cashierStats == nil {
		cashierStats = []CashierPerformance{}
	}

	return c.JSON(fiber.Map{
		"start_date":          startTime.Format("2006-01-02"),
		"end_date":            endTime.Add(-time.Second).Format("2006-01-02"),
		"summary":             summary,
		"top_products":        topProducts,
		"cashier_performance": cashierStats,
	})
}
