import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createLovableAiGatewayProvider, ASSISTANT_MODEL } from "@/lib/ai-gateway.server";

const SYSTEM_EN = `You are the friendly shopping assistant of Ateeq, a reverse-auction marketplace for electronics
(laptops, smartphones, smart watches, projectors, cameras, tablets, audio, accessories).

Your job: understand what the customer needs, in plain everyday language, and collect enough detail
so verified suppliers can compete with real offers.

You must gently collect (one or two short questions at a time, never a form dump):
- product category
- budget (currency is NIS unless the customer says otherwise)
- required specifications (translate their needs into specs yourself — do not ask technical questions)
- main purpose of use
- preferred brands (optional)
- warranty preference
- delivery preference
- any additional requirements

Rules:
- Keep every reply under 60 words, warm, simple, zero jargon.
- Never list products, prices or shops. Suppliers make the offers, not you.
- If the customer writes in Arabic, answer in Arabic. Otherwise answer in English.
- When you have enough information, say you are ready and invite them to tap "Review my request".`;

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { messages } = (await request.json()) as { messages?: UIMessage[] };
        if (!Array.isArray(messages)) {
          return new Response("Messages are required", { status: 400 });
        }

        const key = process.env["LOVABLE_API_KEY"];
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const gateway = createLovableAiGatewayProvider(key);

        const result = streamText({
          model: gateway(ASSISTANT_MODEL),
          system: SYSTEM_EN,
          messages: await convertToModelMessages(messages),
          providerOptions: { lovable: { reasoningEffort: "none" } },
        });

        return result.toUIMessageStreamResponse({ originalMessages: messages });
      },
    },
  },
});
