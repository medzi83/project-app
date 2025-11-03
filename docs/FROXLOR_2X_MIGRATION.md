# Froxlor 2.x Migration - API Parameter Changes

## Problem

After upgrading from Froxlor 1.9 to Froxlor 2.1.9, customer creation failed with:

```
HTTP 400: Kunde hat PHP aktiviert aber keine PHP-Konfiguration wurde gewählt.
```

Even though a PHP configuration was selected in the form.

## Root Cause

Froxlor 2.x changed the API parameter requirements for PHP configuration:

1. **Parameter name changed**:
   - **Froxlor 1.9**: Used `phpsettings` parameter
   - **Froxlor 2.x**: Uses `allowed_phpconfigs` parameter

2. **Parameter format changed**:
   - **Froxlor 1.9**: Expected JSON string like `"[10]"`
   - **Froxlor 2.x**: Expects actual array like `[10]`

## Solution

Updated the following files to use the correct Froxlor 2.x API parameters:

### 1. [lib/froxlor.ts](../lib/froxlor.ts)

**Changed line 448**:
```typescript
// Before (Froxlor 1.9)
apiParams.phpsettings = data.allowed_phpconfigs;

// After (Froxlor 2.x)
apiParams.allowed_phpconfigs = data.allowed_phpconfigs;
```

**Updated TypeScript type (line 174-178)**:
```typescript
// Before
export type FroxlorCustomerUpdateInput = Partial<Omit<FroxlorCustomerCreateInput, 'password' | 'loginname' | 'allowed_phpconfigs'>> & {
  password?: string;
  loginname?: string;
  phpsettings?: string; // Use phpsettings for update instead of allowed_phpconfigs
};

// After
export type FroxlorCustomerUpdateInput = Partial<Omit<FroxlorCustomerCreateInput, 'password' | 'loginname'>> & {
  password?: string;
  loginname?: string;
  // Note: allowed_phpconfigs is now included from FroxlorCustomerCreateInput (Froxlor 2.x uses same parameter for update)
};
```

### 2. [app/admin/basisinstallation/actions.ts](../app/admin/basisinstallation/actions.ts)

**Changed line 279-280** (Critical fix):
```typescript
// Before (Froxlor 1.9) - JSON string format
const allowed_phpconfigs = phpConfigIds.length > 0 ? `[${phpConfigIds.join(",")}]` : "[1]";
// Result: "[10]" (string)

// After (Froxlor 2.x) - Array format
const allowed_phpconfigs = phpConfigIds.length > 0 ? phpConfigIds.map(id => parseInt(id)) : [1];
// Result: [10] (array of numbers)
```

**Updated customer creation (line 345)**:
```typescript
const createData: FroxlorCustomerCreateInput = {
  // ... other fields
  allowed_phpconfigs,
  phpenabled: 1, // Must be explicitly set when providing PHP configs
  leregistered: leregistered ? 1 : 0,
};
```

**Updated customer update (line 318-319)**:
```typescript
const updateData: FroxlorCustomerUpdateInput = {
  // ... other fields
  allowed_phpconfigs, // Fixed: Use allowed_phpconfigs for Froxlor 2.x
  phpenabled: 1, // Enable PHP explicitly
  leregistered: leregistered ? 1 : 0,
};
```

## Froxlor 2.x API Documentation

