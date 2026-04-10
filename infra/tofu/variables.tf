# variables.tf — shared input variables for all modules

variable "resource_group_name" {
  description = "Name of the Azure resource group containing all resources"
  type        = string
}

variable "location" {
  description = "Azure region (e.g. eastus2)"
  type        = string
  default     = "eastus2"
}

variable "tfstate_storage_account_name" {
  description = "Name of the pre-existing storage account used for Terraform/OpenTofu state"
  type        = string
}

variable "backups_storage_account_name" {
  description = "Name of the storage account to create for project backups"
  type        = string
}

variable "vm_managed_identity_principal_id" {
  description = "Principal ID of the VM's user-assigned managed identity (for role assignments)"
  type        = string
}

variable "common_tags" {
  description = "Tags applied to all managed resources"
  type        = map(string)
  default = {
    project     = "constellation"
    managed_by  = "opentofu"
  }
}
