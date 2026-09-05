import { Prisma } from "@prisma/client";

import type { AiConfigurationSettings } from "@/features/ai-settings/schemas";
import type { AiConfigurationView } from "@/features/ai-settings/types";
import { prisma } from "@/server/db/prisma";
import type { AiConfigurationRepository } from "@/server/repositories/contracts/ai-configuration-repository";

import { mapAiModel, mapAiProvider } from "./mappers";

/**
 * Columns returned for the active configuration.
 *
 * `secretReference` is deliberately absent: the credential pointer is never
 * selected into a DTO, so no read path can leak it (S-01).
 */
const CONFIGURATION_FIELDS = {
  id: true,
  providerId: true,
  modelId: true,
  isActive: true,
  globalTokenLimit: true,
  defaultTenantTokenLimit: true,
  warningThresholdPercent: true,
  createdAt: true,
  updatedAt: true,
} as const;

export class PrismaAiConfigurationRepository implements AiConfigurationRepository {
  async findActive(): Promise<AiConfigurationView> {
    const [configuration, providers, models] = await Promise.all([
      prisma.platformAiConfiguration.findFirst({
        where: { isActive: true },
        select: CONFIGURATION_FIELDS,
        orderBy: { updatedAt: Prisma.SortOrder.desc },
      }),
      prisma.aiProvider.findMany({ orderBy: { name: Prisma.SortOrder.asc } }),
      prisma.aiModel.findMany({
        orderBy: { modelName: Prisma.SortOrder.asc },
      }),
    ]);

    const firstProvider = providers[0];
    const firstModel = models[0];

    return {
      configuration: configuration
        ? {
            id: configuration.id,
            providerId: configuration.providerId,
            modelId: configuration.modelId,
            isActive: configuration.isActive,
            globalTokenLimit:
              configuration.globalTokenLimit === null
                ? null
                : Number(configuration.globalTokenLimit),
            defaultTenantTokenLimit:
              configuration.defaultTenantTokenLimit === null
                ? null
                : Number(configuration.defaultTenantTokenLimit),
            warningThresholdPercent: configuration.warningThresholdPercent,
            // The stored value is a secret-manager pointer, not the key, and
            // is never read back — so there is no fingerprint to show.
            credentialFingerprint: null,
            credentialRotatedAt: configuration.updatedAt.toISOString(),
            updatedAt: configuration.updatedAt.toISOString(),
          }
        : {
            // No configuration row yet: render the form in an unconfigured
            // state rather than failing the page.
            id: "",
            providerId: firstProvider?.id ?? "",
            modelId: firstModel?.id ?? "",
            isActive: false,
            globalTokenLimit: null,
            defaultTenantTokenLimit: null,
            warningThresholdPercent: null,
            credentialFingerprint: null,
            credentialRotatedAt: null,
            updatedAt: new Date().toISOString(),
          },
      providers: providers.map(mapAiProvider),
      models: models.map(mapAiModel),
      tenantAllocationEnabled:
        configuration?.defaultTenantTokenLimit !== null &&
        configuration?.defaultTenantTokenLimit !== undefined,
      // Consumption needs the usage rollups from §2.2, which do not exist yet.
      currentTokenUsage: null,
      usageAsOf: null,
    };
  }

  async save(values: AiConfigurationSettings): Promise<void> {
    const existing = await prisma.platformAiConfiguration.findFirst({
      orderBy: { updatedAt: Prisma.SortOrder.desc },
      select: { id: true },
    });

    if (!existing) {
      // No row yet. `secret_reference` is NOT NULL but the credential belongs
      // in a secret manager that is not wired up, so an empty pointer is
      // written and the key remains unset (S-01 / D-24).
      await prisma.platformAiConfiguration.create({
        data: { ...values, secretReference: "" },
      });
      return;
    }

    await prisma.platformAiConfiguration.update({
      where: { id: existing.id },
      data: values,
    });
  }
}
