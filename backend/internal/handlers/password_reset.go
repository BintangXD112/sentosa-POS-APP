package handlers

import (
	"bytes"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"golang.org/x/crypto/bcrypt"
	"pos-backend/internal/database"
)

// --- Request / Response structs ---

type ForgotPasswordRequest struct {
	Email string `json:"email"`
}

type ResetPasswordRequest struct {
	Token    string `json:"token"`
	Password string `json:"password"`
}

// --- Helpers ---

func generateSecureToken() (raw string, hashed string, err error) {
	b := make([]byte, 32)
	if _, err = rand.Read(b); err != nil {
		return
	}
	raw = hex.EncodeToString(b)
	sum := sha256.Sum256([]byte(raw))
	hashed = hex.EncodeToString(sum[:])
	return
}

func sendResetEmail(toEmail, toName, resetURL string) error {
	apiKey := os.Getenv("RESEND_API_KEY")
	if apiKey == "" {
		return fmt.Errorf("RESEND_API_KEY is not configured")
	}

	htmlBody := fmt.Sprintf(`<!DOCTYPE html>
<html lang="id">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:40px 20px">
    <tr><td align="center">
      <table width="560" style="background:#1e293b;border-radius:20px;overflow:hidden;border:1px solid #334155">
        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#059669,#0d9488);padding:32px;text-align:center">
            <div style="width:56px;height:56px;background:rgba(255,255,255,0.15);border-radius:16px;display:inline-flex;align-items:center;justify-content:center;margin-bottom:12px;font-size:28px">🏪</div>
            <h1 style="margin:0;color:#fff;font-size:22px;font-weight:800;letter-spacing:-0.5px">Sentosa POS</h1>
            <p style="margin:6px 0 0;color:rgba(255,255,255,0.75);font-size:13px">Multi-Branch Point of Sale</p>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:36px 32px">
            <h2 style="margin:0 0 12px;color:#f1f5f9;font-size:18px;font-weight:700">Reset Kata Sandi</h2>
            <p style="color:#94a3b8;font-size:14px;line-height:1.7;margin:0 0 24px">
              Halo <strong style="color:#e2e8f0">%s</strong>,<br>
              Kami menerima permintaan untuk mengatur ulang kata sandi akun Anda. Klik tombol di bawah ini untuk melanjutkan.
            </p>
            <div style="text-align:center;margin:0 0 28px">
              <a href="%s" style="display:inline-block;background:linear-gradient(135deg,#059669,#0d9488);color:#fff;text-decoration:none;padding:14px 36px;border-radius:12px;font-size:15px;font-weight:700;letter-spacing:-0.3px">
                Reset Kata Sandi
              </a>
            </div>
            <div style="background:#0f172a;border:1px solid #334155;border-radius:12px;padding:14px 18px;margin-bottom:24px">
              <p style="margin:0 0 6px;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:1px;font-weight:700">Atau salin link berikut:</p>
              <p style="margin:0;font-size:12px;color:#7dd3fc;word-break:break-all">%s</p>
            </div>
            <div style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.25);border-radius:10px;padding:12px 16px">
              <p style="margin:0;font-size:12px;color:#fca5a5;line-height:1.6">
                ⚠️ Link ini berlaku selama <strong>1 jam</strong> dan hanya dapat digunakan sekali.<br>
                Jika Anda tidak meminta reset password, abaikan email ini — akun Anda tetap aman.
              </p>
            </div>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:20px 32px;border-top:1px solid #334155;text-align:center">
            <p style="margin:0;font-size:12px;color:#475569">
              Email ini dikirim otomatis oleh sistem Sentosa POS.<br>
              Jangan balas email ini.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`, toName, resetURL, resetURL)

	payload := map[string]any{
		"from":    "Sentosa POS <onboarding@resend.dev>",
		"to":      []string{toEmail},
		"subject": "Reset Kata Sandi Akun Sentosa POS",
		"html":    htmlBody,
	}

	body, _ := json.Marshal(payload)
	req, err := http.NewRequest("POST", "https://api.resend.com/emails", bytes.NewBuffer(body))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send email: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("resend API error %d: %s", resp.StatusCode, string(respBody))
	}
	return nil
}

// --- Handlers ---

