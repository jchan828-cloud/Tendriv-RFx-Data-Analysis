import { createAnthropic } from "@ai-sdk/anthropic";
import { streamText, convertToModelMessages, type UIMessage } from "ai";
import { readFileSync } from "fs";
import { join } from "path";

const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY ?? "",
});

function loadSummary(): string {
  const files = [
    "agency_spend.json",
    "category_trends.json",
    "procurement_methods.json",
    "value_bands.json",
    "amendment_patterns.json",
  ];
  const parts: string[] = [];
  for (const f of files) {
    try {
      const raw = readFileSync(join(process.cwd(), "public", "data", f), "utf-8");
      const parsed = JSON.parse(raw);
      if (f === "agency_spend.json") {
        const top10 = (parsed as Array<{ entity: string; total_value: number; total_count: number }>)
          .slice(0, 10)
          .map((a) => `${a.entity}: $${(a.total_value / 1e6).toFixed(1)}M (${a.total_count} contracts)`);
        parts.push(`TOP 10 CONTRACTING ENTITIES BY VALUE:\n${top10.join("\n")}`);
      } else if (f === "category_trends.json") {
        parts.push(`CATEGORY TRENDS:\n${JSON.stringify(parsed, null, 1)}`);
      } else if (f === "procurement_methods.json") {
        const p = parsed as { methods: Array<{ method: string; count: number; value: number }>; criteria: Array<{ criteria: string; count: number }> };
        const methods = p.methods.map((m) => `${m.method}: ${m.count} contracts ($${(m.value / 1e6).toFixed(1)}M)`);
        const criteria = p.criteria.slice(0, 6).map((c) => `${c.criteria}: ${c.count}`);
        parts.push(`PROCUREMENT METHODS:\n${methods.join("\n")}\n\nSELECTION CRITERIA:\n${criteria.join("\n")}`);
      } else if (f === "value_bands.json") {
        const bands = (parsed as Array<{ band: string; count: number; value: number }>)
          .map((b) => `${b.band}: ${b.count} contracts ($${(b.value / 1e6).toFixed(1)}M)`);
        parts.push(`CONTRACT VALUE DISTRIBUTION:\n${bands.join("\n")}`);
      } else if (f === "amendment_patterns.json") {
        const p = parsed as { avg_value_premium_pct: number };
        parts.push(`AMENDMENT PATTERNS:\nAverage value premium from amendments: ${p.avg_value_premium_pct}%\nFull data: ${JSON.stringify(parsed)}`);
      }
    } catch {
      // file not ready — skip
    }
  }
  return parts.join("\n\n");
}

export async function POST(req: Request) {
  const { messages, context } = await req.json() as {
    messages: UIMessage[];
    context?: Record<string, string>;
  };

  const modelMessages = await convertToModelMessages(messages);
  const summary = loadSummary();
  const contextStr = context ? `\nCurrent dashboard context: ${JSON.stringify(context)}` : "";

  const system = `You are an expert procurement intelligence analyst for Canadian federal government contracting. You have access to aggregated data from 75921 contract records spanning fiscal years 2022-23 to 2025-26.

Use the data summary below to answer questions. Be specific with numbers. Format currency in CAD. Use compact notation ($1.2M, $340K). Keep answers concise and actionable — you are talking to a proposal manager or BD lead who needs quick, reliable intelligence.

If asked about specific contract details not in the summary, tell the user to use the Contract Table to search for those.

DATA SUMMARY:
${summary}${contextStr}

Focus on insights that help win RFPs: which agencies buy what, pricing patterns, procurement method trends, renewal windows, and competitive dynamics.`;

  const result = streamText({
    model: anthropic("claude-3-5-sonnet-20241022"),
    system,
    messages: modelMessages,
    maxOutputTokens: 800,
  });

  return result.toTextStreamResponse();
}
