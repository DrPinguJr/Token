export class DevelopmentToolsDisabledError extends Error {
  public readonly code = "DEVELOPMENT_TOOLS_DISABLED";

  public constructor() {
    super("Tokenly development tools are disabled.");
    this.name = "DevelopmentToolsDisabledError";
  }
}

export function areDevelopmentToolsEnabled(
  configuredValue = process.env.NEXT_PUBLIC_TOKENLY_ENABLE_DEV_TOOLS,
): boolean {
  return configuredValue === "true";
}

export function assertDevelopmentToolsEnabled(): void {
  if (!areDevelopmentToolsEnabled()) {
    throw new DevelopmentToolsDisabledError();
  }
}
