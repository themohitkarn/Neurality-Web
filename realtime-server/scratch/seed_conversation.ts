import prisma from "../src/utils/prisma";

async function main() {
  console.log("Creating conversation between Santa and Ginger...");
  
  const conversation = await prisma.conversations.create({
    data: {
      type: "direct",
      members: {
        create: [
          { user_id: 1 },
          { user_id: 2 }
        ]
      }
    }
  });

  console.log("Created conversation:", conversation.id);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
