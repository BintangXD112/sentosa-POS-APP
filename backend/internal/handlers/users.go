package handlers

import (
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	"pos-backend/internal/database"
)

type UserListItem struct {
	ID        uuid.UUID        `json:"id"`
	Username  string           `json:"username"`
	Email     string           `json:"email"`
	FullName  string           `json:"full_name"`
	Role      string           `json:"role"`
	IsActive  bool             `json:"is_active"`
	CreatedAt time.Time        `json:"created_at"`
	Branches  []BranchResponse `json:"branches"`
}

type CreateUserRequest struct {
	Username  string      `json:"username"`
	Password  string      `json:"password"`
	FullName  string      `json:"full_name"`
	Email     string      `json:"email"`
	Role      string      `json:"role"`
	BranchIDs []uuid.UUID `json:"branch_ids"`
}

type UpdateUserRequest struct {
	FullName  string      `json:"full_name"`
	Email     string      `json:"email"`
	Role      string      `json:"role"`
	Password  string      `json:"password,omitempty"`
	IsActive  *bool       `json:"is_active,omitempty"`
	BranchIDs []uuid.UUID `json:"branch_ids"`
}

// GetUsers — List all users in the business (Owner only)
func GetUsers(c *fiber.Ctx) error {
	bizID := c.Locals("business_id").(uuid.UUID)

	query := `
		SELECT id, username, COALESCE(email, ''), full_name, role, is_active, created_at
		FROM users
		WHERE business_id = $1
		ORDER BY created_at ASC
	`
	rows, err := database.Pool.Query(c.Context(), query, bizID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Gagal mengambil daftar pengguna"})
	}
	defer rows.Close()

	var users []UserListItem
	userMap := make(map[uuid.UUID]int)

	for rows.Next() {
		var u UserListItem
		if err := rows.Scan(&u.ID, &u.Username, &u.Email, &u.FullName, &u.Role, &u.IsActive, &u.CreatedAt); err == nil {
			u.Branches = []BranchResponse{}
			userMap[u.ID] = len(users)
			users = append(users, u)
		}
	}

	if len(users) == 0 {
		return c.JSON(fiber.Map{"users": []UserListItem{}})
	}

	// Fetch all branch assignments for these users
	bRows, err := database.Pool.Query(c.Context(), `
		SELECT uba.user_id, b.id, b.name, COALESCE(b.address, ''), COALESCE(b.phone, ''), b.is_active
		FROM user_branch_assignments uba
		JOIN branches b ON uba.branch_id = b.id
		JOIN users u ON uba.user_id = u.id
		WHERE u.business_id = $1
	`, bizID)
	if err == nil {
		defer bRows.Close()
		for bRows.Next() {
			var uID uuid.UUID
			var b BranchResponse
			if err := bRows.Scan(&uID, &b.ID, &b.Name, &b.Address, &b.Phone, &b.IsActive); err == nil {
				if idx, ok := userMap[uID]; ok {
					users[idx].Branches = append(users[idx].Branches, b)
				}
			}
		}
	}

	return c.JSON(fiber.Map{"users": users})
}

// CreateUser — Add a new user to the business (Owner only)
func CreateUser(c *fiber.Ctx) error {
	bizID := c.Locals("business_id").(uuid.UUID)

	var req CreateUserRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Data payload tidak valid"})
	}

	req.Username = strings.ToLower(strings.TrimSpace(req.Username))
	req.FullName = strings.TrimSpace(req.FullName)
	req.Email = strings.TrimSpace(req.Email)
	req.Role = strings.TrimSpace(req.Role)

	if req.Username == "" || req.Password == "" || req.FullName == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Username, password, dan nama lengkap wajib diisi"})
	}

	if len(req.Password) < 6 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Password minimal 6 karakter"})
	}

	validRoles := map[string]bool{
		"owner":           true,
		"branch_manager":  true,
		"cashier":         true,
		"inventory_staff": true,
	}
	if !validRoles[req.Role] {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Role tidak valid"})
	}

	// Check if username already exists in this business
	var exists bool
	err := database.Pool.QueryRow(c.Context(), `
		SELECT EXISTS(SELECT 1 FROM users WHERE business_id = $1 AND username = $2)
	`, bizID, req.Username).Scan(&exists)
	if err == nil && exists {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Username sudah digunakan"})
	}

	// Hash password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Gagal mengenkripsi password"})
	}

	tx, err := database.Pool.Begin(c.Context())
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Gagal memulai transaksi"})
	}
	defer tx.Rollback(c.Context())

	newUserID := uuid.New()
	_, err = tx.Exec(c.Context(), `
		INSERT INTO users (id, business_id, username, email, password_hash, full_name, role, is_active, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, true, NOW(), NOW())
	`, newUserID, bizID, req.Username, req.Email, string(hashedPassword), req.FullName, req.Role)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Gagal menambahkan pengguna: " + err.Error()})
	}

	// Assign branches
	for _, branchID := range req.BranchIDs {
		_, err = tx.Exec(c.Context(), `
			INSERT INTO user_branch_assignments (id, user_id, branch_id)
			VALUES (gen_random_uuid(), $1, $2)
			ON CONFLICT DO NOTHING
		`, newUserID, branchID)
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Gagal menetapkan cabang ke pengguna"})
		}
	}

	if err := tx.Commit(c.Context()); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Gagal menyimpan pengguna"})
	}

	database.LogAudit(c.Context(), bizID, &newUserID, "users.create", "user", newUserID.String(), map[string]interface{}{
		"username": req.Username,
		"role":     req.Role,
		"email":    req.Email,
	}, c.IP(), c.Get("User-Agent"))

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"message": "Pengguna berhasil ditambahkan",
		"user": fiber.Map{
			"id":        newUserID,
			"username":  req.Username,
			"full_name": req.FullName,
			"email":     req.Email,
			"role":      req.Role,
			"is_active": true,
		},
	})
}

