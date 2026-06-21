import fs from "node:fs";

export function loadEnvFiles(paths, { override = false } = {}) {
  const loaded = [];

  for (const envPath of paths) {
    if (!envPath || !fs.existsSync(envPath)) {
      continue;
    }

    const values = parseEnv(fs.readFileSync(envPath, "utf8"));
    for (const [key, value] of Object.entries(values)) {
      if (override || process.env[key] === undefined) {
        process.env[key] = value;
      }
    }

    loaded.push(envPath);
  }

  return loaded;
}

function parseEnv(text) {
  return text.split(/\r?\n/).reduce((values, rawLine) => {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      return values;
    }

    const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_-]*)\s*=\s*(.*)$/);
    if (!match) {
      return values;
    }

    values[match[1]] = parseValue(match[2]);
    return values;
  }, {});
}

function parseValue(rawValue) {
  const value = rawValue.trim();

  if (!value) {
    return "";
  }

  if (value.startsWith('"') && value.endsWith('"')) {
    try {
      return JSON.parse(value);
    } catch {
      return value.slice(1, -1);
    }
  }

  if (value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1);
  }

  return value.replace(/\s+#.*$/, "").trim();
}
