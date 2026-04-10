output "vm_public_ip" {
  description = "Public IP address of the VM"
  value       = azurerm_public_ip.vm.ip_address
}

output "vm_id" {
  description = "Resource ID of the VM"
  value       = azurerm_linux_virtual_machine.main.id
}

output "managed_identity_id" {
  description = "Resource ID of the VM's user-assigned managed identity"
  value       = azurerm_user_assigned_identity.vm.id
}

output "managed_identity_principal_id" {
  description = "Principal ID of the VM's managed identity (used for RBAC role assignments)"
  value       = azurerm_user_assigned_identity.vm.principal_id
}

output "managed_identity_client_id" {
  description = "Client ID of the VM's managed identity"
  value       = azurerm_user_assigned_identity.vm.client_id
}

output "dns_zone_name_servers" {
  description = "Name servers for the Azure DNS zone — configure these at your registrar"
  value       = azurerm_dns_zone.main.name_servers
}

output "resource_group_name" {
  description = "Name of the resource group"
  value       = azurerm_resource_group.main.name
}
