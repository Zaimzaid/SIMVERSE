import {isWorkspaceRole, PERMISSIONS, permissionsForRole, type Permission, type WorkspaceRole} from "./roles";
const valid=new Set<string>(PERMISSIONS);
export function parseDeniedPermissions(value:string):Permission[] {
 try {const parsed:unknown=JSON.parse(value);
  return Array.isArray(parsed)?[...new Set(parsed.filter((item):item is Permission=>typeof item==="string" && valid.has(item)))]:[];
 } catch{return [];}
}
export function effectivePermissions(role:WorkspaceRole,deniedPermissions:string):Permission[]{
 const base=permissionsForRole(role);
 // Ownership cannot lose access through staff overrides.
 if(role==="OWNER")return base;
 const denied=new Set(parseDeniedPermissions(deniedPermissions));
 return base.filter(permission=>!denied.has(permission));
}
export function mayDeny(role:WorkspaceRole,permission:Permission):boolean {
 return isWorkspaceRole(role)&&role!=="OWNER"&&permissionsForRole(role).includes(permission);
}
