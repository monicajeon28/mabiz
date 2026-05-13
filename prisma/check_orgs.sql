SELECT o.name as org_name, o.id as org_id, m.role, m."userId", m."displayName"
FROM "Organization" o
LEFT JOIN "OrganizationMember" m ON m."organizationId" = o.id
ORDER BY o.name, m.role
LIMIT 30;
