output "vm_public_ip" {
  description = "Static public IP address of the VM — point your DNS zone nameservers here"
  value       = azurerm_public_ip.vm.ip_address
}

output "vm_id" {
  description = "Azure resource ID of the Linux VM"
  value       = azurerm_linux_virtual_machine.vm.id
}

output "vm_identity_principal_id" {
  description = "Principal ID of the VM's user-assigned managed identity (used for Key Vault + Blob RBAC)"
  value       = azurerm_user_assigned_identity.vm.principal_id
}

output "vm_identity_client_id" {
  description = "Client ID of the VM's user-assigned managed identity"
  value       = azurerm_user_assigned_identity.vm.client_id
}

output "dns_zone_name_servers" {
  description = "Name servers for the Azure DNS zone — configure these at your domain registrar"
  value       = azurerm_dns_zone.main.name_servers
}

output "dns_zone_name" {
  description = "Name of the Azure DNS zone (e.g. db.harebrained-apps.com)"
  value       = azurerm_dns_zone.main.name
}

output "key_vault_uri" {
  description = "URI of the Key Vault (e.g. https://kv-constellation.vault.azure.net/) — used by load-secrets.sh"
  value       = azurerm_key_vault.main.vault_uri
}

output "backups_storage_account_name" {
  description = "Name of the Azure Storage Account used for pg_dump backup archives"
  value       = azurerm_storage_account.backups.name
}

output "resource_group_name" {
  description = "Name of the resource group containing all resources"
  value       = azurerm_resource_group.main.name
}
