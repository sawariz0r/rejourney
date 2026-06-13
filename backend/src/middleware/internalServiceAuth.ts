import type { NextFunction, Request, Response } from 'express';
import { config } from '../config.js';
import { ApiError } from './errorHandler.js';
import { verifyInternalServiceRequest } from '../services/internalServiceAuth.js';

export async function requireIssueDetectionInternalAuth(req: Request, _res: Response, next: NextFunction) {
    try {
        const result = await verifyInternalServiceRequest({
            req,
            allowedServices: {
                'issue-detection': config.REJOURNEY_INTERNAL_SERVICE_SECRET,
            },
        });

        if (!result.ok) {
            throw ApiError.unauthorized('Invalid internal service signature');
        }

        next();
    } catch (error) {
        next(error);
    }
}
