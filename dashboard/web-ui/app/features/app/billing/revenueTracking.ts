import type { BillingPlan } from '~/features/app/billing/api';
import type { RejourneyRevenueEventInput } from '~/shared/compliance/rejourneyWebsiteTelemetry';

const CHECKOUT_REVENUE_CONTEXT_STORAGE_PREFIX = 'rejourney.billingCheckoutRevenueContext.v1';

type BillingRevenuePlan = {
  name?: string;
  planName?: string;
  displayName?: string;
  priceCents?: number;
  priceId?: string | null;
  productId?: string | null;
  interval?: 'month' | 'year' | string;
  sessionLimit?: number;
  sessionReplayLimit?: number;
  videoRetentionDays?: number;
};

type PendingCheckoutRevenueContext = {
  teamId: string;
  selectedPlan: string;
  plan: BillingRevenuePlan;
  createdAt: string;
};

function checkoutRevenueContextStorageKey(sessionId: string): string {
  return `${CHECKOUT_REVENUE_CONTEXT_STORAGE_PREFIX}:${sessionId}`;
}

export function writePendingCheckoutRevenueContext(sessionId: string, context: PendingCheckoutRevenueContext): void {
  try {
    window.sessionStorage.setItem(checkoutRevenueContextStorageKey(sessionId), JSON.stringify(context));
  } catch {
    // Best-effort enrichment; checkout still succeeds without this context.
  }
}

export function readPendingCheckoutRevenueContext(sessionId?: string | null): PendingCheckoutRevenueContext | null {
  if (!sessionId) return null;

  try {
    const stored = window.sessionStorage.getItem(checkoutRevenueContextStorageKey(sessionId));
    if (!stored) return null;
    const parsed = JSON.parse(stored) as PendingCheckoutRevenueContext;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export function clearPendingCheckoutRevenueContext(sessionId?: string | null): void {
  if (!sessionId) return;

  try {
    window.sessionStorage.removeItem(checkoutRevenueContextStorageKey(sessionId));
  } catch {
    // Non-critical cleanup only.
  }
}

function findAvailableRevenuePlan(availablePlans: BillingPlan[], plan: BillingRevenuePlan | null, selectedPlan?: string | null): BillingPlan | null {
  const candidates = [
    plan?.priceId,
    plan?.productId,
    plan?.name,
    plan?.planName,
    selectedPlan,
  ]
    .filter((value): value is string => Boolean(value))
    .map(value => value.toLowerCase());

  if (candidates.length === 0) return null;

  return availablePlans.find(availablePlan => {
    const values = [
      availablePlan.priceId,
      availablePlan.productId,
      availablePlan.name,
    ]
      .filter((value): value is string => Boolean(value))
      .map(value => value.toLowerCase());

    return values.some(value => candidates.includes(value));
  }) || null;
}

export function mergeRevenuePlan(
  plan: BillingRevenuePlan | null | undefined,
  availablePlans: BillingPlan[],
  selectedPlan?: string | null,
): BillingRevenuePlan {
  const availablePlan = findAvailableRevenuePlan(availablePlans, plan || null, selectedPlan);
  const planName = plan?.planName || plan?.name || availablePlan?.name || selectedPlan || undefined;

  return {
    name: plan?.name || availablePlan?.name || planName,
    planName,
    displayName: plan?.displayName || availablePlan?.displayName || planName,
    priceCents: typeof plan?.priceCents === 'number' ? plan.priceCents : availablePlan?.priceCents,
    priceId: plan?.priceId || availablePlan?.priceId,
    productId: plan?.productId || availablePlan?.productId,
    interval: plan?.interval || availablePlan?.interval,
    sessionLimit: plan?.sessionLimit ?? availablePlan?.sessionLimit,
    sessionReplayLimit: plan?.sessionReplayLimit ?? availablePlan?.sessionReplayLimit ?? availablePlan?.sessionLimit,
    videoRetentionDays: plan?.videoRetentionDays ?? availablePlan?.videoRetentionDays,
  };
}

export function buildBillingRevenueEvent(input: {
  transactionId: string;
  teamId: string;
  plan: BillingRevenuePlan | null | undefined;
  availablePlans: BillingPlan[];
  selectedPlan?: string | null;
  subscriptionId?: string | null;
  checkoutSessionId?: string | null;
  source: NonNullable<RejourneyRevenueEventInput['source']>;
  changeType?: string;
  dedupeKey?: string;
}): RejourneyRevenueEventInput | null {
  const plan = mergeRevenuePlan(input.plan, input.availablePlans, input.selectedPlan);
  const priceCents = Number(plan.priceCents || 0);
  if (!Number.isFinite(priceCents) || priceCents <= 0) return null;

  const amount = Math.round(priceCents) / 100;
  const planName = plan.planName || plan.name || input.selectedPlan || undefined;

  return {
    transactionId: input.transactionId,
    amount,
    currency: 'USD',
    teamId: input.teamId,
    planId: planName,
    planName,
    planDisplayName: plan.displayName,
    priceId: plan.priceId || undefined,
    productId: plan.productId || undefined,
    subscriptionId: input.subscriptionId || undefined,
    checkoutSessionId: input.checkoutSessionId || undefined,
    billingInterval: plan.interval,
    changeType: input.changeType,
    source: input.source,
    sessionReplayLimit: plan.sessionReplayLimit ?? plan.sessionLimit,
    videoRetentionDays: plan.videoRetentionDays,
    isRenewal: false,
    isTrialConversion: false,
    dedupeKey: input.dedupeKey,
  };
}
