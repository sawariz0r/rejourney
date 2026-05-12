export type SdkConfigProject = {
    id: string;
    teamId: string;
    name: string;
    rejourneyEnabled: boolean;
    recordingEnabled: boolean;
    textInputMasking?: string | null;
    recordingFps?: number | null;
    sampleRate?: number | null;
    maxRecordingMinutes?: number | null;
};

type SdkBillingConfig = {
    billingBlocked?: boolean;
    billingReason?: string;
};

export function buildSdkConfigResponse(
    project: SdkConfigProject,
    billing: SdkBillingConfig = {}
) {
    const sampleRate = Math.max(0, Math.min(100, project.sampleRate ?? 100));
    const textInputMasking = project.textInputMasking === 'secure_only' ? 'secure_only' : 'all';
    const recordingFps = Math.max(1, Math.min(3, Math.round(project.recordingFps ?? 1)));
    const maxRecordingMinutes = Math.max(
        1,
        Math.min(10, project.maxRecordingMinutes ?? 10)
    );
    const billingBlocked = Boolean(billing.billingBlocked);
    const billingReason = typeof billing.billingReason === 'string' ? billing.billingReason : undefined;

    const base = {
        projectId: project.id,
        teamId: project.teamId,
        name: project.name,
        rejourneyEnabled: project.rejourneyEnabled,
        recordingEnabled: project.recordingEnabled,
        textInputMasking,
        recordingFps,
        maxRecordingMinutes,
        sampleRate,
        billingBlocked,
        billingReason,
    };

    if (!project.rejourneyEnabled) {
        return {
            ...base,
            rejourneyEnabled: false,
            recordingEnabled: false,
            disabled: true,
            reason: 'Rejourney disabled by project admin',
        };
    }

    return base;
}
