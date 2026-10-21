package handlers

import (
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"pos-backend/internal/database"
)

type AuditLogItem struct {
	ID         uuid.UUID              `json:"id"`
	Action     string                 `json:"action"`
	EntityType string                 `json:"entity_type"`
	EntityID   string                 `json:"entity_id"`
	Details    map[string]interface{} `json:"details"`
	IPAddress  string                 `json:"ip_address"`
	UserAgent  string                 `json:"user_agent"`
	CreatedAt  time.Time              `json:"created_at"`
	ActorID    *uuid.UUID             `json:"actor_id"`
	ActorName  string                 `json:"actor_name"`
	ActorUser  string                 `json:"actor_username"`
	ActorRole  string                 `json:"actor_role"`
}

type AuditLogStats struct {
	TotalToday     int `json:"total_today"`
	Auth2FACount   int `json:"auth_2fa_count"`
	SalesCount     int `json:"sales_count"`
	InventoryCount int `json:"inventory_count"`
}

// GetAuditLogs — GET /api/v1/audit-logs (Owner only)
func GetAuditLogs(c *fiber.Ctx) error {
	bizID := c.Locals("business_id").(uuid.UUID)

	category := strings.ToLower(c.Query("category", "all"))
	search := strings.TrimSpace(c.Query("q", ""))
	page, _ := strconv.Atoi(c.Query("page", "1"))
	limit, _ := strconv.Atoi(c.Query("limit", "50"))

	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 50
	}
	offset := (page - 1) * limit

	sqlQuery := `
		SELECT 
			al.id, al.action, al.entity_type, COALESCE(al.entity_id, ''),
			COALESCE(al.details::text, '{}'),
			COALESCE(al.ip_address, ''), COALESCE(al.user_agent, ''),
			al.created_at,
			u.id, COALESCE(u.full_name, 'Sistem'), COALESCE(u.username, 'system'), COALESCE(u.role, 'system')
		FROM audit_logs al
		LEFT JOIN users u ON al.user_id = u.id
		WHERE al.business_id = $1
	`
	args := []interface{}{bizID}
	argIdx := 2

	// Category filter
	if category != "" && category != "all" {
		switch category {
		case "auth":
			sqlQuery += fmt.Sprintf(" AND al.action LIKE 'auth.%%'")
		case "sales":
			sqlQuery += fmt.Sprintf(" AND (al.action LIKE 'sale%%' OR al.action LIKE 'checkout%%')")
		case "inventory":
			sqlQuery += fmt.Sprintf(" AND (al.action LIKE 'inventory%%' OR al.action LIKE 'supplier%%')")
		case "users":
			sqlQuery += fmt.Sprintf(" AND al.action LIKE 'users.%%'")
		case "settings":
			sqlQuery += fmt.Sprintf(" AND (al.action LIKE 'business%%' OR al.action LIKE 'branch%%')")
		}
	}

	// Search keyword
	if search != "" {
		sqlQuery += fmt.Sprintf(` AND (
			al.action ILIKE $%d 
			OR al.entity_type ILIKE $%d 
			OR al.entity_id ILIKE $%d 
			OR al.ip_address ILIKE $%d 
			OR u.full_name ILIKE $%d 
			OR u.username ILIKE $%d
			OR al.details::text ILIKE $%d
		)`, argIdx, argIdx, argIdx, argIdx, argIdx, argIdx, argIdx)
		args = append(args, "%"+search+"%")
		argIdx++
	}

	sqlQuery += fmt.Sprintf(" ORDER BY al.created_at DESC LIMIT $%d OFFSET $%d", argIdx, argIdx+1)
	args = append(args, limit, offset)

	rows, err := database.Pool.Query(c.Context(), sqlQuery, args...)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Gagal mengambil log audit: " + err.Error()})
	}
	defer rows.Close()

	var logs []AuditLogItem
	for rows.Next() {
		var item AuditLogItem
		var rawDetails string
		var actorID *uuid.UUID

		err := rows.Scan(
			&item.ID, &item.Action, &item.EntityType, &item.EntityID,
			&rawDetails, &item.IPAddress, &item.UserAgent, &item.CreatedAt,
			&actorID, &item.ActorName, &item.ActorUser, &item.ActorRole,
		)
		if err == nil {
			item.ActorID = actorID
			item.Details = make(map[string]interface{})
			_ = json.Unmarshal([]byte(rawDetails), &item.Details)
			logs = append(logs, item)
		}
	}

	if logs == nil {
		logs = []AuditLogItem{}
	}

	// Fetch quick stats
	var stats AuditLogStats
	_ = database.Pool.QueryRow(c.Context(), `
		SELECT 
			COUNT(CASE WHEN created_at >= CURRENT_DATE THEN 1 END) as total_today,
			COUNT(CASE WHEN action LIKE 'auth.%' THEN 1 END) as auth_count,
			COUNT(CASE WHEN action LIKE 'sale%' OR action LIKE 'checkout%' THEN 1 END) as sales_count,
			COUNT(CASE WHEN action LIKE 'inventory%' OR action LIKE 'supplier%' THEN 1 END) as inv_count
		FROM audit_logs
		WHERE business_id = $1
	`, bizID).Scan(&stats.TotalToday, &stats.Auth2FACount, &stats.SalesCount, &stats.InventoryCount)

	return c.JSON(fiber.Map{
		"page":  page,
		"limit": limit,
		"stats": stats,
		"logs":  logs,
	})
}
