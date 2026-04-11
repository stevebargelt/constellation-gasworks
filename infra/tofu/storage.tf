# storage.tf — Azure Blob Storage for tfstate and per-project backups
#
# NOTE: The tfstate storage account itself is bootstrapped manually (or via a
# separate bootstrap step) before running tofu init. It is declared here as a
# data source so the rest of the config can reference it, but we do NOT manage
# its creation through this module to avoid the chicken-and-egg problem.

# ── Data source: pre-existing tfstate storage account ─────────────────────────
data "azurerm_storage_account" "tfstate" {
  name                = var.tfstate_storage_account
  resource_group_name = var.resource_group_name
}

# ── Storage account for project backups ───────────────────────────────────────
resource "azurerm_storage_account" "backups" {
  name                     = var.backups_storage_account_name
  resource_group_name      = var.resource_group_name
  location                 = var.location
  account_tier             = "Standard"
  account_replication_type = "LRS"
  min_tls_version          = "TLS1_2"

  blob_properties {
    delete_retention_policy {
      days = 7
    }
  }

  tags = var.common_tags
}

# ── Backups container ──────────────────────────────────────────────────────────
resource "azurerm_storage_container" "backups" {
  name                  = "backups"
  storage_account_name  = azurerm_storage_account.backups.name
  container_access_type = "private"
}

# ── Lifecycle management policy ────────────────────────────────────────────────
# - Prototype project backups (backups/proto-*/):  delete after 7 days
# - Constellation backups    (backups/constellation/): delete after 30 days
resource "azurerm_storage_management_policy" "backups" {
  storage_account_id = azurerm_storage_account.backups.id

  rule {
    name    = "expire-proto-backups"
    enabled = true

    filters {
      prefix_match = ["backups/proto-"]
      blob_types   = ["blockBlob"]
    }

    actions {
      base_blob {
        delete_after_days_since_modification_greater_than = 7
      }
    }
  }

  rule {
    name    = "expire-constellation-backups"
    enabled = true

    filters {
      prefix_match = ["backups/constellation/"]
      blob_types   = ["blockBlob"]
    }

    actions {
      base_blob {
        delete_after_days_since_modification_greater_than = 30
      }
    }
  }
}

# ── Role assignment: VM managed identity → Storage Blob Data Contributor ───────
# Allows backup.sh to upload via managed identity (no storage keys required).
resource "azurerm_role_assignment" "vm_backup_contributor" {
  scope                = azurerm_storage_account.backups.id
  role_definition_name = "Storage Blob Data Contributor"
  principal_id         = azurerm_user_assigned_identity.vm.principal_id
}
