import { runAutomationStaticSelfTest } from "../../../lib/v17-automation-self-test";
import { buildServerVerifiedDecisions } from "../../../lib/v17-server-decisions";
import { evaluateTradeReadiness } from "../../../lib/v17-risk-gate";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  const staticTest = runAutomationStaticSelfTest();
  let live = null;
  let liveError = null;
  try {
    const decisions = await buildServerVerifiedDecisions();
    const readiness = await evaluateTradeReadiness({ decisions: decisions.actionQueue || [] });
    live = {
      serverVerified: decisions.verification?.serverVerified === true,
      sourceUpdatedAt: decisions.verification?.sourceUpdatedAt || null,
      acceptedSymbols: decisions.verification?.acceptedSymbols || [],
      rejected: decisions.verification?.rejected || [],
      actionCount: decisions.actionCount || 0,
      readinessStatus: readiness.status,
      candidate: readiness.candidate
        ? {
            symbol: readiness.candidate.symbol,
            tier: readiness.candidate.tier,
            amountUSDT: readiness.candidate.amountUSDT,
            executionRoute: readiness.candidate.executionRoute,
          }
        : null,
    };
  } catch (error) {
    liveError = error.message;
  }

  const releaseReady = staticTest.ok
    && staticTest.security.tokenConfigured
    && staticTest.security.killSwitchActive === false
    && Boolean(live?.serverVerified)
    && !liveError;

  return res.status(staticTest.ok ? 200 : 500).json({
    ok: staticTest.ok,
    version: "v17.7-secure-semi-auto",
    realOrdersEnabled: false,
    releaseReady,
    checkedAt: new Date().toISOString(),
    staticTest,
    live,
    liveError,
    manualRequirements: {
      automationToken: staticTest.security.tokenConfigured ? "DONE" : "SET_V17_AUTOMATION_API_TOKEN",
      killSwitch: staticTest.security.killSwitchActive ? "KEEP_ON_UNTIL_AUTH_TESTS_PASS" : "OFF_FOR_AUTHORIZED_DRY_RUN",
      productionPrivacy: "ENABLE_VERCEL_DEPLOYMENT_PROTECTION",
      oracleTransport: "HTTPS_REQUIRED_BEFORE_ANY_TRADE_KEY",
      binanceTradeKey: "DO_NOT_CREATE_YET",
    },
  });
}
