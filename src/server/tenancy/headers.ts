/**
 * Headers middleware uses to pass its host analysis to the Node runtime.
 *
 * Both are stripped from every inbound request before being set, so a client
 * cannot forge a tenant by sending the header itself.
 */
export const TENANT_LABEL_HEADER = "x-tenant-label";
export const TENANT_HOST_HEADER = "x-tenant-host";
