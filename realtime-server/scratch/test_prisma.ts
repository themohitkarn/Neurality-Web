import prisma from "../src/utils/prisma";

async function main() {
  console.log("Attempting to connect via adapter...");
  const users = await prisma.users.findMany({ take: 1 });
  console.log("Success! Users found:", users.length);
}

main()
  .catch((e) => {
    console.error("Connection failed!");
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
