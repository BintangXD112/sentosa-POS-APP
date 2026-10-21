package handlers

import (
	"bytes"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"pos-backend/internal/auth"
	"pos-backend/internal/database"
)

type Verify2FARequest struct {
	ChallengeToken string `json:"challenge_token"`
	Code           string `json:"code"`
	TrustDevice    bool   `json:"trust_device"`
	DeviceName     string `json:"device_name"`
}

type Resend2FARequest struct {
	ChallengeToken string `json:"challenge_token"`
}

// Generate6DigitCode generates a cryptographically secure 6-digit numeric OTP
func Generate6DigitCode() string {
	max := big.NewInt(900000)
	n, err := rand.Int(rand.Reader, max)
	if err != nil {
		return fmt.Sprintf("%06d", time.Now().UnixNano()%1000000)
	}
	return fmt.Sprintf("%06d", n.Int64()+100000)
}

// HashOTP hashes the 6-digit OTP code using SHA-256 for secure DB comparison
func HashOTP(code string) string {
	h := sha256.Sum256([]byte(code))
	return hex.EncodeToString(h[:])
}

// MaskEmail masks email address for privacy (e.g., bi***@gmail.com)
func MaskEmail(email string) string {
	parts := strings.Split(email, "@")
	if len(parts) != 2 {
		return "***@***"
	}
	name := parts[0]
	domain := parts[1]
	if len(name) <= 2 {
		return name + "***@" + domain
	}
	return name[:2] + strings.Repeat("*", len(name)-2) + "@" + domain
}

// SendTwoFactorEmail sends a 6-digit OTP code via Resend email API
func SendTwoFactorEmail(toEmail, toName, otpCode, ip, userAgent string) error {
	apiKey := os.Getenv("RESEND_API_KEY")
	if apiKey == "" {
		fmt.Printf("\n[DEMO/DEV 2FA OTP] Email to %s (%s): KODE OTP = %s (IP: %s)\n\n", toEmail, toName, otpCode, ip)
		return nil
	}

	htmlBody := fmt.Sprintf(`<!DOCTYPE html>
<html lang="id">
<head><meta charset="UTF-8"><title>Kode Verifikasi 2FA</title></head>
<body style="margin:0;padding:0;background:#090d16;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#e2e8f0">
  <table width="100%%" cellpadding="0" cellspacing="0" style="padding:40px 16px">
    <tr><td align="center">
      <table width="100%%" style="max-width:520px;background:#1e293b;border:1px solid #334155;border-radius:18px;overflow:hidden">
        <tr>
          <td style="padding:28px 32px 20px;border-bottom:1px solid #334155;background:#0f172a">
            <span style="font-size:18px;font-weight:800;color:#10b981;letter-spacing:-0.5px">Sentosa POS</span>
            <span style="font-size:11px;background:#059669;color:#fff;padding:2px 8px;border-radius:6px;margin-left:8px;font-weight:600">A2F Keamanan</span>
          </td>
        </tr>
        <tr>
          <td style="padding:32px">
            <h2 style="margin:0 0 12px;color:#f8fafc;font-size:20px;font-weight:700">Kode Verifikasi Masuk (2FA)</h2>
            <p style="color:#94a3b8;font-size:14px;line-height:1.6;margin:0 0 24px">
              Halo <strong style="color:#f1f5f9">%s</strong>,<br>
              Terdeteksi upaya masuk ke akun Anda dari <strong>perangkat yang belum terdaftar</strong>. Gunakan kode verifikasi sekali pakai berikut:
            </p>

            <div style="text-align:center;margin:0 0 24px;background:#090d16;border:2px dashed #059669;border-radius:16px;padding:24px 16px">
              <span style="font-size:36px;font-weight:900;letter-spacing:10px;color:#10b981;font-family:monospace;display:inline-block">%s</span>
              <p style="margin:8px 0 0;font-size:11px;color:#64748b">Kode ini hanya berlaku selama <strong>10 menit</strong></p>
            </div>

            <div style="background:#0f172a;border:1px solid #334155;border-radius:12px;padding:12px 16px;margin-bottom:20px;font-size:12px;color:#94a3b8">
              <div><strong>Alamat IP:</strong> %s</div>
              <div style="margin-top:4px"><strong>Perangkat / Browser:</strong> %s</div>
            </div>

            <p style="margin:0;font-size:12px;color:#f87171;line-height:1.5">
              ⚠️ Jika Anda tidak merasa mencoba login, segera ubah kata sandi akun Anda demi keamanan.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 32px;border-top:1px solid #334155;text-align:center;font-size:11px;color:#64748b">
            Email ini dikirim otomatis oleh sistem keamanan Sentosa Multi-Branch POS.
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`, toName, otpCode, ip, userAgent)

	payload := map[string]any{
		"from":    "Sentosa POS Security <onboarding@resend.dev>",
		"to":      []string{toEmail},
		"subject": fmt.Sprintf("Kode Verifikasi Login Sentosa POS: %s", otpCode),
		"html":    htmlBody,
	}

	bodyBytes, _ := json.Marshal(payload)
	req, err := http.NewRequest("POST", "https://api.resend.com/emails", bytes.NewBuffer(bodyBytes))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("gagal mengirim email 2FA: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("resend error %d: %s", resp.StatusCode, string(respBody))
	}

	return nil
}

