package main

import (
	"embed"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/filesystem"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/joho/godotenv"
	"pos-backend/internal/database"
	"pos-backend/internal/handlers"
	"pos-backend/internal/middleware"
)

//go:embed dist/*
var embedDist embed.FS

func openBrowser(url string) {
	var cmd string
	var args []string

	switch runtime.GOOS {
	case "windows":
		cmd = "rundll32"
		args = []string{"url.dll,FileProtocolHandler", url}
	case "darwin":
		cmd = "open"
		args = []string{url}
	default:
		cmd = "xdg-open"
		args = []string{url}
	}
	_ = exec.Command(cmd, args...).Start()
}

func main() {
	// Try loading .env from various possible locations
	_ = godotenv.Load()
	_ = godotenv.Load(".env")
	_ = godotenv.Load("backend/.env")
	_ = godotenv.Load("../backend/.env")

	if exePath, err := os.Executable(); err == nil {
		exeDir := filepath.Dir(exePath)
		_ = godotenv.Load(filepath.Join(exeDir, ".env"))
		_ = godotenv.Load(filepath.Join(exeDir, "backend", ".env"))
	}

	pool := database.ConnectDB()
	defer pool.Close()
	fmt.Println("Database connection pool established.")

	app := fiber.New(fiber.Config{
		AppName:      "Sentosa Multi-Branch Web POS v1.0",
		ErrorHandler: func(c *fiber.Ctx, err error) error {
			code := fiber.StatusInternalServerError
			if e, ok := err.(*fiber.Error); ok {
				code = e.Code
			}
			return c.Status(code).JSON(fiber.Map{
				"error": err.Error(),
			})
		},
	})

	app.Use(recover.New())
	app.Use(logger.New())
	app.Use(cors.New(cors.Config{
		AllowOrigins:     "*",
		AllowHeaders:     "Origin, Content-Type, Accept, Authorization, X-Branch-ID, X-Idempotency-Key",
		AllowMethods:     "GET, POST, PUT, DELETE, OPTIONS",
		AllowCredentials: false,
	}))

	// Health Check
	app.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"status": "ok", "app": "Sentosa Multi-Branch Web POS"})
	})

	api := app.Group("/api/v1")
	api.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"status":   "ok",
			"database": "connected",
			"version":  "1.0",
		})
	})

	// Public Auth Routes
	api.Post("/auth/login", handlers.Login)
	api.Post("/auth/forgot-password", handlers.ForgotPassword)
	api.Get("/auth/verify-reset-token", handlers.VerifyResetToken)
	api.Post("/auth/reset-password", handlers.ResetPassword)

	// Public QRIS pages (accessed by phone - no auth required)
	api.Get("/qris/confirm/:id", handlers.ConfirmQRISPage)
	api.Post("/qris/pay/:id", handlers.PayQRIS)

	// Protected Routes
	protected := api.Group("", middleware.AuthRequired())
	protected.Get("/auth/me", handlers.Me)
	protected.Put("/auth/profile", handlers.UpdateProfile)
	protected.Post("/auth/change-password", handlers.ChangePassword)

	// Business & Store Settings
	protected.Get("/business", handlers.GetBusiness)
	protected.Put("/business", middleware.RequireRoles("owner"), handlers.UpdateBusiness)
	protected.Put("/branches/:id", middleware.RequireRoles("owner"), handlers.UpdateBranch)

	// Branch-scoped routes
	branchScoped := protected.Group("", middleware.ValidateBranchAccess())

	// Catalog & Products
	branchScoped.Get("/products", handlers.GetProducts)
	branchScoped.Get("/categories", handlers.GetCategories)
	branchScoped.Get("/units", handlers.GetUnits)

	// Checkout Engine
	branchScoped.Post("/checkout", handlers.ProcessCheckout)

	// Sales & Receipts
	branchScoped.Get("/sales", handlers.GetSales)
	branchScoped.Get("/sales/:id", handlers.GetSaleByID)
	branchScoped.Post("/sales/:id/void", middleware.RequireRoles("owner", "branch_manager"), handlers.VoidSale)

	// Inventory
	branchScoped.Get("/inventory", handlers.GetBranchInventory)
	branchScoped.Post("/inventory/adjust", middleware.RequireRoles("owner", "branch_manager", "inventory_staff"), handlers.AdjustStock)
	branchScoped.Get("/inventory/movements", handlers.GetInventoryMovements)

	// Reports
	branchScoped.Get("/reports/summary", middleware.RequireRoles("owner", "branch_manager"), handlers.GetReportsSummary)

	// QRIS Simulation Session (protected)
	protected.Post("/qris/session", handlers.CreateQRISSession)
	protected.Get("/qris/status/:id", handlers.GetQRISStatus)

	// Embedded Static Frontend (React SPA)
	app.Use("/", filesystem.New(filesystem.Config{
		Root:         http.FS(embedDist),
		PathPrefix:   "dist",
		Index:        "index.html",
		NotFoundFile: "dist/index.html",
		Next: func(c *fiber.Ctx) bool {
			return strings.HasPrefix(c.Path(), "/api")
		},
	}))

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	url := "http://localhost:" + port
	fmt.Printf("\n=======================================================\n")
	fmt.Printf("   Sentosa POS — Multi-Branch POS System\n")
	fmt.Printf("   Aplikasi berjalan di: %s\n", url)
	fmt.Printf("   Backend & Frontend aktif dan siap digunakan.\n")
	fmt.Printf("=======================================================\n\n")

	// Open browser automatically unless disabled
	if os.Getenv("NO_BROWSER") != "1" {
		go func() {
			time.Sleep(800 * time.Millisecond)
			openBrowser(url)
		}()
	}

	log.Printf("Server starting on port %s ...\n", port)
	log.Fatal(app.Listen(":" + port))
}
