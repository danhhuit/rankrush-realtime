import bcrypt from "bcryptjs";
import { closeRedis, connectRedis, redis } from "./redis.js";
import {
  createUser,
  getUser,
  getUserByEmail,
  getUserByUsername,
  keys,
} from "./store.js";
import type { User } from "./types.js";

const adminAccount = {
  username: "admin",
  email: "admin@rankrush.local",
  displayName: "Quản trị viên",
  password: "@dmin123",
} as const;

async function ensureAdmin() {
  await connectRedis();

  const [byUsername, byEmail, seededAdmin, legacySeedAdmin] = await Promise.all(
    [
      getUserByUsername(adminAccount.username),
      getUserByEmail(adminAccount.email),
      getUser("host-admin"),
      getUser("host-danhtn"),
    ],
  );

  if (byUsername && byEmail && byUsername.id !== byEmail.id)
    throw new Error(
      "Username admin và email admin@rankrush.local đang thuộc hai tài khoản khác nhau.",
    );

  const existing = byUsername || byEmail || seededAdmin || legacySeedAdmin;
  const passwordHash = await bcrypt.hash(adminAccount.password, 12);

  if (!existing) {
    const user: User = {
      id: "host-admin",
      username: adminAccount.username,
      email: adminAccount.email,
      displayName: adminAccount.displayName,
      passwordHash,
      rawPassword: adminAccount.password,
      role: "ADMIN",
      status: "ACTIVE",
      createdAt: new Date().toISOString(),
    };
    await createUser(user);
  } else {
    const tx = redis
      .multi()
      .hset(keys.user(existing.id), {
        username: adminAccount.username,
        email: adminAccount.email,
        displayName: adminAccount.displayName,
        passwordHash,
        role: "ADMIN",
        status: "ACTIVE",
      })
      .set(keys.userUsername(adminAccount.username), existing.id)
      .set(keys.userEmail(adminAccount.email), existing.id)
      .sadd(keys.users, existing.id);

    if (
      existing.username &&
      existing.username.toLowerCase() !== adminAccount.username
    )
      tx.del(keys.userUsername(existing.username));
    if (existing.email.toLowerCase() !== adminAccount.email)
      tx.del(keys.userEmail(existing.email));

    await tx.exec();
  }

  console.log("Đã thiết lập tài khoản quản trị:");
  console.log(`Username: ${adminAccount.username}`);
  console.log(`Password: ${adminAccount.password}`);
  console.log("Hãy đăng xuất và đăng nhập lại để nhận JWT ADMIN mới.");
}

ensureAdmin()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => void closeRedis());
