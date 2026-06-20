import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(__dirname, "..", "data");
const usersPath = path.join(dataDir, "users.json");

export function normalizeUsername(username) {
  return username.trim().toLowerCase();
}

export function createUser({ username, pin }) {
  const normalizedUsername = normalizeUsername(username);
  const users = loadUsers();

  if (users.some((user) => user.username === normalizedUsername)) {
    const error = new Error("Username is already taken");
    error.statusCode = 409;
    throw error;
  }

  const user = {
    id: crypto.randomUUID(),
    role: "user",
    username: normalizedUsername,
    pin_hash: hashPin(pin),
    created_at: new Date().toISOString()
  };

  saveUsers([...users, user]);

  return toPublicUser(user);
}

export function findUserByCredentials(username, pin) {
  const normalizedUsername = normalizeUsername(username);
  const user = loadUsers().find((candidate) => candidate.username === normalizedUsername);

  if (!user || !verifyPin(pin, user.pin_hash)) {
    return null;
  }

  return toPublicUser(user);
}

export function userExists(username) {
  const normalizedUsername = normalizeUsername(username);

  return loadUsers().some((user) => user.username === normalizedUsername);
}

export function updateUserPin(username, currentPin, newPin) {
  const normalizedUsername = normalizeUsername(username);
  const users = loadUsers();
  const index = users.findIndex((user) => user.username === normalizedUsername);

  if (index === -1) {
    const error = new Error("Password changes are not available for this account");
    error.statusCode = 403;
    throw error;
  }

  if (!verifyPin(currentPin, users[index].pin_hash)) {
    const error = new Error("Current PIN is incorrect");
    error.statusCode = 403;
    throw error;
  }

  users[index] = {
    ...users[index],
    pin_hash: hashPin(newPin)
  };
  saveUsers(users);

  return toPublicUser(users[index]);
}

export function isDemoCredentialUser(username) {
  return normalizeUsername(username) === normalizeUsername(process.env.ZORDER_USER_USERNAME ?? "user");
}

function loadUsers() {
  if (!fs.existsSync(usersPath)) {
    return [];
  }

  return JSON.parse(fs.readFileSync(usersPath, "utf8"));
}

function saveUsers(users) {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(usersPath, `${JSON.stringify(users, null, 2)}\n`, "utf8");
}

function hashPin(pin) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(pin, salt, 32).toString("hex");

  return `scrypt$${salt}$${hash}`;
}

function verifyPin(pin, storedHash) {
  const [scheme, salt, hash] = storedHash.split("$");
  if (scheme !== "scrypt" || !salt || !hash) {
    return false;
  }

  const candidate = crypto.scryptSync(pin, salt, 32);
  const expected = Buffer.from(hash, "hex");

  return expected.length === candidate.length && crypto.timingSafeEqual(expected, candidate);
}

function toPublicUser(user) {
  return {
    id: user.id,
    role: user.role,
    username: user.username,
    created_at: user.created_at
  };
}
