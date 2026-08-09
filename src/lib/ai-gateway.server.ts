import { createAnthropic } from "@ai-sdk/anthropic";

/**
 * The AI assistant used to run through Lovable's own AI Gateway
 * (ai.gateway.lovable.dev), which is billed against Lovable's own credit
 * balance — meaning the feature broke the moment those credits ran out,
 * with zero control from inside this codebase. This now calls Anthropic
 * directly instead, using an API key the project owner controls themselves
 * (set ANTHROPIC_API_KEY as an environment variable / secret in Lovable
 * Cloud's project settings — completely independent of Lovable's own
 * credit system).
 */
export function createAssistantProvider(apiKey: string) {
  return createAnthropic({ apiKey });
}

export const ASSISTANT_MODEL = "claude-sonnet-5";
