/** AI providers, models and the active platform configuration (screen 09). */

import { AiProviderStatus } from "@prisma/client";
import { prisma } from "./client";

export async function seedAi(): Promise<void> {
  const openai = await prisma.aiProvider.upsert({
    where: { name: "OpenAI" },
    update: {},
    create: { name: "OpenAI", status: AiProviderStatus.ACTIVE },
  });
  const anthropic = await prisma.aiProvider.upsert({
    where: { name: "Anthropic" },
    update: {},
    create: { name: "Anthropic", status: AiProviderStatus.ACTIVE },
  });
  await prisma.aiProvider.upsert({
    where: { name: "Google" },
    update: {},
    create: { name: "Google", status: AiProviderStatus.INACTIVE },
  });

  const models = [
    {
      providerId: openai.id,
      modelName: "gpt-4o",
      capabilities: ["chat", "tools", "vision"],
    },
    {
      providerId: openai.id,
      modelName: "gpt-4o-mini",
      capabilities: ["chat", "tools"],
    },
    {
      providerId: anthropic.id,
      modelName: "claude-sonnet-5",
      capabilities: ["chat", "tools", "vision"],
    },
  ] as const;

  for (const model of models) {
    await prisma.aiModel.upsert({
      where: {
        providerId_modelName: {
          providerId: model.providerId,
          modelName: model.modelName,
        },
      },
      update: {},
      create: {
        providerId: model.providerId,
        modelName: model.modelName,
        capabilities: [...model.capabilities],
        isActive: true,
      },
    });
  }

  const defaultModel = await prisma.aiModel.findFirstOrThrow({
    where: { providerId: openai.id, modelName: "gpt-4o" },
  });

  const activeConfiguration = await prisma.platformAiConfiguration.findFirst({
    where: { isActive: true },
  });

  if (!activeConfiguration) {
    await prisma.platformAiConfiguration.create({
      data: {
        providerId: openai.id,
        modelId: defaultModel.id,
        // A pointer into the secret manager. The key itself never lives here.
        secretReference: "secret://platform-ai/openai/api-key",
        isActive: true,
        globalTokenLimit: BigInt(1_000_000),
        defaultTenantTokenLimit: BigInt(50_000),
        warningThresholdPercent: 80,
      },
    });
  }
}
