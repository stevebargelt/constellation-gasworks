# keyvault.tf — Azure Key Vault for runtime secrets
#
# Provides:
#   - Key Vault with RBAC authorization (soft-delete + purge protection enabled)
#   - Key Vault Secrets User role assignment to the VM managed identity
#   - Constellation project secrets (never hardcoded — values from sensitive vars)
#   - Shared RESEND_API_KEY secret
#
# The VM reads secrets at runtime via managed identity (az keyvault secret show).
# No secrets appear in Docker Compose files, committed .env files, or CI logs.

# ---------------------------------------------------------------------------
# Current Azure client (needed for Key Vault tenant_id)
# ---------------------------------------------------------------------------

data "azurerm_client_config" "current" {}

# ---------------------------------------------------------------------------
# Key Vault
# ---------------------------------------------------------------------------

resource "azurerm_key_vault" "main" {
  name                = "kv-${var.project_name}"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  tenant_id           = data.azurerm_client_config.current.tenant_id

  sku_name = "standard"

  # RBAC authorization — access policies are not used
  enable_rbac_authorization = true

  # Soft delete: 90-day retention (Azure default); purge protection prevents
  # accidental permanent deletion of secrets before retention expires.
  soft_delete_retention_days = 90
  purge_protection_enabled   = true

  tags = local.tags
}

# ---------------------------------------------------------------------------
# Role assignment: VM managed identity → Key Vault Secrets User
# Grants read-only access to secret values (no create/delete).
# ---------------------------------------------------------------------------

resource "azurerm_role_assignment" "vm_keyvault_secrets_user" {
  scope                = azurerm_key_vault.main.id
  role_definition_name = "Key Vault Secrets User"
  principal_id         = azurerm_user_assigned_identity.vm.principal_id
}

# ---------------------------------------------------------------------------
# Constellation project secrets
# ---------------------------------------------------------------------------

resource "azurerm_key_vault_secret" "constellation_jwt_secret" {
  name         = "CONSTELLATION-JWT-SECRET"
  value        = var.constellation_jwt_secret
  key_vault_id = azurerm_key_vault.main.id

  depends_on = [azurerm_role_assignment.vm_keyvault_secrets_user]
}

resource "azurerm_key_vault_secret" "constellation_postgres_password" {
  name         = "CONSTELLATION-POSTGRES-PASSWORD"
  value        = var.constellation_postgres_password
  key_vault_id = azurerm_key_vault.main.id

  depends_on = [azurerm_role_assignment.vm_keyvault_secrets_user]
}

resource "azurerm_key_vault_secret" "constellation_anon_key" {
  name         = "CONSTELLATION-ANON-KEY"
  value        = var.constellation_anon_key
  key_vault_id = azurerm_key_vault.main.id

  depends_on = [azurerm_role_assignment.vm_keyvault_secrets_user]
}

resource "azurerm_key_vault_secret" "constellation_service_role_key" {
  name         = "CONSTELLATION-SERVICE-ROLE-KEY"
  value        = var.constellation_service_role_key
  key_vault_id = azurerm_key_vault.main.id

  depends_on = [azurerm_role_assignment.vm_keyvault_secrets_user]
}

# ---------------------------------------------------------------------------
# Shared secrets
# ---------------------------------------------------------------------------

resource "azurerm_key_vault_secret" "resend_api_key" {
  name         = "RESEND-API-KEY"
  value        = var.resend_api_key
  key_vault_id = azurerm_key_vault.main.id

  depends_on = [azurerm_role_assignment.vm_keyvault_secrets_user]
}
