import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateText, Output, NoObjectGeneratedError } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider, ASSISTANT_MODEL } from "@/lib/ai-gateway.server";

const schema = z.object({
  title: z.string(),
  category: z.string(),
  budget_min: z.number().nullable(),
  budget_max: z.number().nullable(),
  specs: z.array(z.string()),
  purpose: z.string().nullable(),
  brands: z.array(z.string()),
  warranty_preference: z.string().nullable(),
  delivery_preference: z.string().nullable(),
  notes: z.string().nullable(),
});

export type ExtractedRequest = z.infer<typeof schema>;

const EMPTY: ExtractedRequest = {
  title: "Electronics purchase request",
  category: "other",
  budget_min: null,
  budget_max: null,
  specs: [],
  purpose: null,
  brands: [],
  warranty_preference: null,
  delivery_preference: null,
  notes: null,
};

export const extractRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { transcript: string; lang: "en" | "ar" }) => input)
  .handler(async ({ data }) => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const gateway = createLovableAiGatewayProvider(key, { structuredOutputs: true });

    const prompt = `Convert this shopping conversation into one structured electronics purchase request.

Conversation:
${data.transcript}

Rules:
- category must be exactly one of: laptop, smartphone, smartwatch, projector, camera, tablet, audio, accessory, other.
- budgets are numbers in NIS; if only one number is mentioned treat it as the maximum.
- specs: up to 6 short concrete specification lines a supplier can match (e.g. "16GB RAM", "512GB SSD").
- title: a short human title, max 8 words, written in ${data.lang === "ar" ? "Arabic" : "English"}.
- Write all free text in ${data.lang === "ar" ? "Arabic" : "English"}.
- Use null when the customer never mentioned something. Never invent brands.`;

    try {
      const { output } = await generateText({
        model: gateway(ASSISTANT_MODEL),
        output: Output.object({ schema }),
        prompt,
        providerOptions: { lovable: { reasoningEffort: "none" } },
      });
      return {
        ...output,
        specs: output.specs.slice(0, 6),
        brands: output.brands.slice(0, 4),
      } satisfies ExtractedRequest;
    } catch (error) {
      if (NoObjectGeneratedError.isInstance(error)) {
        try {
          const raw = (error.text ?? "").replace(/```json|```/g, "").trim();
          return schema.parse(JSON.parse(raw));
        } catch {
          return EMPTY;
        }
      }
      throw error;
    }
  });
