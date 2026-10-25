package handlers

import (
	"fmt"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	"pos-backend/internal/auth"
	"pos-backend/internal/database"
)

type LoginRequest struct {
	Username    string `json:"username"`
	Password    string `json:"password"`
	DeviceToken string `json:"device_token"`
}

type UserResponse struct {
	ID           uuid.UUID        `json:"id"`
	BusinessID   uuid.UUID        `json:"business_id"`
	BusinessName string           `json:"business_name"`
	Username     string           `json:"username"`
	Email        string           `json:"email"`
	FullName     string           `json:"full_name"`
	Role         string           `json:"role"`
	Branches     []BranchResponse `json:"branches"`
}

type BranchResponse struct {
	ID       uuid.UUID `json:"id"`
	Name     string    `json:"name"`
	Address  string    `json:"address"`
	Phone    string    `json:"phone"`
	IsActive bool      `json:"is_active"`
}

func Login(c *fiber.Ctx) error {
	var req LoginRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request payload"})
	}

	if req.Username == "" || req.Password == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Username and password are required"})
	}

	var user struct {
		ID           uuid.UUID
		BusinessID   uuid.UUID
		BusinessName string
		Username     string
		Email        *string
		PasswordHash string
		FullName     string
		Role         string
		IsActive     bool
	}

	err := database.Pool.QueryRow(c.Context(), `
		SELECT u.id, u.business_id, b.name, u.username, u.email, u.password_hash, u.full_name, u.role, u.is_active
		FROM users u
		JOIN businesses b ON u.business_id = b.id
		WHERE u.username = $1
	`, req.Username).Scan(
		&user.ID, &user.BusinessID, &user.BusinessName, &user.Username, &user.Email,
		&user.PasswordHash, &user.FullName, &user.Role, &user.IsActive,
	)

	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Invalid username or password"})
	}

	if !user.IsActive {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Account is disabled"})
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Invalid username or password"})
	}

	// 2FA: Check if login device is recognized and trusted (< 30 days)
	deviceToken := strings.TrimSpace(req.DeviceToken)
	if deviceToken == "" {
		deviceToken = strings.TrimSpace(c.Get("X-Device-Token"))
	}

	ip := c.IP()
	if xf := c.Get("X-Forwarded-For"); xf != "" {
		ip = strings.TrimSpace(strings.Split(xf, ",")[0])
	}
	userAgent := c.Get("User-Agent")

	var isTrusted bool
	if deviceToken != "" {
		var count int
		err := database.Pool.QueryRow(c.Context(), `
			SELECT COUNT(*) FROM trusted_devices
			WHERE user_id = $1 AND device_token = $2 AND expires_at > NOW()
		`, user.ID, deviceToken).Scan(&count)
		if err == nil && count > 0 {
			isTrusted = true
			_, _ = database.Pool.Exec(c.Context(), `
				UPDATE trusted_devices SET last_used_at = NOW() WHERE user_id = $1 AND device_token = $2
			`, user.ID, deviceToken)
		}
	}

	if !isTrusted {
		// Device is unrecognized or 30-day trust expired: require 2FA OTP verification
		otpCode := Generate6DigitCode()
		codeHash := HashOTP(otpCode)
		challengeToken := uuid.New().String()

		_, err = database.Pool.Exec(c.Context(), `
			INSERT INTO two_factor_challenges (id, user_id, challenge_token, code_hash, ip_address, user_agent, expires_at, created_at)
			VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, NOW() + INTERVAL '10 minutes', NOW())
		`, user.ID, challengeToken, codeHash, ip, userAgent)
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Gagal menginisialisasi verifikasi A2F"})
		}

		emailStr := ""
		if user.Email != nil {
			emailStr = *user.Email
		}

		// Send synchronously so Resend errors reach the UI instead of being lost in a goroutine.
		if emailStr != "" {
			if sendErr := SendTwoFactorEmail(emailStr, user.FullName, otpCode, ip, userAgent); sendErr != nil {
				fmt.Printf("[2FA] gagal mengirim OTP ke %s: %v\\n", emailStr, sendErr)
				return c.Status(fiber.StatusBadGateway).JSON(fiber.Map{
					"error": "OTP gagal dikirim. Pastikan RESEND_FROM_EMAIL menggunakan alamat dari domain Resend yang sudah terverifikasi.",
				})
			}
		} else {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Alamat email akun belum diatur"})
		}

		database.LogAudit(c.Context(), user.BusinessID, &user.ID, "auth.login_2fa_challenge_issued", "user", user.ID.String(), map[string]interface{}{
			"reason":           "Perangkat baru/tidak dikenal terdeteksi",
			"has_device_token": deviceToken != "",
		}, ip, userAgent)

		return c.JSON(fiber.Map{
			"require_2fa":     true,
			"challenge_token": challengeToken,
			"masked_email":    MaskEmail(emailStr),
			"message":         "Perangkat baru terdeteksi. Kode verifikasi 2FA telah dikirim ke email Anda.",
		})
	}

	database.LogAudit(c.Context(), user.BusinessID, &user.ID, "auth.login_trusted", "user", user.ID.String(), map[string]interface{}{
		"device_recognized": true,
	}, ip, userAgent)

	token, err := auth.GenerateToken(user.ID, user.BusinessID, user.Username, user.Role, user.FullName)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create authentication token"})
	}

	// Fetch accessible branches
	var branches []BranchResponse
	if user.Role == "owner" {
		rows, err := database.Pool.Query(c.Context(), `
			SELECT id, name, COALESCE(address, ''), COALESCE(phone, ''), is_active
			FROM branches
			WHERE business_id = $1 AND is_active = true
			ORDER BY name ASC
		`, user.BusinessID)
		if err == nil {
			defer rows.Close()
			for rows.Next() {
				var b BranchResponse
				if err := rows.Scan(&b.ID, &b.Name, &b.Address, &b.Phone, &b.IsActive); err == nil {
					branches = append(branches, b)
				}
			}
		}
	} else {
		rows, err := database.Pool.Query(c.Context(), `
			SELECT b.id, b.name, COALESCE(b.address, ''), COALESCE(b.phone, ''), b.is_active
			FROM branches b
			JOIN user_branch_assignments uba ON b.id = uba.branch_id
			WHERE uba.user_id = $1 AND b.is_active = true
			ORDER BY b.name ASC
		`, user.ID)
		if err == nil {
			defer rows.Close()
			for rows.Next() {
				var b BranchResponse
				if err := rows.Scan(&b.ID, &b.Name, &b.Address, &b.Phone, &b.IsActive); err == nil {
					branches = append(branches, b)
				}
			}
		}
	}

	emailStr := ""
	if user.Email != nil {
		emailStr = *user.Email
	}

	return c.JSON(fiber.Map{
		"token": token,
		"user": UserResponse{
			ID:           user.ID,
			BusinessID:   user.BusinessID,
			BusinessName: user.BusinessName,
			Username:     user.Username,
			Email:        emailStr,
			FullName:     user.FullName,
			Role:         user.Role,
			Branches:     branches,
		},
	})
}

