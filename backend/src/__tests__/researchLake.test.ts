import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { __researchLakeTestInternals } from '../services/researchLake.js';

const require = createRequire(import.meta.url);
const jpeg = require('jpeg-js') as {
    encode: (input: { data: Buffer; width: number; height: number }, quality?: number) => {
        data: Buffer;
    };
};

describe('research lake anonymized payload shape', () => {
    it('allows anonymized sample keys but rejects raw identity and location values', () => {
        const safePayload = {
            manifest: {
                lake: 'interaction',
                project_key: 'a1b2c3d4e5f607182930',
                sample_key: 'f'.repeat(32),
                files: {
                    ui_frames: `v1/lake=interaction/project_key=a1b2/date=2026-05-11/sample_key=${'f'.repeat(32)}/ui_frames.jsonl.gz`,
                },
            },
            frame: {
                frame_key: 'abc123',
                source_kind: 'rrweb',
                has_href: true,
                has_src: false,
                text_class: 'masked',
            },
        };

        expect(__researchLakeTestInternals.containsIdentifierRisk(safePayload)).toBe(false);
        expect(__researchLakeTestInternals.containsIdentifierRisk({ session_id: 'session_1778538040547_ec8c9af04f3c4bb0b1a3fe0d3fb8e84c' })).toBe(true);
        expect(__researchLakeTestInternals.containsIdentifierRisk({ raw_url: 'https://example.com/account/123' })).toBe(true);
        expect(__researchLakeTestInternals.containsIdentifierRisk({ email: 'person@example.com' })).toBe(true);
        expect(__researchLakeTestInternals.containsIdentifierRisk({ network: '127.0.0.1' })).toBe(true);
        expect(__researchLakeTestInternals.containsIdentifierRisk({ device_id: 'device-123' })).toBe(true);
    });

    it('extracts compact screenshot feature grids without storing raw pixels', () => {
        const width = 16;
        const height = 16;
        const data = Buffer.alloc(width * height * 4);
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const offset = (y * width + x) * 4;
                data[offset] = x * 16;
                data[offset + 1] = y * 16;
                data[offset + 2] = (x + y) * 8;
                data[offset + 3] = 255;
            }
        }

        const jpegFrame = jpeg.encode({ data, width, height }, 80).data;
        const features = __researchLakeTestInternals.imageFeatureGrid(jpegFrame);

        expect(features).not.toBeNull();
        expect(features?.width).toBe(width);
        expect(features?.height).toBe(height);
        expect(features?.lumaGrid).toHaveLength(64);
        expect(features?.edgeGrid).toHaveLength(64);
        expect(features?.colorGrid).toHaveLength(64);
        expect(features?.lumaGrid.every((value) => value >= 0 && value <= 15)).toBe(true);
        expect(features?.edgeGrid.every((value) => value >= 0 && value <= 15)).toBe(true);
    });

    it('generates a valid ZIP archive containing multiple files', async () => {
        const files = [
            { name: 'manifest.json', buffer: Buffer.from('{"test":true}', 'utf8') },
            { name: 'quality.json', buffer: Buffer.from('{"usable":true}', 'utf8') },
        ];
        const zipBuffer = await __researchLakeTestInternals.createZipArchiveBuffer(files);
        expect(zipBuffer).toBeInstanceOf(Buffer);
        expect(zipBuffer.length).toBeGreaterThan(0);
        // Verify ZIP magic bytes (PK\x03\x04)
        expect(zipBuffer[0]).toBe(0x50);
        expect(zipBuffer[1]).toBe(0x4b);
        expect(zipBuffer[2]).toBe(0x03);
        expect(zipBuffer[3]).toBe(0x04);
    });

    it('populates business/funnel markers and semantic roles in interactions and skeleton', () => {
        const session = {
            id: 'session-123',
            user_display_id: 'user_9982',
            started_at: new Date('2026-06-08T12:00:00Z'),
            metadata: {
                plan: 'pro',
                experiment: 'v2'
            },
            events: [
                { name: 'signup_completed', timestamp: new Date('2026-06-08T12:00:01Z').getTime(), x: 50, y: 50 },
                { name: 'login', timestamp: new Date('2026-06-08T12:00:02Z').getTime(), x: 100, y: 100 },
                { name: 'product_view', timestamp: new Date('2026-06-08T12:00:05Z').getTime(), x: 150, y: 150, properties: { price: 49.99, productId: 'prod_1' } },
                { name: 'product_added_to_cart', timestamp: new Date('2026-06-08T12:00:10Z').getTime(), x: 200, y: 200, properties: { quantity: 7, price: 99.98, productId: 'prod_1' } },
                { name: 'paywall_view', timestamp: new Date('2026-06-08T12:00:12Z').getTime(), x: 250, y: 250 },
                { name: 'plan_selected', timestamp: new Date('2026-06-08T12:00:14Z').getTime(), x: 300, y: 300, properties: { planId: 'plan_gold' } },
                { name: 'coupon_use', timestamp: new Date('2026-06-08T12:00:16Z').getTime(), x: 350, y: 350, properties: { couponCode: 'SAVE20' } },
                { name: 'checkout_start', timestamp: new Date('2026-06-08T12:00:20Z').getTime(), x: 400, y: 400 },
                { name: 'purchase_complete', timestamp: new Date('2026-06-08T12:00:30Z').getTime(), x: 450, y: 450, properties: { value: 149.97, currency: 'USD', productId: 'prod_1', plan: 'plan_gold', priceId: 'price_gold_monthly', subscriptionId: 'sub_xyz', paymentProvider: 'stripe', platform: 'ios', isRenewal: false, isTrialConversion: true, transactionId: 'tx_8871' } },
                { name: 'trial_start', timestamp: new Date('2026-06-08T12:00:35Z').getTime(), x: 500, y: 500 },
                { name: 'subscription_start', timestamp: new Date('2026-06-08T12:00:40Z').getTime(), x: 550, y: 550 },
                { name: 'refund_processed', timestamp: new Date('2026-06-08T12:00:45Z').getTime(), x: 600, y: 600, properties: { refundId: 'ref_12' } },
                { name: 'cancellation', timestamp: new Date('2026-06-08T12:00:50Z').getTime(), x: 650, y: 650 },
                { name: 'payment_failure', timestamp: new Date('2026-06-08T12:00:55Z').getTime(), x: 700, y: 700 },
                { name: 'onboarding_completed', timestamp: new Date('2026-06-08T12:01:00Z').getTime(), x: 750, y: 750 },
                { name: 'feature_used', timestamp: new Date('2026-06-08T12:01:05Z').getTime(), x: 800, y: 800 },
                { name: 'added_to_cart', timestamp: new Date('2026-06-08T12:01:10Z').getTime(), x: 850, y: 850, properties: { quantity: 5 } },
            ]
        } as any;

        const projectKey = 'test-project-key';
        const customEventConfig = {
            revenueEventName: 'purchase_complete',
            checkoutEventName: 'checkout_start',
            subscriberEventName: 'cart_add'
        };

        const interactions = __researchLakeTestInternals.buildInteractions(session, projectKey, customEventConfig);

        expect(interactions).toHaveLength(17);

        // Verify transition names
        expect(interactions[0].funnel_transition).toBe('signup');
        expect(interactions[1].funnel_transition).toBe('login');
        expect(interactions[2].funnel_transition).toBe('product_view');
        expect(interactions[3].funnel_transition).toBe('cart_add');
        expect(interactions[4].funnel_transition).toBe('paywall_view');
        expect(interactions[5].funnel_transition).toBe('plan_selected');
        expect(interactions[6].funnel_transition).toBe('coupon_use');
        expect(interactions[7].funnel_transition).toBe('checkout_start');
        expect(interactions[8].funnel_transition).toBe('purchase_complete');
        expect(interactions[9].funnel_transition).toBe('trial_start');
        expect(interactions[10].funnel_transition).toBe('subscription_start');
        expect(interactions[11].funnel_transition).toBe('refund');
        expect(interactions[12].funnel_transition).toBe('cancellation');
        expect(interactions[13].funnel_transition).toBe('payment_failure');
        expect(interactions[14].funnel_transition).toBe('onboarding_completed');
        expect(interactions[15].funnel_transition).toBe('feature_used');
        expect(interactions[16].funnel_transition).toBe('cart_add');

        // Verify rounding and bucketing
        // product_view: 49.99 rounded to nearest 50
        expect(interactions[2].cart_value_bucket).toBe(50);
        // product_added_to_cart: qty 7 rounded to nearest 5 is 5, price 99.98 to 100
        expect(interactions[3].item_count_change).toBe(5);
        expect(interactions[3].cart_value_bucket).toBe(100);
        // added_to_cart: qty 5 rounded to nearest 5 is 5
        expect(interactions[16].item_count_change).toBe(5);

        // Verify custom properties extraction on purchase_complete
        const purchase = interactions[8];
        expect(purchase.product_id).toBe('prod_1');
        expect(purchase.plan_id).toBe('plan_gold');
        expect(purchase.price_id).toBe('price_gold_monthly');
        expect(purchase.currency).toBe('USD');
        expect(purchase.payment_provider).toBe('stripe');
        expect(purchase.platform).toBe('ios');
        expect(purchase.is_renewal).toBe(false);
        expect(purchase.is_trial_conversion).toBe(true);

        // Verify that identity/transaction hashes are completely omitted for GDPR compliance
        expect(purchase.transaction_id_hash).toBeUndefined();
        expect(purchase.subscription_id_hash).toBeUndefined();

        const couponUse = interactions[6];
        expect(couponUse.coupon_code_hash).toBeUndefined();

        const refund = interactions[11];
        expect(refund.refund_id_hash).toBeUndefined();

        // Verify skeleton mapping roles
        const skeleton = __researchLakeTestInternals.buildInteractionSkeleton(interactions);
        expect(skeleton).toHaveLength(17);
        const roles = skeleton.map(e => e.role);
        expect(roles).toContain('cta_signup');
        expect(roles).toContain('cta_login');
        expect(roles).toContain('view_item');
        expect(roles).toContain('cta_cart_add');
        expect(roles).toContain('paywall_element');
        expect(roles).toContain('plan_selector');
        expect(roles).toContain('cta_coupon_use');
        expect(roles).toContain('cta_checkout');
        expect(roles).toContain('cta_purchase');
        expect(roles).toContain('cta_trial_start');
        expect(roles).toContain('cta_subscription_start');
        expect(roles).toContain('cta_refund');
        expect(roles).toContain('cta_cancellation');
        expect(roles).toContain('payment_failure_element');
        expect(roles).toContain('cta_onboarding');
        expect(roles).toContain('feature_element');

        // Verify buildBusinessContext manifest properties
        const bizContext = __researchLakeTestInternals.buildBusinessContext(session, interactions, [], customEventConfig);
        expect(bizContext.is_conversion_session).toBe(true);
        expect(bizContext.max_funnel_stage_reached).toBe('purchase');
        expect(bizContext.conversion_revenue_bucket).toBe(150); // 149.97 rounded to 150
        expect(bizContext.currency).toBe('USD');
        expect(bizContext.purchased_products).toContain('prod_1');
        expect(bizContext.has_discount_applied).toBe(true);
        expect((bizContext as any).user_identity_hash).toBeUndefined();
        expect(bizContext.session_metadata_keys).toContain('plan');
        expect(bizContext.session_metadata_keys).toContain('experiment');
        expect(bizContext.lifecycle_events_present).toContain('signup');
        expect(bizContext.lifecycle_events_present).toContain('purchase_complete');
    });

    it('respects customEventConfig for amount/currency property mapping, default currency, and minor units conversion', () => {
        const session = {
            id: 'session-456',
            user_display_id: 'user_1122',
            started_at: new Date('2026-06-08T12:00:00Z'),
            events: [
                {
                    name: 'custom_purchase',
                    timestamp: new Date('2026-06-08T12:00:10Z').getTime(),
                    properties: {
                        custom_amount: 14997, // 149.97 in cents
                        custom_currency: 'EUR',
                        transactionId: 'tx_9999',
                    }
                },
                {
                    name: 'custom_purchase_no_currency',
                    timestamp: new Date('2026-06-08T12:00:20Z').getTime(),
                    properties: {
                        custom_amount: 5000, // 50.00 in cents
                        transactionId: 'tx_10000',
                    }
                }
            ]
        } as any;

        const customEventConfig = {
            revenueEventName: 'custom_purchase',
            conversionEventName: 'custom_purchase_no_currency',
            revenueAmountProperty: 'custom_amount',
            revenueCurrencyProperty: 'custom_currency',
            defaultCurrency: 'GBP',
            amountUnit: 'minor',
        };

        const projectKey = 'test-project-key';
        const interactions = __researchLakeTestInternals.buildInteractions(session, projectKey, customEventConfig);

        expect(interactions).toHaveLength(2);
        
        // 149.97 rounded to nearest 50 is 150
        expect(interactions[0].cart_value_bucket).toBe(150);
        expect(interactions[0].currency).toBe('EUR');

        // 50.00 rounded to nearest 50 is 50
        expect(interactions[1].cart_value_bucket).toBe(50);
        // Fallbacks to defaultCurrency GBP
        expect(interactions[1].currency).toBe('GBP');

        const bizContext = __researchLakeTestInternals.buildBusinessContext(session, interactions, [], customEventConfig);
        expect(bizContext.is_conversion_session).toBe(true);
        // total amount is 149.97 + 50.00 = 199.97, rounded to 50 is 200
        expect(bizContext.conversion_revenue_bucket).toBe(200);
        expect(bizContext.currency).toBe('EUR');
    });
});
