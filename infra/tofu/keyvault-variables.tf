# keyvault-variables.tf — Sensitive variable declarations for Key Vault secrets
#
# Values are supplied via TF_VAR_* GitHub Actions secrets — never hardcoded.
# See infra/tofu/secrets.tfvars.example for the complete list of required names.

variable "constellation_jwt_secret" {
  description = "JWT secret for the constellation Supabase project (openssl rand -hex 32)"
  type        = string
  sensitive   = true
}

variable "constellation_postgres_password" {
  description = "Postgres superuser password for the constellation Supabase project (openssl rand -base64 32)"
  type        = string
  sensitive   = true
}

variable "constellation_anon_key" {
  description = "Supabase anon (public) JWT for the constellation project — generated from JWT_SECRET"
  type        = string
  sensitive   = true
}

variable "constellation_service_role_key" {
  description = "Supabase service-role JWT for the constellation project — generated from JWT_SECRET"
  type        = string
  sensitive   = true
}

variable "resend_api_key" {
  description = "Resend SMTP API key shared across all Supabase projects for auth emails"
  type        = string
  sensitive   = true
}
