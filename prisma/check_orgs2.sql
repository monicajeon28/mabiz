SELECT o.name, o.id, m.role, m."userId", m."displayName"
FROM "Organization" o
JOIN "OrganizationMember" m ON m."organizationId" = o.id
WHERE m.role = 'OWNER'
ORDER BY o.name;
