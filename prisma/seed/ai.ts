/** AI providers, models and the active platform configuration. */
import { AiProviderStatus, AiPurpose } from "@prisma/client";

import { prisma } from "./client";

/**
 * `ai_providers.name` is not unique in the design, so this cannot upsert on it.
 * It looks the row up first instead, which keeps the seed idempotent without
 * adding a constraint the source SQL does not have.
 */
async function upsertProvider(
  name: string,
  status: AiProviderStatus,
  baseUrl: string | null,
): Promise<{ readonly id: string }> {
  const existing = await prisma.aiProvider.findFirst({
    where: { name },
    select: { id: true },
  });

  if (existing !== null) {
    return prisma.aiProvider.update({
      where: { id: existing.id },
      data: { status, baseUrl },
      select: { id: true },
    });
  }

  return prisma.aiProvider.create({
    data: { name, status, baseUrl },
    select: { id: true },
  });
}

/**
 * The models an AI usage row points at.
 *
 * `ai_usage_logs.provider_id` and `.model_id` in a tenant database are bare
 * UUIDs referencing this master catalogue, because Postgres cannot express a
 * cross-database foreign key. Returning them here is what lets the tenant seed
 * write rows that resolve against real models rather than invented ids.
 */
export interface SeededAiCatalogue {
  readonly providerId: string;
  readonly chatModelId: string;
  readonly embeddingModelId: string;
}

export async function seedAi(): Promise<SeededAiCatalogue> {
  const openai = await upsertProvider(
    "OpenAI",
    AiProviderStatus.ACTIVE,
    "https://api.openai.com/v1",
  );
  const anthropic = await upsertProvider(
    "Anthropic",
    AiProviderStatus.ACTIVE,
    "https://api.anthropic.com/v1",
  );
  await upsertProvider("Google", AiProviderStatus.INACTIVE, null);

  const models = [
    {
      aiProviderId: openai.id,
      modelName: "gpt-4o",
      purpose: AiPurpose.CHAT,
      capabilities: ["chat", "tools", "vision"],
      contextWindow: 128_000,
      inputCostPerMtok: "2.5000",
      outputCostPerMtok: "10.0000",
      embeddingDimensions: null,
    },
    {
      aiProviderId: openai.id,
      modelName: "text-embedding-3-small",
      purpose: AiPurpose.EMBEDDING,
      capabilities: ["embedding"],
      contextWindow: 8_191,
      inputCostPerMtok: "0.0200",
      outputCostPerMtok: "0.0000",
      embeddingDimensions: 1_536,
    },
    {
      aiProviderId: anthropic.id,
      modelName: "claude-sonnet-5",
      purpose: AiPurpose.CHAT,
      capabilities: ["chat", "tools", "vision"],
      contextWindow: 200_000,
      inputCostPerMtok: "3.0000",
      outputCostPerMtok: "15.0000",
      embeddingDimensions: null,
    },
  ] as const;

  for (const model of models) {
    const fields = {
      purpose: model.purpose,
      capabilities: [...model.capabilities],
      contextWindow: model.contextWindow,
      inputCostPerMtok: model.inputCostPerMtok,
      outputCostPerMtok: model.outputCostPerMtok,
      embeddingDimensions: model.embeddingDimensions,
      isActive: true,
    };

    await prisma.aiModel.upsert({
      where: {
        aiProviderId_modelName: {
          aiProviderId: model.aiProviderId,
          modelName: model.modelName,
        },
      },
      update: fields,
      create: {
        aiProviderId: model.aiProviderId,
        modelName: model.modelName,
        ...fields,
      },
    });
  }

  const defaultModel = await prisma.aiModel.findFirstOrThrow({
    where: { aiProviderId: openai.id, modelName: "gpt-4o" },
    select: { id: true },
  });

  const embeddingModel = await prisma.aiModel.findFirstOrThrow({
    where: { aiProviderId: openai.id, modelName: "text-embedding-3-small" },
    select: { id: true },
  });

  const active = await prisma.platformAiConfiguration.findFirst({
    where: { isActive: true },
    select: { id: true },
  });

  if (active === null) {
    await prisma.platformAiConfiguration.create({
      data: {
        providerId: openai.id,
        modelId: defaultModel.id,
        purpose: AiPurpose.CHAT,
        // A pointer into the secret manager. The key itself never lives here.
        secretReference: "secret://platform-ai/openai/api-key",
        isActive: true,
        isDefault: true,
        globalTokenLimit: BigInt(1_000_000),
        tenantAllocationEnabled: true,
        defaultTenantTokenLimit: BigInt(50_000),
        warningThresholdPercent: 80,
      },
    });
  }

  return {
    providerId: openai.id,
    chatModelId: defaultModel.id,
    embeddingModelId: embeddingModel.id,
  };
}