func Me(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(uuid.UUID)
	bizID := c.Locals("business_id").(uuid.UUID)

	var user struct {
		ID           uuid.UUID
		BusinessName string
		Username     string
		Email        *string
		FullName     string
		Role         string
	}

	err := database.Pool.QueryRow(c.Context(), `
		SELECT u.id, b.name, u.username, u.email, u.full_name, u.role
		FROM users u
		JOIN businesses b ON u.business_id = b.id
		WHERE u.id = $1 AND u.business_id = $2 AND u.is_active = true
	`, userID, bizID).Scan(&user.ID, &user.BusinessName, &user.Username, &user.Email, &user.FullName, &user.Role)

	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Sesi tidak valid atau akun telah dinonaktifkan"})
	}

	var branches []BranchResponse
	if user.Role == "owner" {
		rows, err := database.Pool.Query(c.Context(), `
			SELECT id, name, COALESCE(address, ''), COALESCE(phone, ''), is_active
			FROM branches
			WHERE business_id = $1 AND is_active = true
			ORDER BY name ASC
		`, bizID)
		if err == nil {
			defer rows.Close()
			for rows.Next() {
				var b BranchResponse
				if err := rows.Scan(&b.ID, &b.Name, &b.Address, &b.Phone, &b.IsActive); err == nil {
					branches = append(branches, b)
				}
			}
		}
	} else {
		rows, err := database.Pool.Query(c.Context(), `
			SELECT b.id, b.name, COALESCE(b.address, ''), COALESCE(b.phone, ''), b.is_active
			FROM branches b
			JOIN user_branch_assignments uba ON b.id = uba.branch_id
			WHERE uba.user_id = $1 AND b.is_active = true
			ORDER BY b.name ASC
		`, userID)
		if err == nil {
			defer rows.Close()
			for rows.Next() {
				var b BranchResponse
				if err := rows.Scan(&b.ID, &b.Name, &b.Address, &b.Phone, &b.IsActive); err == nil {
					branches = append(branches, b)
				}
			}
		}
	}

	emailStr := ""
	if user.Email != nil {
		emailStr = *user.Email
	}

	return c.JSON(fiber.Map{
		"user": UserResponse{
			ID:           user.ID,
			BusinessID:   bizID,
			BusinessName: user.BusinessName,
			Username:     user.Username,
			Email:        emailStr,
			FullName:     user.FullName,
			Role:         user.Role,
			Branches:     branches,
		},
	})
}

