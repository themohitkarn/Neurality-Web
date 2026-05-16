import prisma from "../src/utils/prisma";


async function main() {
  console.log("Seeding test users into Postgres...");
  
  // Santa user (from SQLite)
  // Password in SQLite is 'northpole123'
  // We need to hash it for Postgres if we want login to work, 
  // but wait, the realtime server only checks the JWT token, it doesn't do login.
  // The login is done by the Flask backend.
  // The Flask backend issues a JWT.
  // The Realtime server verifies the JWT and then looks up the user in its own DB.
  
  const santa = await prisma.users.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      username: "santa",
      email: "santa@neurality.dev",
      password_hash: "hashed_password",
      full_name: "Santa Claus",
      bio: "Delivering joy, one post at a time.",
      account_type: "personal"
    }
  });

  const ginger = await prisma.users.upsert({
    where: { id: 2 },
    update: {},
    create: {
      id: 2,
      username: "ginger",
      email: "ginger@neurality.dev",
      password_hash: "hashed_password",
      full_name: "Ginger Cookies",
      bio: "Baking happiness.",
      account_type: "personal"
    }
  });

  console.log("Seeded users:", santa.username, ginger.username);

}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
