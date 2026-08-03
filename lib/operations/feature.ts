function enabled(value: string | undefined, fallback = true) {
  if (value == null || value === "") return fallback;
  return value !== "false" && value !== "0" && value !== "off";
}

export const operationsFeatures = {
  customerPortal: enabled(process.env.NEXT_PUBLIC_CUSTOMER_PORTAL_V1),
  instructorWorkspace: enabled(process.env.NEXT_PUBLIC_INSTRUCTOR_WORKSPACE_V1),
  operationsCenter: enabled(process.env.NEXT_PUBLIC_OPERATIONS_CENTER_V1),
  platformAdmin: enabled(process.env.NEXT_PUBLIC_PLATFORM_ADMIN_V1, false),
  certificateVerify: enabled(process.env.NEXT_PUBLIC_CERTIFICATE_VERIFY_V1),
  systemControlPlane: enabled(process.env.NEXT_PUBLIC_SYSTEM_CONTROL_PLANE_V2)
};
