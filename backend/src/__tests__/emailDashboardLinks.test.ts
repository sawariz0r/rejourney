import { describe, expect, it, vi } from 'vitest';

describe('email dashboard links', () => {
    it('uses the hosted dashboard URL outside dev and test', async () => {
        vi.resetModules();
        vi.doMock('../config.js', () => ({
            config: {
                SMTP_FROM: 'test@rejourney.co',
                SMTP_HOST: 'mock',
                PUBLIC_DASHBOARD_URL: 'http://localhost:8080',
            },
            isDevelopment: false,
            isTest: false,
        }));
        vi.doMock('../logger.js', () => ({
            logger: {
                info: vi.fn(),
                warn: vi.fn(),
                error: vi.fn(),
            },
        }));
        vi.doMock('nodemailer', () => ({
            default: {
                createTransport: vi.fn(),
            },
        }));

        const { emailDashboardAppPath } = await import('../services/email.js');

        expect(emailDashboardAppPath('/api')).toBe('https://rejourney.co/dashboard/api');
        expect(emailDashboardAppPath('/sessions')).toBe('https://rejourney.co/dashboard/sessions');
    });
});
