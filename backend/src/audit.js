export async function recordAdminAudit(client, adminId, action, resourceType, resourceId = null, details = {}) {
  await client.query(
    `INSERT INTO audit_events (admin_id, action, resource_type, resource_id, details)
     VALUES ($1, $2, $3, $4, $5::jsonb)`,
    [adminId, action, resourceType, resourceId ? String(resourceId) : null, JSON.stringify(details)],
  );
}
