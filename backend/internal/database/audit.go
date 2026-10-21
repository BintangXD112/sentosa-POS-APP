package database

import (
	"context"
	"encoding/json"

	"github.com/google/uuid"
)

// LogAudit records an immutable audit log entry into the database
func LogAudit(ctx context.Context, bizID uuid.UUID, userID *uuid.UUID, action, entityType, entityID string, details map[string]interface{}, ip, userAgent string) {
	if Pool == nil {
		return
	}

	var detailsJSON string
	if details != nil {
		if b, err := json.Marshal(details); err == nil {
			detailsJSON = string(b)
		} else {
			detailsJSON = "{}"
		}
	} else {
		detailsJSON = "{}"
	}

	_, _ = Pool.Exec(ctx, `
		INSERT INTO audit_logs (id, business_id, user_id, action, entity_type, entity_id, details, ip_address, user_agent, created_at)
		VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, NOW())
	`, bizID, userID, action, entityType, entityID, detailsJSON, ip, userAgent)
}
