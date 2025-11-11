-- Delete "Vendoweb" agency (without GmbH) from the database
-- This will only work if no clients are assigned to this agency

-- First, check if there are any clients assigned to this agency
SELECT c.id, c.name, c."customerNo", a.name as agency_name
FROM "Client" c
JOIN "Agency" a ON c."agencyId" = a.id
WHERE a.name = 'Vendoweb';

-- If the query above returns no results, it's safe to delete the agency
-- Delete the agency
DELETE FROM "Agency"
WHERE name = 'Vendoweb';
