"use strict";
/**
 * Offline Analysis — deterministic rule-based fallback.
 *
 * Activates when:
 *   a. OPENROUTER_API_KEY is not configured, OR
 *   b. Prompt injection was detected in the question, OR
 *   c. The OpenRouter primary + fallback model calls both fail.
 *
 * Produces the same complete AIAnalysisResult schema as the AI-powered mode
 * (no null fields, no partial responses). The response includes
 * `mode: 'offline'` so the UI can render an appropriate banner.
 *
 * Rules are intentionally conservative and literal — they describe what the
 * data says, not inferences beyond it.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.runOfflineAnalysis = runOfflineAnalysis;
exports.buildOfflineResponse = buildOfflineResponse;
function buildStatusTemplate(row) {
    const qvRatio = (row.queueLength / Math.max(row.volunteerCount, 1)).toFixed(1);
    const occupancyPct = row.capacity > 0
        ? Math.round((row.currentVisitors / row.capacity) * 100)
        : 0;
    switch (row.status) {
        case "critical":
            return {
                observation: `${row.gate} is at critical density: ${row.currentVisitors.toLocaleString()} visitors ` +
                    `(${occupancyPct}% of capacity ${row.capacity.toLocaleString()}), ` +
                    `queue length ${row.queueLength.toLocaleString()}, ` +
                    `${row.volunteerCount} volunteer${row.volunteerCount !== 1 ? "s" : ""} on duty ` +
                    `(queue-to-volunteer ratio: ${qvRatio}).`,
                reasoning: `Critical status with ${occupancyPct}% occupancy and a queue-to-volunteer ratio of ${qvRatio} ` +
                    `indicates severe crowding. ${row.medicalIncidents > 0 ? `${row.medicalIncidents} medical incident${row.medicalIncidents > 1 ? "s" : ""} reported, elevating urgency. ` : ""}` +
                    `${row.transportDelay > 30 ? `Transport delay of ${row.transportDelay} min may be compounding queue buildup. ` : ""}` +
                    `Immediate intervention is required to prevent crowd crush conditions.`,
                action: "Immediately activate overflow protocol: redirect incoming visitors to nearest " +
                    `under-capacity gate, request ${Math.max(2, row.volunteerCount)} additional volunteers, ` +
                    "and contact supervisory staff. Do not allow additional entry until queue falls below 50% of current length.",
                impact: "Halting entry and activating overflow should reduce queue-to-volunteer ratio within 10–15 minutes " +
                    "and prevent escalation to a safety incident.",
                en: `Attention: ${row.gate} is currently at critical capacity. Please follow volunteer directions ` +
                    "and proceed to an alternate gate if indicated.",
                es: `Atención: ${row.gate} está actualmente a capacidad crítica. Por favor siga las instrucciones ` +
                    "del voluntario y diríjase a una puerta alternativa si se indica.",
                fr: `Attention : ${row.gate} est actuellement à capacité critique. Veuillez suivre les instructions ` +
                    "du bénévole et vous diriger vers une autre porte si indiqué.",
            };
        case "busy":
            return {
                observation: `${row.gate} is operating at elevated occupancy: ${row.currentVisitors.toLocaleString()} visitors ` +
                    `(${occupancyPct}% of capacity), queue length ${row.queueLength.toLocaleString()}, ` +
                    `${row.volunteerCount} volunteer${row.volunteerCount !== 1 ? "s" : ""} present.`,
                reasoning: `Busy status at ${occupancyPct}% occupancy warrants close monitoring. ` +
                    `Queue-to-volunteer ratio of ${qvRatio} is manageable but should be watched. ` +
                    `${row.medicalIncidents > 0 ? `${row.medicalIncidents} medical incident${row.medicalIncidents > 1 ? "s" : ""} on record. ` : ""}` +
                    "Proactive measures now can prevent escalation to critical.",
                action: "Increase volunteer visibility at the gate entrance. Monitor queue length every 5 minutes. " +
                    "Prepare overflow redirect messaging and request one standby volunteer.",
                impact: "Early monitoring and standby staffing typically prevent escalation to critical status " +
                    "and reduce wait times by 20–30%.",
                en: `${row.gate} is currently busy. Please have your ticket ready and follow ` +
                    "volunteer instructions to keep the queue moving smoothly.",
                es: `${row.gate} está actualmente ocupada. Por favor tenga su boleto listo y siga ` +
                    "las instrucciones del voluntario para mantener la fila en movimiento.",
                fr: `${row.gate} est actuellement occupée. Veuillez avoir votre billet prêt et suivre ` +
                    "les instructions du bénévole pour que la file avance.",
            };
        default: // normal
            return {
                observation: `${row.gate} is operating normally: ${row.currentVisitors.toLocaleString()} visitors ` +
                    `(${occupancyPct}% of capacity), queue length ${row.queueLength.toLocaleString()}, ` +
                    `${row.volunteerCount} volunteer${row.volunteerCount !== 1 ? "s" : ""} on duty.`,
                reasoning: `Normal status at ${occupancyPct}% occupancy. Queue-to-volunteer ratio of ${qvRatio} is within acceptable range. ` +
                    `${row.medicalIncidents > 0 ? `Note: ${row.medicalIncidents} medical incident(s) recorded — verify these have been addressed. ` : ""}` +
                    "No immediate action required; routine monitoring is sufficient.",
                action: "Maintain standard volunteer presence. Continue routine monitoring on a 15-minute interval. " +
                    "No escalation actions needed at this time.",
                impact: "Continued routine monitoring maintains normal operations and ensures timely detection " +
                    "of any developing issues.",
                en: `${row.gate} is open and operating normally. Welcome — please proceed to your seat.`,
                es: `${row.gate} está abierta y funcionando con normalidad. Bienvenido, por favor diríjase a su asiento.`,
                fr: `${row.gate} est ouverte et fonctionne normalement. Bienvenue — veuillez vous diriger vers votre siège.`,
            };
    }
}
// ─── Source data references ───────────────────────────────────────────────────
function buildSourceRefs(row) {
    return [
        `Gate: ${row.gate}`,
        `Status: ${row.status}`,
        `Current Visitors: ${row.currentVisitors}`,
        `Capacity: ${row.capacity}`,
        `Queue Length: ${row.queueLength}`,
        `Volunteer Count: ${row.volunteerCount}`,
        `Medical Incidents: ${row.medicalIncidents}`,
        ...(row.transportDelay > 0 ? [`Transport Delay: ${row.transportDelay} min`] : []),
        ...(row.weather ? [`Weather: ${row.weather}`] : []),
    ];
}
// ─── Public API ───────────────────────────────────────────────────────────────
/**
 * Produces a fully-populated AIAnalysisResult using deterministic rules.
 * All fields are always populated — no nulls.
 *
 * @param row - Validated, sanitized GateRow
 * @param question - Sanitized question string (used for source ref only)
 * @param bound - Locally-computed confidence bound
 */
function runOfflineAnalysis(row, question, bound) {
    const template = buildStatusTemplate(row);
    return {
        observation: template.observation,
        reasoning: template.reasoning,
        recommendedAction: template.action,
        expectedImpact: template.impact,
        confidence: {
            score: bound.value,
            basis: `Offline analysis — local confidence bound of ${bound.value} ` +
                `(completeness: ${Math.round(bound.completenessSignal * 100)}%, ` +
                `agreement: ${Math.round(bound.agreementSignal * 100)}%, ` +
                `recency: ${Math.round(bound.recencySignal * 100)}%).`,
        },
        multilingualAnnouncement: {
            en: template.en,
            es: template.es,
            fr: template.fr,
        },
        sourceDataRefs: [
            ...buildSourceRefs(row),
            ...(question ? [`Question: ${question.slice(0, 100)}`] : []),
        ],
    };
}
/**
 * Wraps runOfflineAnalysis in an AnalysisResponse envelope.
 */
function buildOfflineResponse(row, question, bound) {
    return {
        result: runOfflineAnalysis(row, question, bound),
        mode: "offline",
        generatedAt: new Date().toISOString(),
        gateId: row.gate,
        question,
    };
}
