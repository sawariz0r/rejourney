import { describe, expect, it } from 'vitest';
import { inferRuleFromConditions, inferRulesFromConditions, mapQueryConditionToRule } from './SmartCaptureModal';
import type { QueryGroup } from './queryBuilderTypes';

describe('SmartCaptureModal AI rule inference', () => {
  it('maps replay-search issue conditions to matching capture signals', () => {
    const rule = mapQueryConditionToRule({ id: 'c1', type: 'issue', issueFilter: 'rage' }, 'rage sessions');

    expect(rule?.signal).toBe('rage_clicks');
    expect(rule?.condition?.metric).toBe('rage_tap_count');
  });

  it('maps returning-user lifecycle output to loyal-user capture instead of churn', () => {
    const rule = mapQueryConditionToRule({ id: 'c1', type: 'lifecycle', preset: 'returning_user' }, 'returning users');

    expect(rule?.signal).toBe('loyal_user');
    expect(rule?.condition?.signal).toBe('loyal_user');
  });

  it('maps checkout failure output to checkout-risk capture', () => {
    const rule = mapQueryConditionToRule({ id: 'c1', type: 'conversion', preset: 'checkout_bounced' }, 'checkout failures');

    expect(rule?.signal).toBe('checkout_risk');
    expect(rule?.type).toBe('conversion');
  });

  it('keeps checkout success prompts capturable when the query builder returns conversion success', () => {
    const rule = mapQueryConditionToRule({ id: 'c1', type: 'conversion', preset: 'checkout_success' }, 'checkout success');

    expect(rule?.signal).toBe('custom_event');
    expect(rule?.condition?.attribute).toBe('event_name');
    expect(rule?.condition?.value).toBe('checkout_success');
  });

  it('maps web attribution conditions into metadata capture rules', () => {
    const rule = mapQueryConditionToRule({ id: 'c1', type: 'utm', field: 'campaign', value: 'launch' }, 'launch campaign');

    expect(rule?.signal).toBe('user_metadata');
    expect(rule?.condition?.attribute).toBe('utm_campaign');
    expect(rule?.condition?.operator).toBe('contains');
    expect(rule?.condition?.value).toBe('launch');
  });

  it('maps metadata key-only conditions to key existence checks', () => {
    const rule = mapQueryConditionToRule({ id: 'c1', type: 'metadata', metaKey: 'os' }, 'metadata includes os');

    expect(rule?.signal).toBe('user_metadata');
    expect(rule?.condition?.attribute).toBe('os');
    expect(rule?.condition?.operator).toBe('exists');
  });

  it('uses canonical metadata keys for less common UTM fields', () => {
    const rule = mapQueryConditionToRule({ id: 'c1', type: 'utm', field: 'campaignId', value: 'cmp_123' }, 'campaign id');

    expect(rule?.condition?.attribute).toBe('utm_id');
  });

  it('maps early lifecycle output to new-user capture rules', () => {
    const rule = mapQueryConditionToRule({ id: 'c1', type: 'lifecycle', preset: 'early_user' }, 'new user friction');

    expect(rule?.signal).toBe('new_user');
    expect(rule?.condition?.signal).toBe('new_user');
    expect(rule?.condition?.maxVisits).toBe(3);
  });

  it('uses the AI lifecycle session window for first-N-session capture rules', () => {
    const rule = mapQueryConditionToRule(
      { id: 'c1', type: 'lifecycle', preset: 'early_user', sessionWindowSize: 3 },
      'first three sessions',
    );

    expect(rule?.signal).toBe('new_user');
    expect(rule?.label).toBe('New user within first 3 sessions');
    expect(rule?.condition?.maxVisits).toBe(3);
  });

  it('does not choose broad platform-only rules when stronger conditions are present', () => {
    const groups: QueryGroup[] = [{
      id: 'g1',
      conditions: [
        { id: 'c1', type: 'platform', platform: 'ios' },
        { id: 'c2', type: 'issue', issueFilter: 'crashes' },
      ],
    }];

    const rule = inferRuleFromConditions(groups, 'iOS crashes last week');

    expect(rule.signal).toBe('crashes');
  });

  it('preserves multiple AI query clauses as one AND capture rule', () => {
    const groups: QueryGroup[] = [{
      id: 'g1',
      conditions: [
        { id: 'c1', type: 'issue', issueFilter: 'rage' },
        { id: 'c2', type: 'screen', screenName: 'Add-post' },
        { id: 'c3', type: 'metadata', metaKey: 'os' },
      ],
    }];

    const rule = inferRuleFromConditions(groups, 'rage taps and visited Add-post and metadata includes os');

    expect(rule.signal).toBe('rage_clicks');
    expect(rule.condition?.all).toHaveLength(3);
    expect(rule.condition?.all).toEqual(expect.arrayContaining([
      expect.objectContaining({ metric: 'rage_tap_count' }),
      expect.objectContaining({ attribute: 'screen_name', value: 'Add-post' }),
      expect.objectContaining({ attribute: 'os', operator: 'exists' }),
    ]));
  });

  it('scopes rage taps to a screen when the prompt says they happened on that page', () => {
    const groups: QueryGroup[] = [{
      id: 'g1',
      conditions: [
        { id: 'c1', type: 'issue', issueFilter: 'rage' },
        { id: 'c2', type: 'screen', screenName: 'Add-post' },
      ],
    }];

    const rule = inferRuleFromConditions(groups, 'rage taps on the Add-post page');

    expect(rule.signal).toBe('rage_clicks');
    expect(rule.condition?.all).toBeUndefined();
    expect(rule.condition?.metric).toBe('rage_tap_count');
    expect(rule.condition?.scope).toEqual({
      attribute: 'screen_name',
      operator: 'contains',
      value: 'Add-post',
    });
  });

  it('keeps screen visits as AND clauses when the prompt does not scope the issue to the page', () => {
    const groups: QueryGroup[] = [{
      id: 'g1',
      conditions: [
        { id: 'c1', type: 'issue', issueFilter: 'rage' },
        { id: 'c2', type: 'screen', screenName: 'Add-post' },
      ],
    }];

    const rule = inferRuleFromConditions(groups, 'rage taps and visited Add-post');

    expect(rule.signal).toBe('rage_clicks');
    expect(rule.condition?.scope).toBeUndefined();
    expect(rule.condition?.all).toEqual(expect.arrayContaining([
      expect.objectContaining({ metric: 'rage_tap_count' }),
      expect.objectContaining({ attribute: 'screen_name', value: 'Add-post' }),
    ]));
  });

  it('maps query OR groups to multiple capture rules', () => {
    const groups: QueryGroup[] = [
      { id: 'g1', conditions: [{ id: 'c1', type: 'issue', issueFilter: 'rage' }] },
      { id: 'g2', conditions: [{ id: 'c2', type: 'issue', issueFilter: 'crashes' }] },
    ];

    const rules = inferRulesFromConditions(groups, 'rage taps or crashes');

    expect(rules).toHaveLength(2);
    expect(rules.map((rule) => rule.signal)).toEqual(['rage_clicks', 'crashes']);
  });

  it('falls back from messy slow API prompts with thresholds and capture rate', () => {
    const rule = inferRuleFromConditions([], 'keep 25% of sessions where API latency is over 2 seconds');

    expect(rule.signal).toBe('slow_api');
    expect(rule.value).toBe(2000);
    expect(rule.captureRate).toBe(25);
    expect(rule.condition?.captureRate).toBe(25);
  });

  it('falls back from shorthand product-risk prompts', () => {
    expect(inferRuleFromConditions([], 'cart abandoned').signal).toBe('cart_abandonment');
    expect(inferRuleFromConditions([], 'pre churn no return').signal).toBe('churn_risk');
    expect(inferRuleFromConditions([], 'users who churn').signal).toBe('churn_risk');
    expect(inferRuleFromConditions([], 'users stuck during onboarding').signal).toBe('onboarding_risk');
  });

  it('falls back to churn risk when the AI returns an unsupported checkout conversion for churn intent', () => {
    const groups: QueryGroup[] = [{
      id: 'g1',
      conditions: [{ id: 'c1', type: 'conversion', preset: 'checkout_bounced' }],
    }];

    const rule = inferRuleFromConditions(groups, 'users who churn');

    expect(rule.signal).toBe('churn_risk');
    expect(rule.type).toBe('lifecycle');
  });

  it.each([
    ['save crashy sessions only', 'crashes'],
    ['dead clicks on the payment form', 'dead_taps'],
    ['API failure rate above 10%', 'api_error_rate'],
    ['slow startup over 4 seconds', 'slow_start'],
    ['sessions longer than 3 minutes', 'duration'],
    ['people who viewed more than 5 pages', 'screen_count'],
    ['power users with 8 visits', 'loyal_user'],
    ['checkout payment declined', 'checkout_risk'],
  ])('falls back from prompt "%s"', (prompt, expectedSignal) => {
    expect(inferRuleFromConditions([], prompt).signal).toBe(expectedSignal);
  });

  it('prefers usable AI conditions over generic prompt fallback', () => {
    const groups: QueryGroup[] = [{
      id: 'g1',
      conditions: [{ id: 'c1', type: 'event', eventName: 'Upgrade Started' }],
    }];

    const rule = inferRuleFromConditions(groups, 'people starting upgrade');

    expect(rule.signal).toBe('custom_event');
    expect(rule.condition?.attribute).toBe('event_name');
    expect(rule.condition?.value).toBe('Upgrade Started');
  });
});
