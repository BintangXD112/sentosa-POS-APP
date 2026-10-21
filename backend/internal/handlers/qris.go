package handlers

import (
	"fmt"
	"net"
	"os"
	"sync"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

func getOutboundIP() string {
	if envHost := os.Getenv("QRIS_HOST"); envHost != "" {
		return envHost
	}

	// Connect UDP to public DNS (no actual packet sent) to let OS select the active local LAN IP
	conn, err := net.Dial("udp", "8.8.8.8:80")
	if err == nil {
		defer conn.Close()
		localAddr := conn.LocalAddr().(*net.UDPAddr)
		if ip := localAddr.IP.To4(); ip != nil && !ip.IsLoopback() {
			return ip.String()
		}
	}

	// Fallback: scan active network interfaces
	ifaces, err := net.Interfaces()
	if err == nil {
		for _, iface := range ifaces {
			if iface.Flags&net.FlagUp == 0 || iface.Flags&net.FlagLoopback != 0 {
				continue
			}
			addrs, err := iface.Addrs()
			if err != nil {
				continue
			}
			for _, addr := range addrs {
				var ip net.IP
				switch v := addr.(type) {
				case *net.IPNet:
					ip = v.IP
				case *net.IPAddr:
					ip = v.IP
				}
				if ip != nil && ip.To4() != nil && !ip.IsLoopback() {
					return ip.String()
				}
			}
		}
	}

	return "localhost"
}

type qrisSession struct {
	ID         string
	BusinessID uuid.UUID
	Amount     int64
	Status     string // "pending" | "paid"
	CreatedAt  time.Time
	PaidAt     *time.Time
}

var (
	qrisSessions   = make(map[string]*qrisSession)
	qrisSessionsMu sync.RWMutex
)

type CreateQRISSessionRequest struct {
	Amount int64 `json:"amount"`
}

// CreateQRISSession — protected, called by cashier frontend
func CreateQRISSession(c *fiber.Ctx) error {
	bizID := c.Locals("business_id").(uuid.UUID)

	var req CreateQRISSessionRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request"})
	}
	if req.Amount <= 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Amount must be greater than 0"})
	}

	sessionID := uuid.New().String()

	qrisSessionsMu.Lock()
	qrisSessions[sessionID] = &qrisSession{
		ID:         sessionID,
		BusinessID: bizID,
		Amount:     req.Amount,
		Status:     "pending",
		CreatedAt:  time.Now(),
	}
	qrisSessionsMu.Unlock()

	// Cleanup old sessions (> 10 minutes) to avoid memory leak
	go cleanupExpiredSessions()

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	serverIP := getOutboundIP()
	payURL := fmt.Sprintf("http://%s:%s/api/v1/qris/confirm/%s", serverIP, port, sessionID)

	return c.JSON(fiber.Map{
		"session_id": sessionID,
		"pay_url":    payURL,
		"server_ip":  serverIP,
	})
}

// GetQRISStatus — protected, polled by cashier frontend
func GetQRISStatus(c *fiber.Ctx) error {
	sessionID := c.Params("id")

	qrisSessionsMu.RLock()
	session, exists := qrisSessions[sessionID]
	qrisSessionsMu.RUnlock()

	if !exists {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Session not found"})
	}

	return c.JSON(fiber.Map{
		"session_id": session.ID,
		"status":     session.Status,
		"amount":     session.Amount,
	})
}

// ConfirmQRISPage — no auth, opened by phone after scanning QR
func ConfirmQRISPage(c *fiber.Ctx) error {
	sessionID := c.Params("id")

	qrisSessionsMu.RLock()
	session, exists := qrisSessions[sessionID]
	qrisSessionsMu.RUnlock()

	if !exists {
		c.Set("Content-Type", "text/html; charset=utf-8")
		return c.SendString(errorPage("Session Tidak Ditemukan", "Link pembayaran sudah kedaluwarsa atau tidak valid."))
	}

	if session.Status == "paid" {
		c.Set("Content-Type", "text/html; charset=utf-8")
		return c.SendString(successPage(session.Amount))
	}

	c.Set("Content-Type", "text/html; charset=utf-8")
	return c.SendString(confirmPage(session.Amount, sessionID))
}

// PayQRIS — no auth, called from phone after tapping "Bayar"
func PayQRIS(c *fiber.Ctx) error {
	sessionID := c.Params("id")

	qrisSessionsMu.Lock()
	session, exists := qrisSessions[sessionID]
	if exists && session.Status == "pending" {
		now := time.Now()
		session.Status = "paid"
		session.PaidAt = &now
	}
	qrisSessionsMu.Unlock()

	if !exists {
		c.Set("Content-Type", "text/html; charset=utf-8")
		return c.Status(fiber.StatusNotFound).SendString(errorPage("Session Tidak Ditemukan", "Link pembayaran sudah kedaluwarsa."))
	}

	c.Set("Content-Type", "text/html; charset=utf-8")
	return c.SendString(successPage(session.Amount))
}

// --- HTML Pages ---

func rupiahFormat(amount int64) string {
	s := fmt.Sprintf("%d", amount)
	result := ""
	for i, ch := range s {
		if i > 0 && (len(s)-i)%3 == 0 {
			result += "."
		}
		result += string(ch)
	}
	return result
}

