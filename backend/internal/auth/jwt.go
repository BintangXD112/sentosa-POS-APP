package auth

import (
	"errors"
	"os"
	"strconv"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

type Claims struct {
	UserID     uuid.UUID `json:"user_id"`
	BusinessID uuid.UUID `json:"business_id"`
	Username   string    `json:"username"`
	Role       string    `json:"role"`
	FullName   string    `json:"full_name"`
	jwt.RegisteredClaims
}

func getSecret() []byte {
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		secret = "default_fallback_jwt_pos_secret_key"
	}
	return []byte(secret)
}

func GetTokenDuration() time.Duration {
	hoursStr := os.Getenv("JWT_EXPIRY_HOURS")
	if hoursStr != "" {
		if h, err := strconv.Atoi(hoursStr); err == nil && h > 0 {
			return time.Duration(h) * time.Hour
		}
	}
	return 24 * time.Hour
}

func GenerateToken(userID, businessID uuid.UUID, username, role, fullName string) (string, error) {
	duration := GetTokenDuration()
	claims := Claims{
		UserID:     userID,
		BusinessID: businessID,
		Username:   username,
		Role:       role,
		FullName:   fullName,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(duration)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Subject:   userID.String(),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(getSecret())
}

func ParseToken(tokenStr string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenStr, &Claims{}, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unexpected signing method")
		}
		return getSecret(), nil
	})

	if err != nil {
		return nil, err
	}

	if claims, ok := token.Claims.(*Claims); ok && token.Valid {
		return claims, nil
	}

	return nil, errors.New("invalid token")
}
