export interface FeatureFlag {
  readonly id: string;
  readonly key: string;
  readonly description: string;
  readonly isEnabledByDefault: boolean;
}

export interface PlatformConfiguration {
  readonly id: string;
  readonly maintenanceMode: boolean;
  readonly supportEmail: string;
  readonly updatedAt: string;
}