// UpdateUser — Edit existing user (Owner only)
func UpdateUser(c *fiber.Ctx) error {
	bizID := c.Locals("business_id").(uuid.UUID)
	targetID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "ID pengguna tidak valid"})
	}

	var req UpdateUserRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Data payload tidak valid"})
	}

	req.FullName = strings.TrimSpace(req.FullName)
	req.Email = strings.TrimSpace(req.Email)
	req.Role = strings.TrimSpace(req.Role)

	if req.FullName == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Nama lengkap tidak boleh kosong"})
	}

	validRoles := map[string]bool{
		"owner":           true,
		"branch_manager":  true,
		"cashier":         true,
		"inventory_staff": true,
	}
	if req.Role != "" && !validRoles[req.Role] {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Role tidak valid"})
	}

	tx, err := database.Pool.Begin(c.Context())
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Gagal memulai transaksi"})
	}
	defer tx.Rollback(c.Context())

	// Update user base fields
	isActive := true
	if req.IsActive != nil {
		isActive = *req.IsActive
	}

	if req.Password != "" {
		if len(req.Password) < 6 {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Password baru minimal 6 karakter"})
		}
		hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Gagal mengenkripsi password"})
		}
		_, err = tx.Exec(c.Context(), `
			UPDATE users
			SET full_name = $1, email = $2, role = $3, password_hash = $4, is_active = $5, updated_at = NOW()
			WHERE id = $6 AND business_id = $7
		`, req.FullName, req.Email, req.Role, string(hashedPassword), isActive, targetID, bizID)
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Gagal memperbarui pengguna: " + err.Error()})
		}
	} else {
		_, err = tx.Exec(c.Context(), `
			UPDATE users
			SET full_name = $1, email = $2, role = $3, is_active = $4, updated_at = NOW()
			WHERE id = $5 AND business_id = $6
		`, req.FullName, req.Email, req.Role, isActive, targetID, bizID)
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Gagal memperbarui pengguna: " + err.Error()})
		}
	}

	// Re-assign branches if provided
	if req.BranchIDs != nil {
		_, _ = tx.Exec(c.Context(), `DELETE FROM user_branch_assignments WHERE user_id = $1`, targetID)
		for _, branchID := range req.BranchIDs {
			_, err = tx.Exec(c.Context(), `
				INSERT INTO user_branch_assignments (id, user_id, branch_id)
				VALUES (gen_random_uuid(), $1, $2)
				ON CONFLICT DO NOTHING
			`, targetID, branchID)
			if err != nil {
				return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Gagal memperbarui penugasan cabang"})
			}
		}
	}

	if err := tx.Commit(c.Context()); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Gagal menyimpan perubahan"})
	}

	database.LogAudit(c.Context(), bizID, &targetID, "users.update", "user", targetID.String(), map[string]interface{}{
		"role":      req.Role,
		"full_name": req.FullName,
		"is_active": isActive,
	}, c.IP(), c.Get("User-Agent"))

	return c.JSON(fiber.Map{
		"message": "Data pengguna berhasil diperbarui",
	})
}

// DeleteUser — Delete or deactivate user (Owner only)
func DeleteUser(c *fiber.Ctx) error {
	bizID := c.Locals("business_id").(uuid.UUID)
	currentUserID := c.Locals("user_id").(uuid.UUID)
	targetID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "ID pengguna tidak valid"})
	}

	if targetID == currentUserID {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Anda tidak dapat menghapus akun Anda sendiri"})
	}

	// Verify target user belongs to business
	var targetRole string
	err = database.Pool.QueryRow(c.Context(), `
		SELECT role FROM users WHERE id = $1 AND business_id = $2
	`, targetID, bizID).Scan(&targetRole)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Pengguna tidak ditemukan"})
	}

	// Check if user has associated transactions or inventory movements
	var hasSales bool
	_ = database.Pool.QueryRow(c.Context(), `SELECT EXISTS(SELECT 1 FROM sales WHERE user_id = $1)`, targetID).Scan(&hasSales)

	var hasMovements bool
	_ = database.Pool.QueryRow(c.Context(), `SELECT EXISTS(SELECT 1 FROM inventory_movements WHERE user_id = $1)`, targetID).Scan(&hasMovements)

	if hasSales || hasMovements {
		// Soft delete to protect relational integrity and audit trails
		_, err = database.Pool.Exec(c.Context(), `
			UPDATE users SET is_active = false, updated_at = NOW() WHERE id = $1 AND business_id = $2
		`, targetID, bizID)
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Gagal menonaktifkan pengguna"})
		}

		database.LogAudit(c.Context(), bizID, &targetID, "users.deactivate", "user", targetID.String(), map[string]interface{}{
			"role":   targetRole,
			"reason": "Memiliki riwayat transaksi",
		}, c.IP(), c.Get("User-Agent"))

		return c.JSON(fiber.Map{
			"message": "Pengguna memiliki riwayat transaksi/mutasi, status berhasil diubah menjadi Nonaktif",
		})
	}

	// If no transaction records, safe to hard delete
	_, err = database.Pool.Exec(c.Context(), `DELETE FROM users WHERE id = $1 AND business_id = $2`, targetID, bizID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Gagal menghapus pengguna: " + err.Error()})
	}

	database.LogAudit(c.Context(), bizID, &targetID, "users.delete", "user", targetID.String(), map[string]interface{}{
		"role": targetRole,
	}, c.IP(), c.Get("User-Agent"))

	return c.JSON(fiber.Map{"message": "Pengguna berhasil dihapus"})
}
