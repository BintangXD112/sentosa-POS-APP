package middleware

import (
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"pos-backend/internal/auth"
	"pos-backend/internal/database"
)

func AuthRequired() fiber.Handler {
	return func(c *fiber.Ctx) error {
		authHeader := c.Get("Authorization")
		if authHeader == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "Missing Authorization header",
			})
		}

		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "Invalid Authorization header format. Expected Bearer <token>",
			})
		}

		claims, err := auth.ParseToken(parts[1])
		if err != nil {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "Invalid or expired token",
			})
		}

		c.Locals("user_id", claims.UserID)
		c.Locals("business_id", claims.BusinessID)
		c.Locals("role", claims.Role)
		c.Locals("username", claims.Username)
		c.Locals("full_name", claims.FullName)

		return c.Next()
	}
}

func RequireRoles(allowedRoles ...string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		userRole, ok := c.Locals("role").(string)
		if !ok {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
				"error": "Role not found in context",
			})
		}

		for _, r := range allowedRoles {
			if r == userRole {
				return c.Next()
			}
		}

		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"error": "Access denied: insufficient permissions",
		})
	}
}

func ValidateBranchAccess() fiber.Handler {
	return func(c *fiber.Ctx) error {
		branchIDStr := c.Get("X-Branch-ID")
		if branchIDStr == "" {
			branchIDStr = c.Query("branch_id")
		}

		if branchIDStr == "" {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "Branch context required (via X-Branch-ID header or branch_id query parameter)",
			})
		}

		branchID, err := uuid.Parse(branchIDStr)
		if err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "Invalid branch ID format",
			})
		}

		role := c.Locals("role").(string)
		bizID := c.Locals("business_id").(uuid.UUID)
		userID := c.Locals("user_id").(uuid.UUID)

		// Verify branch belongs to the business
		var branchBizID uuid.UUID
		err = database.Pool.QueryRow(c.Context(), "SELECT business_id FROM branches WHERE id = $1 AND is_active = true", branchID).Scan(&branchBizID)
		if err != nil || branchBizID != bizID {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
				"error": "Branch does not exist or does not belong to your business",
			})
		}

		// If not owner, verify assignment
		if role != "owner" {
			var assignedCount int
			err = database.Pool.QueryRow(c.Context(), `
				SELECT COUNT(*) FROM user_branch_assignments 
				WHERE user_id = $1 AND branch_id = $2
			`, userID, branchID).Scan(&assignedCount)

			if err != nil || assignedCount == 0 {
				return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
					"error": "You are not assigned to this branch",
				})
			}
		}

		c.Locals("branch_id", branchID)
		return c.Next()
	}
}
