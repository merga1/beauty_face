import { pool } from "./src/db.js";

try {
  const result = await pool.query(`
    SELECT
      current_database() AS database_name,
      current_schema() AS schema_name,
      current_user AS database_user,
      inet_server_addr()::text AS server_ip,
      (SELECT COUNT(*) FROM public.admin_users) AS admin_count
  `);

  console.log("LOCAL DATABASE RESULT:");
  console.table(result.rows);
} catch (error) {
  console.error("Database error:", error.message);
} finally {
  await pool.end();
}
