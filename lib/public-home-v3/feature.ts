export function isPublicHomeV3Enabled() {
  return process.env.NEXT_PUBLIC_PUBLIC_HOME_V3 !== "false";
}
