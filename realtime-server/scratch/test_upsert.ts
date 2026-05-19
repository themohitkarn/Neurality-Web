import prisma from "../src/utils/prisma";

async function main() {
  console.log("Inspecting unique constraints on 'chat_settings'...");
  try {
    const indexes: any[] = await prisma.$queryRaw`
      SELECT indexname, indexdef 
      FROM pg_indexes 
      WHERE tablename = 'chat_settings'
    `;
    console.log("Indexes on 'chat_settings':");
    console.log(indexes);

    const pkey: any[] = await prisma.$queryRaw`
      SELECT a.attname
      FROM pg_index i
      JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
      WHERE i.indrelid = 'chat_settings'::regclass AND i.indisprimary
    `;
    console.log("Primary Key columns:");
    console.log(pkey);
  } catch (err: any) {
    console.error("❌ RAW QUERY FAILED:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
