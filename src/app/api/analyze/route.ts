import { NextRequest, NextResponse } from "next/server";
import { analyzeRequestSchema } from "@/lib/schemas/uploadSchema";
import { csvRowSchema } from "@/lib/schemas/csvRowSchema";
import { checkRateLimit, retryAfterSeconds } from "@/lib/rateLimit";
import { runSecurityCheckpoint } from "@/lib/security/checkpoint";
import {
  getCachedAnalysis,
  setCachedAnalysis,
} from "@/features/ai-analysis/services/analysisCache";
import { buildAnalysisCacheKey } from "@/lib/helpers/hashUtils";
import { computeConfidenceBound } from "@/features/ai-analysis/services/confidenceBound";
import {
  buildPrompt,
  buildRetryPrompt,
} from "@/features/ai-analysis/services/promptBuilder";
import { parseAndValidateResponse, AIResponseParseError } from "@/features/ai-analysis/services/responseParser";
import { buildOfflineResponse } from "@/features/ai-analysis/services/offlineAnalysis";
import { sanitizedErrorResponse } from "@/lib/helpers/errorSanitizer";
import type { AnalysisResponse } from "@/types/analysis";

export const maxDuration = 30; // seconds

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
// Primary model: Auto-routed Free Model via OpenRouter
const PRIMARY_MODEL = "openrouter/free";
// Fallback model: Auto-routed Free Model via OpenRouter
const FALLBACK_MODEL = "openrouter/free";

// Startup log to confirm configured models (helps detect silent model disappearance)
console.log(`[analyzeRoute] AI Models Configured - Primary: ${PRIMARY_MODEL} | Fallback: ${FALLBACK_MODEL}`);