func confirmPage(amount int64, sessionID string) string {
	return fmt.Sprintf(`<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
<title>Pembayaran QRIS</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0f172a;color:#f8fafc;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}
.card{background:#1e293b;border:1px solid #334155;border-radius:28px;padding:40px 28px;max-width:380px;width:100%%;text-align:center;box-shadow:0 25px 60px rgba(0,0,0,0.5)}
.brand{width:72px;height:72px;background:linear-gradient(135deg,#10b981,#0d9488);border-radius:20px;margin:0 auto 20px;display:flex;align-items:center;justify-content:center;font-size:36px;box-shadow:0 8px 24px rgba(16,185,129,0.3)}
.name{font-size:18px;font-weight:800;color:#fff;letter-spacing:-0.5px}
.sub{font-size:13px;color:#64748b;margin-top:4px;margin-bottom:32px}
.divider{height:1px;background:#334155;margin:0 -28px 28px}
.label{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#64748b}
.amount{font-size:44px;font-weight:900;color:#34d399;letter-spacing:-1px;margin:10px 0 36px;font-variant-numeric:tabular-nums}
.btn{display:block;width:100%%;padding:20px;background:linear-gradient(135deg,#059669,#0d9488);color:#fff;font-size:18px;font-weight:800;border:none;border-radius:18px;cursor:pointer;letter-spacing:-0.3px;box-shadow:0 8px 20px rgba(5,150,105,0.4);transition:all 0.15s;-webkit-tap-highlight-color:transparent}
.btn:active{transform:scale(0.97);box-shadow:0 4px 12px rgba(5,150,105,0.4)}
.note{margin-top:20px;font-size:12px;color:#475569;line-height:1.6}
.qris-logo{display:inline-flex;align-items:center;gap:6px;background:#1a1a2e;border:1px solid #3730a3;border-radius:10px;padding:6px 14px;margin-bottom:24px}
.qris-logo span{font-size:11px;font-weight:800;color:#818cf8;letter-spacing:1px}
</style>
</head>
<body>
<div class="card">
  <div class="brand">🏪</div>
  <div class="name">Sentosa Retail Group</div>
  <div class="sub">Pembayaran QRIS</div>
  <div class="divider"></div>
  <div class="qris-logo"><span>QRIS</span></div>
  <div class="label">Total Tagihan</div>
  <div class="amount">Rp %s</div>
  <form method="POST" action="/api/v1/qris/pay/%s">
    <button type="submit" class="btn">✓&nbsp; Konfirmasi Pembayaran</button>
  </form>
  <p class="note">Tekan tombol untuk mengkonfirmasi pembayaran.<br>Kasir akan menerima notifikasi otomatis.</p>
</div>
</body>
</html>`, rupiahFormat(amount), sessionID)
}

func successPage(amount int64) string {
	return fmt.Sprintf(`<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
<title>Pembayaran Berhasil</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0f172a;color:#f8fafc;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}
.card{background:#1e293b;border:1px solid #334155;border-radius:28px;padding:48px 28px;max-width:380px;width:100%%;text-align:center;box-shadow:0 25px 60px rgba(0,0,0,0.5)}
.check{width:80px;height:80px;background:linear-gradient(135deg,#10b981,#0d9488);border-radius:50%%;margin:0 auto 24px;display:flex;align-items:center;justify-content:center;font-size:40px;box-shadow:0 8px 32px rgba(16,185,129,0.4);animation:pop 0.4s ease}
@keyframes pop{0%%{transform:scale(0.5);opacity:0}80%%{transform:scale(1.1)}100%%{transform:scale(1);opacity:1}}
h1{font-size:24px;font-weight:800;color:#fff;letter-spacing:-0.5px;margin-bottom:8px}
.amount{font-size:36px;font-weight:900;color:#34d399;margin:20px 0;font-variant-numeric:tabular-nums}
.badge{display:inline-block;background:rgba(16,185,129,0.15);border:1px solid rgba(16,185,129,0.4);color:#34d399;font-size:13px;font-weight:700;padding:8px 24px;border-radius:999px;margin-bottom:20px;letter-spacing:1px;text-transform:uppercase}
p{font-size:13px;color:#64748b;line-height:1.6}
</style>
</head>
<body>
<div class="card">
  <div class="check">✓</div>
  <h1>Pembayaran Berhasil!</h1>
  <div class="amount">Rp %s</div>
  <div class="badge">LUNAS</div>
  <p>Transaksi dikonfirmasi.<br>Tunjukkan layar ini kepada kasir jika diperlukan.</p>
</div>
</body>
</html>`, rupiahFormat(amount))
}

func errorPage(title, message string) string {
	return fmt.Sprintf(`<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>%s</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:sans-serif;background:#0f172a;color:#f8fafc;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}
.card{background:#1e293b;border:1px solid #ef4444;border-radius:24px;padding:40px 28px;max-width:360px;width:100%%;text-align:center}
.icon{font-size:48px;margin-bottom:16px}
h1{font-size:18px;font-weight:700;color:#ef4444;margin-bottom:8px}
p{font-size:13px;color:#94a3b8}
</style>
</head>
<body>
<div class="card">
  <div class="icon">⚠️</div>
  <h1>%s</h1>
  <p>%s</p>
</div>
</body>
</html>`, title, title, message)
}

func cleanupExpiredSessions() {
	threshold := 10 * time.Minute
	qrisSessionsMu.Lock()
	defer qrisSessionsMu.Unlock()
	for id, s := range qrisSessions {
		if time.Since(s.CreatedAt) > threshold {
			delete(qrisSessions, id)
		}
	}
}
