import { readFileSync } from "node:fs";
import { GetBucketCorsCommand, PutBucketCorsCommand, S3Client } from "@aws-sdk/client-s3";

function loadLocalEnvironment() {
  let source = "";
  try { source = readFileSync(".env.local", "utf8"); }
  catch { return; }
  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    const name = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (process.env[name] === undefined) process.env[name] = value;
  }
}

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

loadLocalEnvironment();

const accountId = required("R2_ACCOUNT_ID");
const bucket = required("R2_BUCKET");
const appOrigin = new URL(required("NEXT_PUBLIC_APP_URL")).origin;
const extraOrigins = (process.env.R2_CORS_ADDITIONAL_ORIGINS ?? "http://localhost:3000")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean)
  .map((value) => new URL(value).origin);
const allowedOrigins = [...new Set([appOrigin, ...extraOrigins])];
const ruleId = "h2obook-browser-assets";
const managedRule = {
  ID: ruleId,
  AllowedOrigins: allowedOrigins,
  AllowedMethods: ["GET", "PUT", "HEAD"],
  AllowedHeaders: ["content-type"],
  ExposeHeaders: ["etag"],
  MaxAgeSeconds: 3600
};

if (!process.argv.includes("--apply")) {
  console.log(JSON.stringify({ applied: false, bucket, rule: managedRule, hint: "Run again with --apply using credentials that can manage bucket CORS." }, null, 2));
  process.exit(0);
}

const client = new S3Client({
  region: "auto",
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: required("R2_ACCESS_KEY_ID"),
    secretAccessKey: required("R2_SECRET_ACCESS_KEY")
  }
});

try {
  let currentRules = [];
  try {
    const current = await client.send(new GetBucketCorsCommand({ Bucket: bucket }));
    currentRules = current.CORSRules ?? [];
  } catch (error) {
    const status = error?.$metadata?.httpStatusCode;
    if (status === 403) {
      throw new Error("R2 credentials cannot manage bucket CORS. Apply the previewed rule in Cloudflare Dashboard, or use an R2 Admin Read & Write token.");
    }
    if (status !== 404 && error?.name !== "NoSuchCORSConfiguration") throw error;
  }

  const nextRules = [...currentRules.filter((rule) => rule.ID !== ruleId), managedRule];
  await client.send(new PutBucketCorsCommand({ Bucket: bucket, CORSConfiguration: { CORSRules: nextRules } }));
  console.log(JSON.stringify({ applied: true, bucket, ruleId, allowedOrigins }, null, 2));
} finally {
  client.destroy();
}