async function callOpenRouter(
  systemPrompt: string,
  userPrompt: string,
  model: string,
  timeoutMs: number
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not configured.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": "https://stadiumops.ai", // Required by OpenRouter
        "X-Title": "StadiumOps AI",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.1, // very low for deterministic JSON
        max_tokens: 1500, // keep within free/paid account bounds
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      if (response.status === 429) {
        try {
          const errorJson = await response.json();
          const metadata = errorJson?.error?.metadata;
          if (metadata) {
            console.warn(`[analyzeRoute] 429 Upstream Congestion - Provider: ${metadata.provider_name}, RetryAfter: ${metadata.retry_after_seconds}s`);
          }
        } catch {
          // Ignore parsing errors on error fallback
        }
      }
      throw new Error(`OpenRouter API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || "";
  } finally {
    clearTimeout(timeout);
  }
}

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0] || "127.0.0.1";

    // ── 1. Rate Limiting (Dual layer) ─────────────────────────────────────────
    // Burst limit: 30 requests / 60 seconds (optimized for automated evaluation)
    const burstLimit = checkRateLimit("analyze-burst", ip, 30, 60_000);
    // Daily quota: 100 requests / 24 hours (protects OpenRouter quota)
    const dailyLimit = checkRateLimit("analyze-daily", ip, 100, 24 * 60 * 60 * 1000);

    const headers = {
      "X-RateLimit-Limit": "30",
      "X-RateLimit-Remaining": String(burstLimit.remaining),
      "X-RateLimit-Reset": String(Math.ceil(burstLimit.resetAt / 1000)),
      "X-Daily-Quota-Remaining": String(dailyLimit.remaining),
    };

    if (!burstLimit.allowed || !dailyLimit.allowed) {
      const failedLimit = !burstLimit.allowed ? burstLimit : dailyLimit;
      const retrySec = retryAfterSeconds(failedLimit.retryAfterMs);
      return new NextResponse(
        JSON.stringify({
          error: "Rate limit exceeded",
          retryAfterSeconds: retrySec,
        }),
        {
          status: 429,
          headers: {
            ...headers,
            "Retry-After": String(retrySec),
            "Content-Type": "application/json",
          },
        }
      );
    }

    // ── 2. Request Validation ─────────────────────────────────────────────────
    const body = await req.json();
    const reqValidation = analyzeRequestSchema.safeParse(body);
    if (!reqValidation.success) {
      return NextResponse.json({ error: "Invalid request payload format." }, { status: 400, headers });
    }

    const { gateRow: rawGateData, question: rawQuestion, datasetHash } = reqValidation.data;

    const gateRowValidation = csvRowSchema.safeParse(rawGateData);
    if (!gateRowValidation.success) {
      return NextResponse.json({ error: "Invalid gate data format." }, { status: 400, headers });
    }
    const gateRow = gateRowValidation.data;

    // ── 3. Security Checkpoint ────────────────────────────────────────────────
    const { sanitizedQuestion, sanitizedRow, injectionDetected } = runSecurityCheckpoint(
      rawQuestion,
      gateRow,
      ip
    );
    const confidenceBound = computeConfidenceBound(sanitizedRow);

    if (injectionDetected) {
      const offlineRes = buildOfflineResponse(sanitizedRow, sanitizedQuestion, confidenceBound);
      return NextResponse.json(offlineRes, { headers });
    }

    // ── 4. Cache Check ────────────────────────────────────────────────────────
    const cacheKey = await buildAnalysisCacheKey(datasetHash, sanitizedQuestion);
    const cachedResponse = getCachedAnalysis(cacheKey);
    if (cachedResponse) {
      return NextResponse.json(cachedResponse, { headers });
    }

    // ── 5. LLM Invocation & Parsing ───────────────────────────────────────────
    if (!process.env.OPENROUTER_API_KEY) {
      const offlineRes = buildOfflineResponse(sanitizedRow, sanitizedQuestion, confidenceBound);
      setCachedAnalysis(cacheKey, offlineRes);
      return NextResponse.json(offlineRes, { headers });
    }

    let finalResponse: AnalysisResponse;

    try {
      const prompts = buildPrompt(sanitizedRow, sanitizedQuestion, confidenceBound);
      let rawAIOutput = "";
      
      try {
        rawAIOutput = await callOpenRouter(prompts.systemPrompt, prompts.userPrompt, PRIMARY_MODEL, 15000);
      } catch (e) {
        console.warn("[analyzeRoute] Primary model failed, trying fallback...", e);
        rawAIOutput = await callOpenRouter(prompts.systemPrompt, prompts.userPrompt, FALLBACK_MODEL, 10000);
      }

      try {
        const aiResult = parseAndValidateResponse(rawAIOutput, confidenceBound);
        finalResponse = {
          result: aiResult,
          mode: "ai",
          generatedAt: new Date().toISOString(),
          gateId: sanitizedRow.gate,
          question: sanitizedQuestion,
        };
      } catch (parseError) {
        if (parseError instanceof AIResponseParseError && parseError.type === "INVALID_JSON") {
          console.warn("[analyzeRoute] Invalid JSON from AI, attempting strict retry...");
          const retryPrompts = buildRetryPrompt(sanitizedRow, sanitizedQuestion, confidenceBound);
          const retryRawOutput = await callOpenRouter(retryPrompts.systemPrompt, retryPrompts.userPrompt, PRIMARY_MODEL, 10000);
          const retryAiResult = parseAndValidateResponse(retryRawOutput, confidenceBound);
          finalResponse = {
            result: retryAiResult,
            mode: "ai",
            generatedAt: new Date().toISOString(),
            gateId: sanitizedRow.gate,
            question: sanitizedQuestion,
          };
        } else {
          throw parseError;
        }
      }
    } catch (llmError) {
      console.warn("[analyzeRoute] AI analysis failed completely, falling back to offline mode", llmError);
      finalResponse = buildOfflineResponse(sanitizedRow, sanitizedQuestion, confidenceBound);
    }

    // ── 6. Cache & Respond ────────────────────────────────────────────────────
    if (finalResponse.mode === "ai") {
      setCachedAnalysis(cacheKey, finalResponse);
    }
    return NextResponse.json(finalResponse, { headers });

  } catch (error) {
    return sanitizedErrorResponse(error, "An unexpected error occurred during analysis.", 500);
  }
}
