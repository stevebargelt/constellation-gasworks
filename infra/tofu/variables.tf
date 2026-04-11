variable "project_name" {
  description = "Short name for the project, used in all resource names (e.g. 'constellation')"
  type        = string
  default     = "constellation"
}

variable "resource_group_name" {
  description = "Name of the Azure resource group to create all resources in"
  type        = string
  default     = "rg-constellation"
}

variable "location" {
  description = "Azure region for all resources (e.g. 'eastus', 'westus2')"
  type        = string
  default     = "eastus"
}

variable "environment" {
  description = "Environment tag value (e.g. 'production', 'staging')"
  type        = string
  default     = "production"
}

variable "dns_zone_name" {
  description = "Root DNS zone to create in Azure DNS (e.g. 'db.harebrained-apps.com')"
  type        = string
  default     = "db.harebrained-apps.com"
}

variable "tfstate_storage_account" {
  description = "Name of the pre-bootstrapped Azure Storage Account holding OpenTofu remote state"
  type        = string
  # No default — must be supplied; created manually before first tofu init
}

variable "vm_admin_username" {
  description = "Linux admin username for the VM"
  type        = string
  default     = "azureuser"
}

variable "vm_ssh_public_key" {
  description = "SSH public key content for the VM admin user (not a path — the raw key string)"
  type        = string
  sensitive   = true
}

variable "vm_custom_data" {
  description = "Base64-encoded cloud-init user-data content for the VM (generated from infra/vm/cloud-init.yaml)"
  type        = string
  default     = null
}

variable "backups_storage_account_name" {
  description = "Name of the storage account to create for project backups"
  type        = string
}

variable "common_tags" {
  description = "Tags applied to all managed resources"
  type        = map(string)
  default = {
    project    = "constellation"
    managed_by = "opentofu"
  }
}
