import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const profilesPath = path.join(path.resolve(__dirname, "..", "data"), "user-profiles.json");

const emptyProfile = {
  first_name: "",
  last_name: "",
  email: "",
  contact: ""
};

export function getUserProfile(username) {
  const normalizedUsername = username.trim().toLowerCase();
  const profiles = loadProfiles();

  return {
    username: normalizedUsername,
    ...emptyProfile,
    ...(profiles[normalizedUsername] ?? {})
  };
}

export function saveUserProfile(username, profile) {
  const normalizedUsername = username.trim().toLowerCase();
  const profiles = loadProfiles();
  const nextProfile = {
    first_name: profile.first_name.trim(),
    last_name: profile.last_name.trim(),
    email: profile.email.trim(),
    contact: profile.contact.trim()
  };

  profiles[normalizedUsername] = nextProfile;
  saveProfiles(profiles);

  return {
    username: normalizedUsername,
    ...nextProfile
  };
}

export function formatProfileDisplayName(profile, username) {
  const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim();
  if (fullName) {
    return fullName;
  }

  return username;
}

function loadProfiles() {
  if (!fs.existsSync(profilesPath)) {
    return {};
  }

  return JSON.parse(fs.readFileSync(profilesPath, "utf8"));
}

function saveProfiles(profiles) {
  fs.mkdirSync(path.dirname(profilesPath), { recursive: true });
  fs.writeFileSync(profilesPath, `${JSON.stringify(profiles, null, 2)}\n`, "utf8");
}