// ForgotPassword — POST /api/v1/auth/forgot-password
// Returns generic success even if email not found (anti-enumeration)
func ForgotPassword(c *fiber.Ctx) error {
	var req ForgotPasswordRequest
	if err := c.BodyParser(&req); err != nil || req.Email == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Email is required"})
	}

	// Generic success response — do not reveal whether email exists
	successResp := fiber.Map{"message": "Jika email tersebut terdaftar, instruksi reset password telah dikirim."}

	var userID, bizID [16]byte
	var username, fullName string
	err := database.Pool.QueryRow(c.Context(), `
		SELECT id, business_id, username, full_name
		FROM users
		WHERE email = $1 AND is_active = true
		LIMIT 1
	`, req.Email).Scan(&userID, &bizID, &username, &fullName)
	if err != nil {
		// User not found — return success anyway (anti-enumeration)
		return c.JSON(successResp)
	}

	// Generate secure token
	rawToken, hashedToken, err := generateSecureToken()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Internal error"})
	}

	expiresAt := time.Now().Add(1 * time.Hour)

	// Invalidate any existing unused tokens for this user
	_, _ = database.Pool.Exec(c.Context(), `
		DELETE FROM password_reset_tokens
		WHERE user_id = $1 AND used_at IS NULL
	`, userID)

	// Store hashed token only — raw token never persisted
	_, err = database.Pool.Exec(c.Context(), `
		INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
		VALUES ($1, $2, $3)
	`, userID, hashedToken, expiresAt)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Internal error"})
	}

	// Build reset URL (frontend route)
	frontendURL := ""
	if origin := c.Get("Origin"); origin != "" {
		frontendURL = strings.TrimRight(origin, "/")
	} else if referer := c.Get("Referer"); referer != "" {
		if u, err := url.Parse(referer); err == nil && u.Scheme != "" && u.Host != "" {
			frontendURL = fmt.Sprintf("%s://%s", u.Scheme, u.Host)
		}
	}
	if frontendURL == "" {
		frontendURL = os.Getenv("FRONTEND_URL")
	}
	if frontendURL == "" {
		frontendURL = "http://localhost:8080"
	}
	frontendURL = strings.TrimRight(frontendURL, "/")
	resetURL := fmt.Sprintf("%s/reset-password?token=%s", frontendURL, rawToken)

	// Send email asynchronously — don't block response on email delivery
	go func() {
		if err := sendResetEmail(req.Email, fullName, resetURL); err != nil {
			fmt.Printf("[WARN] Failed to send password reset email to %s: %v\n", req.Email, err)
		}
	}()

	return c.JSON(successResp)
}

// VerifyResetToken — GET /api/v1/auth/verify-reset-token
func VerifyResetToken(c *fiber.Ctx) error {
	rawToken := c.Query("token")
	if rawToken == "" {
		var req struct {
			Token string `json:"token"`
		}
		_ = c.BodyParser(&req)
		rawToken = req.Token
	}

	if rawToken == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"valid": false,
			"error": "Token reset password tidak ditemukan. Silakan minta tautan baru.",
		})
	}

	// Hash incoming token
	sum := sha256.Sum256([]byte(rawToken))
	hashedToken := hex.EncodeToString(sum[:])

	var expiresAt time.Time
	var usedAt *time.Time

	err := database.Pool.QueryRow(c.Context(), `
		SELECT expires_at, used_at
		FROM password_reset_tokens
		WHERE token_hash = $1
		LIMIT 1
	`, hashedToken).Scan(&expiresAt, &usedAt)

	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"valid": false,
			"error": "Tautan reset password tidak valid atau sudah tidak tersedia.",
		})
	}

	if usedAt != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"valid": false,
			"error": "Tautan reset password ini sudah pernah digunakan. Demi keamanan, tautan hanya dapat digunakan satu kali.",
		})
	}

	if time.Now().After(expiresAt) {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"valid": false,
			"error": "Tautan reset password sudah kedaluwarsa. Silakan minta tautan baru.",
		})
	}

	return c.JSON(fiber.Map{
		"valid":   true,
		"message": "Token valid dan siap digunakan",
	})
}

// ResetPassword — POST /api/v1/auth/reset-password
func ResetPassword(c *fiber.Ctx) error {
	var req ResetPasswordRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request"})
	}
	if req.Token == "" || len(req.Password) < 8 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Token wajib diisi dan password minimal 8 karakter"})
	}

	// Hash the incoming raw token to look it up
	sum := sha256.Sum256([]byte(req.Token))
	hashedToken := hex.EncodeToString(sum[:])

	var tokenID [16]byte
	var userID [16]byte
	var expiresAt time.Time
	var usedAt *time.Time

	err := database.Pool.QueryRow(c.Context(), `
		SELECT id, user_id, expires_at, used_at
		FROM password_reset_tokens
		WHERE token_hash = $1
		LIMIT 1
	`, hashedToken).Scan(&tokenID, &userID, &expiresAt, &usedAt)

	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Token tidak valid atau sudah kedaluwarsa"})
	}
	if usedAt != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Token sudah digunakan sebelumnya"})
	}
	if time.Now().After(expiresAt) {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Token sudah kedaluwarsa. Minta reset password baru."})
	}

	// Hash new password
	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Internal error"})
	}

	// Atomic: update password + mark token used
	tx, err := database.Pool.Begin(c.Context())
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Internal error"})
	}
	defer tx.Rollback(c.Context())

	_, err = tx.Exec(c.Context(), `
		UPDATE users SET password_hash = $1, updated_at = NOW()
		WHERE id = $2
	`, string(hash), userID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Gagal memperbarui password"})
	}

	_, err = tx.Exec(c.Context(), `
		UPDATE password_reset_tokens SET used_at = NOW()
		WHERE id = $1
	`, tokenID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Internal error"})
	}

	if err := tx.Commit(c.Context()); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Internal error"})
	}

	return c.JSON(fiber.Map{"message": "Password berhasil diperbarui. Silakan login dengan password baru Anda."})
}
