variable "project_name" {
  description = "Project name used for resource naming (e.g. 'constellation')"
  type        = string
  default     = "constellation"
}

variable "environment" {
  description = "Environment name (e.g. 'prod', 'staging')"
  type        = string
  default     = "prod"
}

variable "location" {
  description = "Azure region for all resources"
  type        = string
  default     = "eastus2"
}

variable "vm_size" {
  description = "Azure VM size. B2ms = 2 vCPU/8 GB (~$44/mo). B4ms = 4 vCPU/16 GB (~$80/mo)."
  type        = string
  default     = "Standard_B2ms"
}

variable "vm_admin_username" {
  description = "Admin username for SSH access to the VM"
  type        = string
  default     = "azureuser"
}

variable "vm_ssh_public_key" {
  description = "SSH public key for VM admin user"
  type        = string
  sensitive   = true
}

variable "data_disk_size_gb" {
  description = "Size in GB for the VM data disk (Postgres data lives here)"
  type        = number
  default     = 64
}

variable "dns_zone_name" {
  description = "Azure DNS zone name (e.g. 'db.harebrained-apps.com')"
  type        = string
  default     = "db.harebrained-apps.com"
}
