const { Client } = require("pg");

async function main() {
  const client = new Client({
    connectionString: "postgresql://neondb_owner:npg_KMv0fgUqdH9N@ep-rough-mountain-ao1v22q0.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"
  });
  await client.connect();
  console.log("Connected to PostgreSQL successfully!");
  
  const res = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'cached_conversation_snapshots'
  `);
  console.log("Columns of 'cached_conversation_snapshots':");
  console.log(res.rows);
  
  await client.end();
}

main().catch(err => {
  console.error("Error inspecting database:", err);
});