type UpdateProfileRequest struct {
	FullName string `json:"full_name"`
	Username string `json:"username"`
	Email    string `json:"email"`
}

func UpdateProfile(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(uuid.UUID)
	bizID := c.Locals("business_id").(uuid.UUID)
	userRole := c.Locals("role").(string)

	var req UpdateProfileRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Payload tidak valid"})
	}

	req.FullName = strings.TrimSpace(req.FullName)
	req.Username = strings.TrimSpace(req.Username)
	req.Email = strings.TrimSpace(req.Email)

	if req.FullName == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Nama lengkap tidak boleh kosong"})
	}
	if len(req.Username) < 3 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Username minimal 3 karakter"})
	}

	// Check if username taken by another user in the same business
	var count int
	err := database.Pool.QueryRow(c.Context(), `
		SELECT COUNT(*) FROM users
		WHERE business_id = $1 AND LOWER(username) = LOWER($2) AND id != $3
	`, bizID, req.Username, userID).Scan(&count)
	if err == nil && count > 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Username sudah digunakan oleh akun lain"})
	}

	// If email provided, check if email taken by another user in the same business
	if req.Email != "" {
		var emailCount int
		err := database.Pool.QueryRow(c.Context(), `
			SELECT COUNT(*) FROM users
			WHERE business_id = $1 AND LOWER(email) = LOWER($2) AND id != $3
		`, bizID, req.Email, userID).Scan(&emailCount)
		if err == nil && emailCount > 0 {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Email sudah digunakan oleh akun lain"})
		}
	}

	_, err = database.Pool.Exec(c.Context(), `
		UPDATE users
		SET full_name = $1, username = $2, email = $3, updated_at = NOW()
		WHERE id = $4 AND business_id = $5
	`, req.FullName, req.Username, req.Email, userID, bizID)

	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Gagal memperbarui profil"})
	}

	// Get business name
	var businessName string
	_ = database.Pool.QueryRow(c.Context(), "SELECT name FROM businesses WHERE id = $1", bizID).Scan(&businessName)

	// Fetch accessible branches
	var branches []BranchResponse
	if userRole == "owner" {
		rows, err := database.Pool.Query(c.Context(), `
			SELECT id, name, COALESCE(address, ''), COALESCE(phone, ''), is_active
			FROM branches
			WHERE business_id = $1 AND is_active = true
			ORDER BY name ASC
		`, bizID)
		if err == nil {
			defer rows.Close()
			for rows.Next() {
				var b BranchResponse
				if err := rows.Scan(&b.ID, &b.Name, &b.Address, &b.Phone, &b.IsActive); err == nil {
					branches = append(branches, b)
				}
			}
		}
	} else {
		rows, err := database.Pool.Query(c.Context(), `
			SELECT b.id, b.name, COALESCE(b.address, ''), COALESCE(b.phone, ''), b.is_active
			FROM branches b
			JOIN user_branch_assignments uba ON b.id = uba.branch_id
			WHERE uba.user_id = $1 AND b.is_active = true
			ORDER BY b.name ASC
		`, userID)
		if err == nil {
			defer rows.Close()
			for rows.Next() {
				var b BranchResponse
				if err := rows.Scan(&b.ID, &b.Name, &b.Address, &b.Phone, &b.IsActive); err == nil {
					branches = append(branches, b)
				}
			}
		}
	}

	newToken, err := auth.GenerateToken(userID, bizID, req.Username, userRole, req.FullName)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Gagal memperbarui sesi autentikasi"})
	}

	return c.JSON(fiber.Map{
		"message": "Profil berhasil diperbarui",
		"token":   newToken,
		"user": UserResponse{
			ID:           userID,
			BusinessID:   bizID,
			BusinessName: businessName,
			Username:     req.Username,
			Email:        req.Email,
			FullName:     req.FullName,
			Role:         userRole,
			Branches:     branches,
		},
	})
}