// VerifyTwoFactor handles verification of the 6-digit OTP code and registers trusted devices
func VerifyTwoFactor(c *fiber.Ctx) error {
	var req Verify2FARequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Data payload tidak valid"})
	}

	req.ChallengeToken = strings.TrimSpace(req.ChallengeToken)
	req.Code = strings.TrimSpace(req.Code)

	if req.ChallengeToken == "" || req.Code == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Challenge token dan kode verifikasi 6 digit wajib diisi"})
	}

	ip := c.IP()
	if xForwarded := c.Get("X-Forwarded-For"); xForwarded != "" {
		ip = strings.TrimSpace(strings.Split(xForwarded, ",")[0])
	}
	userAgent := c.Get("User-Agent")

	// Query challenge
	var challenge struct {
		ID        uuid.UUID
		UserID    uuid.UUID
		CodeHash  string
		Attempts  int
		ExpiresAt time.Time
		UsedAt    *time.Time
	}

	err := database.Pool.QueryRow(c.Context(), `
		SELECT id, user_id, code_hash, attempts, expires_at, used_at
		FROM two_factor_challenges
		WHERE challenge_token = $1
	`, req.ChallengeToken).Scan(
		&challenge.ID, &challenge.UserID, &challenge.CodeHash,
		&challenge.Attempts, &challenge.ExpiresAt, &challenge.UsedAt,
	)

	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Sesi verifikasi 2FA tidak ditemukan atau sudah kadaluwarsa"})
	}

	if challenge.UsedAt != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Kode verifikasi ini sudah pernah digunakan"})
	}

	if time.Now().After(challenge.ExpiresAt) {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Kode verifikasi sudah kadaluwarsa. Silakan kirim ulang kode baru."})
	}

	if challenge.Attempts >= 5 {
		return c.Status(fiber.StatusTooManyRequests).JSON(fiber.Map{"error": "Terlalu banyak percobaan salah. Silakan lakukan login ulang."})
	}

	// Fetch user details
	var user struct {
		ID           uuid.UUID
		BusinessID   uuid.UUID
		BusinessName string
		Username     string
		Email        *string
		FullName     string
		Role         string
		IsActive     bool
	}

	err = database.Pool.QueryRow(c.Context(), `
		SELECT u.id, u.business_id, b.name, u.username, u.email, u.full_name, u.role, u.is_active
		FROM users u
		JOIN businesses b ON u.business_id = b.id
		WHERE u.id = $1
	`, challenge.UserID).Scan(
		&user.ID, &user.BusinessID, &user.BusinessName, &user.Username,
		&user.Email, &user.FullName, &user.Role, &user.IsActive,
	)

	if err != nil || !user.IsActive {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Akun tidak ditemukan atau telah dinonaktifkan"})
	}

	// Compare OTP hash
	inputHash := HashOTP(req.Code)
	if inputHash != challenge.CodeHash {
		// Increment attempts
		_, _ = database.Pool.Exec(c.Context(), `
			UPDATE two_factor_challenges SET attempts = attempts + 1 WHERE id = $1
		`, challenge.ID)

		database.LogAudit(c.Context(), user.BusinessID, &user.ID, "auth.login_2fa_failed", "user", user.ID.String(), map[string]interface{}{
			"reason":   "Kode OTP salah",
			"attempts": challenge.Attempts + 1,
		}, ip, userAgent)

		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": fmt.Sprintf("Kode verifikasi salah (%d/5 percobaan)", challenge.Attempts+1),
		})
	}

	// Mark challenge as used
	_, _ = database.Pool.Exec(c.Context(), `
		UPDATE two_factor_challenges SET used_at = NOW() WHERE id = $1
	`, challenge.ID)

	var newDeviceToken string
	if req.TrustDevice {
		// Generate 30-day trusted device token
		rawBytes := make([]byte, 24)
		_, _ = rand.Read(rawBytes)
		newDeviceToken = fmt.Sprintf("td-%s-%s", user.ID.String()[:8], hex.EncodeToString(rawBytes))

		deviceName := req.DeviceName
		if deviceName == "" {
			deviceName = "Perangkat Web"
		}

		// Insert or update trusted device (Expires in strictly 30 days)
		_, _ = database.Pool.Exec(c.Context(), `
			INSERT INTO trusted_devices (user_id, device_token, device_name, ip_address, user_agent, expires_at, last_used_at, created_at)
			VALUES ($1, $2, $3, $4, $5, NOW() + INTERVAL '30 days', NOW(), NOW())
			ON CONFLICT (user_id, device_token) DO UPDATE
			SET expires_at = NOW() + INTERVAL '30 days', last_used_at = NOW()
		`, user.ID, newDeviceToken, deviceName, ip, userAgent)
	}

	// Generate JWT authentication token
	token, err := auth.GenerateToken(user.ID, user.BusinessID, user.Username, user.Role, user.FullName)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Gagal membuat sesi token autentikasi"})
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

	database.LogAudit(c.Context(), user.BusinessID, &user.ID, "auth.login_2fa_success", "user", user.ID.String(), map[string]interface{}{
		"trusted_device_created": req.TrustDevice,
		"device_name":            req.DeviceName,
		"expires_in_days":        30,
	}, ip, userAgent)

	return c.JSON(fiber.Map{
		"token":        token,
		"device_token": newDeviceToken,
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

// ResendTwoFactorCode generates and sends a fresh 2FA OTP code
func ResendTwoFactorCode(c *fiber.Ctx) error {
	var req Resend2FARequest
	if err := c.BodyParser(&req); err != nil || req.ChallengeToken == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Challenge token tidak valid"})
	}

	ip := c.IP()
	userAgent := c.Get("User-Agent")

	var challenge struct {
		ID        uuid.UUID
		UserID    uuid.UUID
		UsedAt    *time.Time
		ExpiresAt time.Time
	}

	err := database.Pool.QueryRow(c.Context(), `
		SELECT id, user_id, used_at, expires_at
		FROM two_factor_challenges
		WHERE challenge_token = $1
	`, req.ChallengeToken).Scan(&challenge.ID, &challenge.UserID, &challenge.UsedAt, &challenge.ExpiresAt)

	if err != nil || challenge.UsedAt != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Sesi verifikasi tidak valid"})
	}

	var user struct {
		ID       uuid.UUID
		FullName string
		Email    *string
	}
	err = database.Pool.QueryRow(c.Context(), `
		SELECT id, full_name, email FROM users WHERE id = $1
	`, challenge.UserID).Scan(&user.ID, &user.FullName, &user.Email)

	if err != nil || user.Email == nil || *user.Email == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Alamat email akun tidak ditemukan"})
	}

	// Generate fresh 6-digit code
	newCode := Generate6DigitCode()
	codeHash := HashOTP(newCode)

	// Update challenge
	_, err = database.Pool.Exec(c.Context(), `
		UPDATE two_factor_challenges
		SET code_hash = $1, expires_at = NOW() + INTERVAL '10 minutes', attempts = 0
		WHERE id = $2
	`, codeHash, challenge.ID)

	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Gagal memperbarui kode verifikasi"})
	}

	// Send email asynchronously
	go func() {
		_ = SendTwoFactorEmail(*user.Email, user.FullName, newCode, ip, userAgent)
	}()

	return c.JSON(fiber.Map{
		"message":      "Kode verifikasi baru berhasil dikirim ke email Anda",
		"masked_email": MaskEmail(*user.Email),
	})
}