According to the official [Froxlor 2.x API documentation](https://docs.froxlor.org/v2/api-guide/commands/customers.html):

### Customers.add & Customers.update Parameters

**phpenabled** (bool, optional)
- Default: `0` (false)
- Description: Whether to allow usage of PHP
- **Important**: Must be explicitly set to `1` when providing `allowed_phpconfigs`

**allowed_phpconfigs** (array, optional)
- Default: empty (none)
- Description: Array of IDs of php-config that the customer is allowed to use
- **Format**: `[1, 10, 15]` (array of integers, NOT a JSON string like `"[1,10,15]"`)

## Testing

1. Select a PHP configuration in the customer form
2. Create a new customer
3. Verify that the customer is created successfully without HTTP 400 error
4. Check that the customer has PHP enabled with the selected configuration

## Debug Logging

Added comprehensive debug logging to trace the data flow:

```typescript
// In CustomerForm.tsx (UI)
console.log('DEBUG: selectedPhpConfigs =', selectedPhpConfigs);

// In actions.ts (Server Action)
console.log('[DEBUG createOrUpdateFroxlorCustomer] PHP Config IDs:', phpConfigIds);
console.log('[DEBUG createOrUpdateFroxlorCustomer] allowed_phpconfigs:', allowed_phpconfigs);

// In lib/froxlor.ts (API Client)
console.log('[DEBUG FroxlorClient.createCustomer] data.allowed_phpconfigs:', data.allowed_phpconfigs);
console.log('[DEBUG FroxlorClient.createCustomer] data.phpenabled:', data.phpenabled);
console.log('[DEBUG FroxlorClient.createCustomer] Final apiParams:', JSON.stringify(apiParams, null, 2));
```

These debug logs can be removed once the fix is confirmed working in production.

## MySQL Server Assignment

### Problem
When creating a customer in Froxlor, only the "Default" MySQL server was assigned, even when additional servers like "MariaDB 10.5" were available.

### Solution
Added automatic assignment of **all available MySQL servers** to customers:

1. **New API method**: `getMysqlServers()` - Fetches all available MySQL servers from Froxlor
2. **Automatic assignment**: During customer creation/update, all MySQL server IDs are retrieved and assigned via `allowed_mysqlserver` parameter

**Code changes**:
- [lib/froxlor.ts](../lib/froxlor.ts): Added `getMysqlServers()` method and `FroxlorMysqlServer` type
- [actions.ts](../app/admin/basisinstallation/actions.ts): Fetch and assign all MySQL servers during create/update

```typescript
// Fetch all available MySQL servers
const mysqlServers = await client.getMysqlServers();
const allowed_mysqlserver = mysqlServers.map(server => server.id);

// Assign to customer
const createData: FroxlorCustomerCreateInput = {
  // ... other fields
  allowed_mysqlserver, // Assign all available MySQL servers (Default + MariaDB 10.5, etc.)
};
```

## MySQL Database Server Selection

### Problem
When creating a MySQL database via Froxlor API, the `dbserver` parameter was ignored and databases were always created on the Default MySQL server (localhost), even when MariaDB 10.5 was explicitly selected.

### Root Cause
Froxlor 2.x changed the API parameter name for database server selection:
- **Froxlor 1.9**: Used `dbserver` parameter
- **Froxlor 2.x**: Uses `mysql_server` parameter

### Solution
Updated [lib/froxlor.ts](../lib/froxlor.ts) `createDatabase()` method (line 758):

```typescript
// Before (Froxlor 1.9)
params.dbserver = dbServerId;

// After (Froxlor 2.x)
params.mysql_server = dbServerId;
```

### Testing
1. Create a test database with MariaDB 10.5 selected (ID 1)
2. Verify in Froxlor that the database was created on MariaDB 10.5, not Default
3. Create a test database with Default selected (ID 0)
4. Verify in Froxlor that the database was created on Default

### API Documentation Reference
According to [Froxlor 2.x API docs](https://docs.froxlor.org/latest/api-guide/commands/mysqls.html):

**mysql_server** (int, optional)
- Default: `0`
- Description: ID of the MySQL server instance to use for database creation
- Format: Integer (e.g., `0` for Default, `1` for MariaDB 10.5)

## Version History

- **v2.2.5** (2025-02-03): Fixed MySQL server selection in database creation
  - Changed `dbserver` → `mysql_server` parameter for MySQLs.add API call
  - Databases are now created on the correct MySQL server instance
  - Fixes issue where all databases were created on Default server regardless of selection

- **v2.2.4** (2025-02-01): Added automatic MySQL server assignment
  - New `getMysqlServers()` API method
  - All available MySQL servers are now assigned to customers automatically
  - Fixes issue where only Default MySQL server was assigned

- **v2.2.3** (2025-02-01): Fixed Froxlor 2.x API compatibility
  - Changed `phpsettings` → `allowed_phpconfigs` for customer creation and update
  - Added explicit `phpenabled: 1` parameter
  - Updated TypeScript types

## Related Issues

- User reported: "vorher bei froxlor 1.9 ging es noch, aber seit der umstellung auf 2.1.9 nicht mehr"
- Error: "HTTP 400: Kunde hat PHP aktiviert aber keine PHP-Konfiguration wurde gewählt"

## References

- [Froxlor 2.x API - Customers Commands](https://docs.froxlor.org/v2/api-guide/commands/customers.html)
- [Froxlor 2.x API - PhpSettings Commands](https://docs.froxlor.org/latest/api-guide/commands/phpsettings.html)
