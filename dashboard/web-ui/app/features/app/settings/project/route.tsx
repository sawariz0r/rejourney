import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';
import { usePathPrefix } from '~/shell/routing/usePathPrefix';
import { useSessionData } from '~/shared/providers/SessionContext';
import { useTeam } from '~/shared/providers/TeamContext';
import { useAuth } from '~/shared/providers/AuthContext';
import { NeoButton } from '~/shared/ui/core/neo/NeoButton';
import { NeoCard } from '~/shared/ui/core/neo/NeoCard';
import { NeoBadge } from '~/shared/ui/core/neo/NeoBadge';
import { Input } from '~/shared/ui/core/Input';
import { Modal } from '~/shared/ui/core/Modal';
import { DashboardGhostLoader } from '~/shared/ui/core/DashboardGhostLoader';
import { DashboardPageHeader } from '~/shared/ui/core/DashboardPageHeader';
import { Copy, Plus, Trash2, Key, AlertTriangle, CheckCircle, Shield, Info, Check, Settings, Save, AlertOctagon, Smartphone, Clock, Percent } from 'lucide-react';
import { getAndroidPackageError, getIosBundleIdError } from '~/shared/lib/validation';
import {
  getProject,
  updateProject,
  deleteProject,
  requestProjectDeletionOtp,
  getApiKeys,
  createApiKey,
  revokeApiKey,
  ApiKey,
  CreatedApiKey
} from '~/shared/api/client';

interface SettingsProps {
  projectId?: string;
}

type TextInputMasking = 'all' | 'secure_only';
type RecordingFps = 1 | 2 | 3;

const normalizeTextInputMasking = (value: unknown): TextInputMasking => (
  value === 'secure_only' ? 'secure_only' : 'all'
);

const normalizeRecordingFps = (value: unknown): RecordingFps => {
  const numericValue = typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : 1;
  return Math.min(3, Math.max(1, numericValue)) as RecordingFps;
};

const normalizeMaxRecordingMinutes = (value: unknown): number => {
  const numericValue = typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : 10;
  return Math.min(10, Math.max(1, numericValue));
};

const normalizeSampleRate = (value: unknown): number => {
  const numericValue = typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : 100;
  return Math.min(100, Math.max(0, numericValue));
};

export const ProjectSettings: React.FC<SettingsProps> = ({ projectId: propProjectId }) => {
  const { projects, refreshSessions, selectedProject, setSelectedProject } = useSessionData();
  const { currentTeam, teamMembers } = useTeam();
  const { user } = useAuth();
  const isSelfHosted = !!user?.isSelfHosted;
  const navigate = useNavigate();
  const location = useLocation();
  const pathPrefix = usePathPrefix();
  const { projectId: paramProjectId } = useParams<{ projectId: string }>();

  // Use prop projectId if available, fall back to URL param
  const projectId = propProjectId || paramProjectId;

  // If user switches projects while on the settings page, follow the selection.
  // This avoids the page appearing “stuck” on the previous project's settings.
  useEffect(() => {
    if (propProjectId) return; // Embedded usage controls the projectId.
    if (!paramProjectId) return;
    if (!selectedProject?.id) return;

    if (location.pathname.startsWith('/settings/') && paramProjectId !== selectedProject.id) {
      navigate(`${pathPrefix}/settings/${selectedProject.id}`, { replace: true });
    }
  }, [location.pathname, navigate, pathPrefix, paramProjectId, propProjectId, selectedProject?.id]);

  // Check if user is admin or owner (can edit settings)
  const currentMember = teamMembers.find(m => m.userId === user?.id);
  const isOwner = currentTeam?.ownerUserId === user?.id;
  const isAdmin = isOwner || currentMember?.role === 'admin';
  const canEdit = isAdmin;

  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [appName, setAppName] = useState('');
  const [maxRecordingMinutes, setMaxRecordingMinutes] = useState<number>(10);
  const [maxRecordingMinutesDraft, setMaxRecordingMinutesDraft] = useState<number | null>(null);
  const [sampleRate, setSampleRate] = useState<number>(100);
  const [sampleRateDraft, setSampleRateDraft] = useState<number | null>(null);
  const [recordingFps, setRecordingFps] = useState<RecordingFps>(1);
  const [recordingFpsDraft, setRecordingFpsDraft] = useState<RecordingFps | null>(null);
  const [recordingFpsConfirmation, setRecordingFpsConfirmation] = useState<RecordingFps | null>(null);
  const [rejourneyEnabled, setRejourneyEnabled] = useState<boolean>(true);
  const [recordingEnabled, setRecordingEnabled] = useState<boolean>(true);
  const [textInputMasking, setTextInputMasking] = useState<TextInputMasking>('all');
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingDuration, setIsSavingDuration] = useState(false);
  const [isSavingSampleRate, setIsSavingSampleRate] = useState(false);
  const [isSavingRecordingFps, setIsSavingRecordingFps] = useState(false);
  const [isSavingRejourney, setIsSavingRejourney] = useState(false);
  const [isSavingRecording, setIsSavingRecording] = useState(false);
  const [isSavingMasking, setIsSavingMasking] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [durationSaveError, setDurationSaveError] = useState<string | null>(null);
  const [sampleRateSaveError, setSampleRateSaveError] = useState<string | null>(null);
  const [recordingFpsSaveError, setRecordingFpsSaveError] = useState<string | null>(null);
  const [rejourneySaveError, setRejourneySaveError] = useState<string | null>(null);
  const [recordingSaveError, setRecordingSaveError] = useState<string | null>(null);
  const [maskingSaveError, setMaskingSaveError] = useState<string | null>(null);
  const pendingMaxRecordingMinutesRef = useRef<number | null>(null);
  const pendingSampleRateRef = useRef<number | null>(null);
  const pendingTextInputMaskingRef = useRef<TextInputMasking | null>(null);
  const pendingRecordingFpsRef = useRef<RecordingFps | null>(null);
  const maxRecordingMinutesDraftRef = useRef<number | null>(null);
  const sampleRateDraftRef = useRef<number | null>(null);
  const recordingFpsDraftRef = useRef<RecordingFps | null>(null);

  // API Key state
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [isLoadingKeys, setIsLoadingKeys] = useState(false);
  const [createdApiKey, setCreatedApiKey] = useState<CreatedApiKey | null>(null);
  const [keyError, setKeyError] = useState<string | null>(null);
  const [showCreateKeyModal, setShowCreateKeyModal] = useState(false);
  const [isCreatingKey, setIsCreatingKey] = useState(false);

  // Delete state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteOtpCode, setDeleteOtpCode] = useState('');
  const [isSendingDeleteOtp, setIsSendingDeleteOtp] = useState(false);
  const [deleteOtpSent, setDeleteOtpSent] = useState(false);
  const [deleteOtpMessage, setDeleteOtpMessage] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Copy state
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const setRecordingFpsDraftValue = (fps: RecordingFps | null) => {
    recordingFpsDraftRef.current = fps;
    setRecordingFpsDraft(fps);
  };

  const setMaxRecordingMinutesDraftValue = (minutes: number | null) => {
    maxRecordingMinutesDraftRef.current = minutes;
    setMaxRecordingMinutesDraft(minutes);
  };

  const setSampleRateDraftValue = (rate: number | null) => {
    sampleRateDraftRef.current = rate;
    setSampleRateDraft(rate);
  };

  const handleCopy = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const applyProjectToForm = (nextProject: any) => {
    const sourceMasking = normalizeTextInputMasking(nextProject?.textInputMasking);
    const pendingMasking = pendingTextInputMaskingRef.current;
    const masking = pendingMasking && sourceMasking !== pendingMasking ? pendingMasking : sourceMasking;
    if (pendingMasking && sourceMasking === pendingMasking) {
      pendingTextInputMaskingRef.current = null;
    }
    const sourceMaxRecordingMinutes = normalizeMaxRecordingMinutes(nextProject?.maxRecordingMinutes);
    const pendingMaxRecordingMinutes = pendingMaxRecordingMinutesRef.current;
    const resolvedMaxRecordingMinutes = pendingMaxRecordingMinutes && sourceMaxRecordingMinutes !== pendingMaxRecordingMinutes
      ? pendingMaxRecordingMinutes
      : sourceMaxRecordingMinutes;
    if (pendingMaxRecordingMinutes && sourceMaxRecordingMinutes === pendingMaxRecordingMinutes) {
      pendingMaxRecordingMinutesRef.current = null;
    }
    const sourceSampleRate = normalizeSampleRate(nextProject?.sampleRate);
    const pendingSampleRate = pendingSampleRateRef.current;
    const resolvedSampleRate = pendingSampleRate !== null && pendingSampleRate !== undefined && sourceSampleRate !== pendingSampleRate
      ? pendingSampleRate
      : sourceSampleRate;
    if (pendingSampleRate !== null && pendingSampleRate !== undefined && sourceSampleRate === pendingSampleRate) {
      pendingSampleRateRef.current = null;
    }
    const sourceRecordingFps = normalizeRecordingFps(nextProject?.recordingFps);
    const pendingRecordingFps = pendingRecordingFpsRef.current;
    const resolvedRecordingFps = pendingRecordingFps && sourceRecordingFps !== pendingRecordingFps
      ? pendingRecordingFps
      : sourceRecordingFps;
    if (pendingRecordingFps && sourceRecordingFps === pendingRecordingFps) {
      pendingRecordingFpsRef.current = null;
    }

    setProject({
      ...nextProject,
      textInputMasking: masking,
      maxRecordingMinutes: resolvedMaxRecordingMinutes,
      sampleRate: resolvedSampleRate,
      recordingFps: resolvedRecordingFps,
    });
    setAppName(nextProject.name);
    setMaxRecordingMinutes(resolvedMaxRecordingMinutes);
    setMaxRecordingMinutesDraftValue(null);
    setSampleRate(resolvedSampleRate);
    setSampleRateDraftValue(null);
    setRecordingFps(resolvedRecordingFps);
    setRecordingFpsDraftValue(null);
    setRecordingFpsConfirmation(null);
    setRejourneyEnabled((nextProject as any).rejourneyEnabled ?? true);
    setRecordingEnabled(nextProject.recordingEnabled ?? true);
    setTextInputMasking(masking);
  };

  // Find project from context or fetch it
  useEffect(() => {
    const loadProject = async () => {
      // If no projectId provided, can't load anything
      if (!projectId) {
        setLoading(false);
        setError('No project selected');
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Try to find in context first for fast paint, then verify from the
        // single-project endpoint so stale bootstrap/project-list cache cannot
        // reset newer settings such as recordingFps on refresh.
        const contextProject = projects.find(a => a.id === projectId);
        if (contextProject) {
          applyProjectToForm(contextProject);
          setLoading(false);
        }

        const fetchedProject = await getProject(projectId);
        applyProjectToForm(fetchedProject);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load project');
      } finally {
        setLoading(false);
      }
    };

    loadProject();
  }, [projectId, projects]);

  // Load API keys
  useEffect(() => {
    const loadData = async () => {
      if (!projectId) return;

      // Load API Keys
      if (isSelfHosted) {
        try {
          setIsLoadingKeys(true);
          const keys = await getApiKeys(projectId);
          setApiKeys(keys);
        } catch (err) {
          setKeyError('Failed to load API keys');
        } finally {
          setIsLoadingKeys(false);
        }
      }
    };
    loadData();
  }, [projectId]);

  const handleSaveName = async () => {
    if (!project || !appName.trim()) {
      setSaveError('Project name cannot be empty');
      return;
    }

    if (appName.trim() === project.name) {
      return; // No change
    }

    try {
      setIsSaving(true);
      setSaveError(null);

      await updateProject(project.id, { name: appName.trim() });

      // Refresh projects list
      await refreshSessions();

      // Update local project
      setProject({ ...project, name: appName.trim() });
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to update project name');
    } finally {
      setIsSaving(false);
    }
  };

  const handleMaxRecordingMinutesChange = async (minutes: number): Promise<boolean> => {
    if (!project) {
      setDurationSaveError('Project not loaded');
      return false;
    }
    const clamped = normalizeMaxRecordingMinutes(minutes);
    if (clamped === maxRecordingMinutes) {
      return false;
    }
    const previous = maxRecordingMinutes;
    try {
      setIsSavingDuration(true);
      setDurationSaveError(null);
      pendingMaxRecordingMinutesRef.current = clamped;
      setMaxRecordingMinutes(clamped);
      const updatedProject = await updateProject(project.id, { maxRecordingMinutes: clamped });
      const confirmedMinutes = normalizeMaxRecordingMinutes(updatedProject.maxRecordingMinutes ?? clamped);
      pendingMaxRecordingMinutesRef.current = confirmedMinutes;
      setProject({ ...project, ...updatedProject, maxRecordingMinutes: confirmedMinutes });
      setMaxRecordingMinutes(confirmedMinutes);
      const currentSelectedProject = selectedProject?.id === project.id ? selectedProject : null;
      if (currentSelectedProject) {
        setSelectedProject({
          ...currentSelectedProject,
          ...(updatedProject as any),
          maxRecordingMinutes: confirmedMinutes,
          platforms: currentSelectedProject.platforms,
          bundleId: updatedProject.bundleId || currentSelectedProject.bundleId,
          createdAt: updatedProject.createdAt || currentSelectedProject.createdAt,
          sessionsLast7Days: currentSelectedProject.sessionsLast7Days,
          errorsLast7Days: currentSelectedProject.errorsLast7Days,
        });
      }
      await refreshSessions();
      return true;
    } catch (err) {
      pendingMaxRecordingMinutesRef.current = null;
      setDurationSaveError(err instanceof Error ? err.message : 'Failed to update max recording duration');
      setMaxRecordingMinutes(previous);
      return false;
    } finally {
      setIsSavingDuration(false);
    }
  };

  const handleMaxRecordingMinutesDraftChange = (minutes: number) => {
    setDurationSaveError(null);
    setMaxRecordingMinutesDraftValue(normalizeMaxRecordingMinutes(minutes));
  };

  const commitMaxRecordingMinutesDraft = async () => {
    const nextMinutes = maxRecordingMinutesDraftRef.current;
    if (isSavingDuration) {
      return;
    }
    if (!nextMinutes || nextMinutes === maxRecordingMinutes) {
      setMaxRecordingMinutesDraftValue(null);
      return;
    }
    setMaxRecordingMinutesDraftValue(null);
    await handleMaxRecordingMinutesChange(nextMinutes);
  };

  const handleSampleRateChange = async (rate: number): Promise<boolean> => {
    if (!project) {
      setSampleRateSaveError('Project not loaded');
      return false;
    }
    const clamped = normalizeSampleRate(rate);
    if (clamped === sampleRate) {
      return false;
    }
    const previous = sampleRate;
    try {
      setIsSavingSampleRate(true);
      setSampleRateSaveError(null);
      pendingSampleRateRef.current = clamped;
      setSampleRate(clamped);
      const updatedProject = await updateProject(project.id, { sampleRate: clamped });
      if (typeof updatedProject.sampleRate !== 'number') {
        throw new Error('Sample rate was not confirmed by the API.');
      }
      const confirmedRate = normalizeSampleRate(updatedProject.sampleRate);
      pendingSampleRateRef.current = confirmedRate;
      setProject({ ...project, ...updatedProject, sampleRate: confirmedRate });
      setSampleRate(confirmedRate);
      const currentSelectedProject = selectedProject?.id === project.id ? selectedProject : null;
      if (currentSelectedProject) {
        setSelectedProject({
          ...currentSelectedProject,
          ...(updatedProject as any),
          sampleRate: confirmedRate,
          platforms: currentSelectedProject.platforms,
          bundleId: updatedProject.bundleId || currentSelectedProject.bundleId,
          createdAt: updatedProject.createdAt || currentSelectedProject.createdAt,
          sessionsLast7Days: currentSelectedProject.sessionsLast7Days,
          errorsLast7Days: currentSelectedProject.errorsLast7Days,
        });
      }
      await refreshSessions();
      return true;
    } catch (err) {
      pendingSampleRateRef.current = null;
      setSampleRateSaveError(err instanceof Error ? err.message : 'Failed to update sample rate');
      setSampleRate(previous);
      return false;
    } finally {
      setIsSavingSampleRate(false);
    }
  };

  const handleSampleRateDraftChange = (rate: number) => {
    setSampleRateSaveError(null);
    setSampleRateDraftValue(normalizeSampleRate(rate));
  };

  const commitSampleRateDraft = async () => {
    const nextRate = sampleRateDraftRef.current;
    if (isSavingSampleRate) {
      return;
    }
    if (nextRate === null || nextRate === sampleRate) {
      setSampleRateDraftValue(null);
      return;
    }
    setSampleRateDraftValue(null);
    await handleSampleRateChange(nextRate);
  };

  const handleRecordingFpsChange = async (fps: RecordingFps): Promise<boolean> => {
    if (!project || fps === recordingFps) {
      return false;
    }
    const previous = recordingFps;
    try {
      setIsSavingRecordingFps(true);
      setRecordingFpsSaveError(null);
      pendingRecordingFpsRef.current = fps;
      setRecordingFps(fps);
      const updatedProject = await updateProject(project.id, { recordingFps: fps });
      if (typeof updatedProject.recordingFps !== 'number') {
        throw new Error('Recording FPS was not confirmed by the API.');
      }
      const confirmedFps = normalizeRecordingFps(updatedProject.recordingFps);
      pendingRecordingFpsRef.current = confirmedFps;
      setProject({ ...project, ...updatedProject, recordingFps: confirmedFps });
      setRecordingFps(confirmedFps);
      const currentSelectedProject = selectedProject?.id === project.id ? selectedProject : null;
      if (currentSelectedProject) {
        setSelectedProject({
          ...currentSelectedProject,
          ...(updatedProject as any),
          recordingFps: confirmedFps,
          platforms: currentSelectedProject.platforms,
          bundleId: updatedProject.bundleId || currentSelectedProject.bundleId,
          createdAt: updatedProject.createdAt || currentSelectedProject.createdAt,
          sessionsLast7Days: currentSelectedProject.sessionsLast7Days,
          errorsLast7Days: currentSelectedProject.errorsLast7Days,
        });
      }
      await refreshSessions();
      return true;
    } catch (err) {
      pendingRecordingFpsRef.current = null;
      setRecordingFpsSaveError(err instanceof Error ? err.message : 'Failed to update recording FPS');
      setRecordingFps(previous);
      return false;
    } finally {
      setIsSavingRecordingFps(false);
    }
  };

  const handleRecordingFpsDraftChange = (fps: RecordingFps) => {
    setRecordingFpsSaveError(null);
    setRecordingFpsDraftValue(fps);
  };

  const commitRecordingFpsDraft = async () => {
    const nextFps = recordingFpsDraftRef.current;
    if (isSavingRecordingFps || recordingFpsConfirmation) {
      return;
    }
    if (!nextFps || nextFps === recordingFps) {
      setRecordingFpsDraftValue(null);
      return;
    }
    if (nextFps > recordingFps) {
      setRecordingFpsConfirmation(nextFps);
      return;
    }
    setRecordingFpsDraftValue(null);
    await handleRecordingFpsChange(nextFps);
  };

  const handleConfirmRecordingFpsChange = async () => {
    if (!recordingFpsConfirmation) return;
    const saved = await handleRecordingFpsChange(recordingFpsConfirmation);
    if (saved) {
      setRecordingFpsDraftValue(null);
      setRecordingFpsConfirmation(null);
    }
  };

  const handleCancelRecordingFpsChange = () => {
    if (isSavingRecordingFps) return;
    setRecordingFpsDraftValue(null);
    setRecordingFpsConfirmation(null);
  };

  const handleToggleRecording = async (enabled: boolean) => {
    if (!project) {
      setRecordingSaveError('Project not loaded');
      return;
    }
    try {
      setIsSavingRecording(true);
      setRecordingSaveError(null);
      await updateProject(project.id, { recordingEnabled: enabled });
      await refreshSessions();
      setProject({ ...project, recordingEnabled: enabled });
      setRecordingEnabled(enabled);
    } catch (err) {
      setRecordingSaveError(err instanceof Error ? err.message : 'Failed to update recording status');
      // Revert the toggle on error
      setRecordingEnabled(!enabled);
    } finally {
      setIsSavingRecording(false);
    }
  };

  const handleToggleRejourney = async (enabled: boolean) => {
    if (!project) {
      setRejourneySaveError('Project not loaded');
      return;
    }
    try {
      setIsSavingRejourney(true);
      setRejourneySaveError(null);
      await updateProject(project.id, { rejourneyEnabled: enabled });
      await refreshSessions();
      setProject({ ...project, rejourneyEnabled: enabled });
      setRejourneyEnabled(enabled);
    } catch (err) {
      setRejourneySaveError(err instanceof Error ? err.message : 'Failed to update Rejourney status');
      // Revert the toggle on error
      setRejourneyEnabled(!enabled);
    } finally {
      setIsSavingRejourney(false);
    }
  };

  const handleTextInputMaskingChange = async (mode: TextInputMasking) => {
    if (!project || mode === textInputMasking) {
      return;
    }
    const previous = textInputMasking;
    try {
      setIsSavingMasking(true);
      setMaskingSaveError(null);
      pendingTextInputMaskingRef.current = mode;
      setTextInputMasking(mode);
      const updatedProject = await updateProject(project.id, { textInputMasking: mode });
      const confirmedMode = normalizeTextInputMasking(updatedProject.textInputMasking ?? mode);
      pendingTextInputMaskingRef.current = confirmedMode;
      setProject({ ...project, ...updatedProject, textInputMasking: confirmedMode });
      setTextInputMasking(confirmedMode);
      await refreshSessions();
    } catch (err) {
      pendingTextInputMaskingRef.current = null;
      setMaskingSaveError(err instanceof Error ? err.message : 'Failed to update text input masking');
      setTextInputMasking(previous);
    } finally {
      setIsSavingMasking(false);
    }
  };

  const handleCreateApiKey = async () => {
    if (!isSelfHosted) return;
    if (!project) return;
    setIsCreatingKey(true);
    try {
      setKeyError(null);
      const result = await createApiKey(project.id);
      setCreatedApiKey(result);
      // Refresh list
      const keys = await getApiKeys(project.id);
      setApiKeys(keys);
    } catch (err) {
      setKeyError(err instanceof Error ? err.message : 'Failed to create API key');
    } finally {
      setIsCreatingKey(false);
    }
  };

  const handleRevokeApiKey = async (id: string) => {
    if (!isSelfHosted) return;
    if (!window.confirm('Are you sure you want to revoke this API key? It will stop working immediately.')) return;
    try {
      await revokeApiKey(id);
      // Refresh list
      if (project) {
        const keys = await getApiKeys(project.id);
        setApiKeys(keys);
      }
    } catch (err) {
      setKeyError('Failed to revoke key');
    }
  };

  const handleSendDeleteOtp = async () => {
    if (!project) return;

    if (deleteConfirmText !== project.name) {
      setDeleteError('Project name does not match');
      return;
    }

    try {
      setIsSendingDeleteOtp(true);
      setDeleteError(null);
      setDeleteOtpMessage(null);

      const result = await requestProjectDeletionOtp(project.id, {
        confirmText: deleteConfirmText,
      });

      setDeleteOtpSent(true);
      setDeleteOtpMessage(result.devCode
        ? `OTP sent. Dev code: ${result.devCode}`
        : 'OTP sent to your email.');
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to send OTP');
    } finally {
      setIsSendingDeleteOtp(false);
    }
  };

  const handleDelete = async () => {
    if (deleteConfirmText !== project?.name) {
      setDeleteError('Project name does not match');
      return;
    }

    if (!deleteOtpCode.trim()) {
      setDeleteError('OTP code is required');
      return;
    }

    try {
      setIsDeleting(true);
      setDeleteError(null);

      await deleteProject(project.id, {
        confirmText: deleteConfirmText,
        otpCode: deleteOtpCode.trim().toUpperCase(),
      });

      await refreshSessions();

      navigate(`${pathPrefix}/general`);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete project');
    } finally {
      setIsDeleting(false);
    }
  };

  if (loading) {
    return <DashboardGhostLoader variant="settings" />;
  }

  if (error || !project) {
    return (
      <div className="firebase-settings-page firebase-project-settings-page min-h-screen bg-[#f8fafd] p-8">
        <div className="mx-auto max-w-5xl">
        <NeoCard className="p-6 border-rose-600 bg-rose-50">
          <div className="flex gap-4 items-center">
            <AlertTriangle className="text-rose-600 w-6 h-6" />
            <div>
              <h3 className="text-rose-900 font-semibold uppercase tracking-tight">Error Loading Project</h3>
              <p className="text-rose-700 text-sm font-bold mt-1">{error || 'Project not found'}</p>
            </div>
          </div>
        </NeoCard>
        </div>
      </div>
    );
  }

  const displayedMaxRecordingMinutes = maxRecordingMinutesDraft ?? maxRecordingMinutes;
  const displayedSampleRate = sampleRateDraft ?? sampleRate;
  const displayedRecordingFps = recordingFpsDraft ?? recordingFpsConfirmation ?? recordingFps;

  return (
    <div className="firebase-settings-page firebase-project-settings-page flex min-h-screen flex-col bg-[#f8fafd] font-sans text-slate-900">
      <DashboardPageHeader
        title="Project Settings"
        subtitle={`Configure ${project.name}`}
        icon={<Settings className="w-6 h-6" />}
        iconColor="bg-[#f4f4f5]"
      >
        {!canEdit ? <NeoBadge variant="warning">View Only</NeoBadge> : null}
      </DashboardPageHeader>

      <div className="settings-layout-content mx-auto w-full max-w-[1600px] flex-1 space-y-12 px-4 py-6 sm:px-6">

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Main Settings */}
          <div className="lg:col-span-2 space-y-6">

            {/* General Section */}
            <section className="space-y-4">
              <h2 className="text-xl font-semibold uppercase tracking-tight">General Information</h2>
              <NeoCard className="p-6">
                <div className="space-y-4">
                  <div className="flex gap-4 items-end">
                    <div className="flex-1">
                      <Input
                        label="Project Name"
                        value={appName}
                        onChange={(e) => {
                          setAppName(e.target.value);
                          setSaveError(null);
                        }}
                        disabled={!canEdit}
                        className="font-mono font-bold"
                      />
                    </div>
                    {canEdit && (
                      <NeoButton
                        variant="primary"
                        onClick={handleSaveName}
                        disabled={isSaving || !appName || appName === project.name}
                        leftIcon={<Save className="w-4 h-4" />}
                      >
                        {isSaving ? 'Saving...' : 'Save Changes'}
                      </NeoButton>
                    )}
                  </div>
                  {saveError && (
                    <p className="text-xs font-bold text-red-600 flex items-center gap-1 uppercase tracking-wide">
                      <AlertTriangle className="w-4 h-4" /> {saveError}
                    </p>
                  )}
                </div>
              </NeoCard>
            </section>

            {/* App Identifiers */}
            <section className="space-y-4">
              <h2 className="text-xl font-semibold uppercase tracking-tight">App Identifiers</h2>
              <NeoCard className="p-6">
                <div className="space-y-6">
                  {/* iOS Bundle ID */}
                  <div className="space-y-3">
                    <label className="text-sm font-bold font-mono uppercase text-black tracking-wide flex items-center gap-2">
                      <Smartphone className="w-4 h-4" />
                      iOS Bundle ID
                    </label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="com.example.app"
                        value={(project as any)._newBundleId ?? project.bundleId ?? ''}
                        onChange={(e) => setProject({ ...project, _newBundleId: e.target.value })}
                        disabled={!canEdit}
                        className="font-mono text-sm font-bold flex-1 border border-slate-100/80"
                      />
                      {canEdit && (
                        <NeoButton
                          variant="primary"
                          size="md"
                          disabled={
                            !((project as any)._newBundleId ?? project.bundleId) ||
                            (project as any)._newBundleId === project.bundleId ||
                            ((project as any)._newBundleId !== undefined && !!getIosBundleIdError((project as any)._newBundleId || ''))
                          }
                          onClick={async () => {
                            try {
                              const value = (project as any)._newBundleId ?? project.bundleId;
                              await updateProject(project.id, { bundleId: value });
                              await refreshSessions();
                              setProject({ ...project, bundleId: value, _newBundleId: undefined });
                            } catch (err) {
                              alert(err instanceof Error ? err.message : 'Failed to save');
                            }
                          }}
                        >
                          <Save className="w-4 h-4 mr-1" /> Save
                        </NeoButton>
                      )}
                    </div>
                    {(project as any)._newBundleId && getIosBundleIdError((project as any)._newBundleId) && (
                      <p className="text-xs font-bold text-red-600 flex items-center gap-1 uppercase">
                        <AlertTriangle className="w-3 h-3" /> {getIosBundleIdError((project as any)._newBundleId)}
                      </p>
                    )}
                  </div>

                  {/* Divider */}
                  <div className="h-[2px] bg-slate-200"></div>

                  {/* Android Package Name */}
                  <div className="space-y-3">
                    <label className="text-sm font-bold font-mono uppercase text-black tracking-wide flex items-center gap-2">
                      <Shield className="w-4 h-4" />
                      Android Package Name
                    </label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="com.example.app"
                        value={(project as any)._newPackageName ?? project.packageName ?? ''}
                        onChange={(e) => setProject({ ...project, _newPackageName: e.target.value })}
                        disabled={!canEdit}
                        className="font-mono text-sm font-bold flex-1 border border-slate-100/80"
                      />
                      {canEdit && (
                        <NeoButton
                          variant="primary"
                          size="md"
                          disabled={
                            !((project as any)._newPackageName ?? project.packageName) ||
                            (project as any)._newPackageName === project.packageName ||
                            ((project as any)._newPackageName !== undefined && !!getAndroidPackageError((project as any)._newPackageName || ''))
                          }
                          onClick={async () => {
                            try {
                              const value = (project as any)._newPackageName ?? project.packageName;
                              await updateProject(project.id, { packageName: value });
                              await refreshSessions();
                              setProject({ ...project, packageName: value, _newPackageName: undefined });
                            } catch (err) {
                              alert(err instanceof Error ? err.message : 'Failed to save');
                            }
                          }}
                        >
                          <Save className="w-4 h-4 mr-1" /> Save
                        </NeoButton>
                      )}
                    </div>
                    {(project as any)._newPackageName && getAndroidPackageError((project as any)._newPackageName) && (
                      <p className="text-xs font-bold text-red-600 flex items-center gap-1 uppercase">
                        <AlertTriangle className="w-3 h-3" /> {getAndroidPackageError((project as any)._newPackageName)}
                      </p>
                    )}
                  </div>
                </div>
              </NeoCard>
            </section>

            {/* Recording Status */}
            <section className="space-y-4">
              <h2 className="text-xl font-semibold uppercase tracking-tight">Remote Observability Toggles</h2>

              <NeoCard className="p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className="text-sm font-bold uppercase tracking-tight">Rejourney SDK</h3>
                      <span className={`text-[10px] font-black uppercase tracking-wide ${rejourneyEnabled ? 'text-emerald-700' : 'text-slate-400'}`}>
                        {isSavingRejourney ? 'Saving…' : rejourneyEnabled ? 'Active' : 'Disabled'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 font-medium leading-snug">
                      {rejourneyEnabled
                        ? 'SDK initializes and collects observability data.'
                        : 'SDK disabled — no data collected or sent from device.'}
                    </p>
                    {rejourneySaveError && (
                      <p className="text-[10px] text-red-600 mt-1 font-bold uppercase">{rejourneySaveError}</p>
                    )}
                  </div>
                  {canEdit && (
                    <button
                      type="button"
                      role="switch"
                      aria-checked={rejourneyEnabled}
                      onClick={() => handleToggleRejourney(!rejourneyEnabled)}
                      disabled={isSavingRejourney}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center border-2 border-slate-900 transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${rejourneyEnabled ? 'bg-emerald-500' : 'bg-slate-200'}`}
                    >
                      <span className={`inline-block h-4 w-4 border-2 border-slate-900 bg-white shadow transition-transform ${rejourneyEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </button>
                  )}
                </div>
              </NeoCard>

              <NeoCard className="p-4 mt-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className="text-sm font-bold uppercase tracking-tight">Session Recording</h3>
                      <span className={`text-[10px] font-black uppercase tracking-wide ${recordingEnabled && rejourneyEnabled ? 'text-emerald-700' : 'text-slate-400'}`}>
                        {isSavingRecording ? 'Saving…' : recordingEnabled ? 'Enabled' : 'Observe Only'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 font-medium leading-snug">
                      {recordingEnabled
                        ? 'Session replays are captured and uploaded. Toggle off to enable Observe Only mode.'
                        : 'Observe Only mode — analytics and issues tracked, no replays captured. Since analytics is still collected, each session still counts towards usage.'}
                    </p>
                    {!rejourneyEnabled && (
                      <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">Overridden by SDK toggle above.</p>
                    )}
                  </div>
                  {canEdit && (
                    <button
                      type="button"
                      role="switch"
                      aria-checked={recordingEnabled}
                      onClick={() => handleToggleRecording(!recordingEnabled)}
                      disabled={isSavingRecording || !rejourneyEnabled}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center border-2 border-slate-900 transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${recordingEnabled && rejourneyEnabled ? 'bg-emerald-500' : 'bg-slate-200'}`}
                    >
                      <span className={`inline-block h-4 w-4 border-2 border-slate-900 bg-white shadow transition-transform ${recordingEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </button>
                  )}
                </div>
              </NeoCard>

              <NeoCard className="p-6 mt-4">
                <div className="space-y-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <Shield className="w-5 h-5 text-slate-900" />
                      <h3 className="text-lg font-bold uppercase">Text Input Privacy</h3>
                      <NeoBadge variant={textInputMasking === 'all' ? 'success' : 'warning'}>
                        {isSavingMasking ? 'Saving' : textInputMasking === 'all' ? 'Privacy First' : 'Debug Detail'}
                      </NeoBadge>
                    </div>
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">Swift Package 0.2.0+ · React Native 1.2.0+</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4 max-w-2xl">
                      <button
                        type="button"
                        onClick={() => handleTextInputMaskingChange('all')}
                        disabled={!canEdit || isSavingMasking}
                        className={`text-left border-2 p-3 transition-all disabled:cursor-not-allowed disabled:opacity-60 ${textInputMasking === 'all' ? 'border-black bg-emerald-50 shadow-[3px_3px_0_0_#000]' : 'border-slate-200 bg-white hover:border-slate-400'}`}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-[10px] font-black uppercase text-slate-500">All Inputs</span>
                          {textInputMasking === 'all' && <CheckCircle className="w-4 h-4 text-emerald-700" />}
                        </div>
                        <div className="space-y-2">
                          <div className="h-3 w-24 max-w-full bg-slate-900" />
                          <div className="h-3 w-36 max-w-full bg-slate-900" />
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleTextInputMaskingChange('secure_only')}
                        disabled={!canEdit || isSavingMasking}
                        className={`text-left border-2 p-3 transition-all disabled:cursor-not-allowed disabled:opacity-60 ${textInputMasking === 'secure_only' ? 'border-black bg-amber-50 shadow-[3px_3px_0_0_#000]' : 'border-slate-200 bg-white hover:border-slate-400'}`}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-[10px] font-black uppercase text-slate-500">Secure Only</span>
                          {textInputMasking === 'secure_only' && <CheckCircle className="w-4 h-4 text-amber-700" />}
                        </div>
                        <div className="space-y-2">
                          <div className="border border-slate-300 bg-white p-2">
                            <div className="mb-1 text-[10px] font-black uppercase text-slate-400">Name</div>
                            <div className="truncate font-mono text-xs font-bold text-slate-800">Alex Morgan</div>
                          </div>
                          <div className="border border-slate-300 bg-white p-2">
                            <div className="mb-1 text-[10px] font-black uppercase text-slate-400">Password</div>
                            <div className="h-3 w-24 max-w-full bg-slate-900" />
                          </div>
                        </div>
                      </button>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-[10px] font-bold uppercase text-slate-500">
                      <span className="inline-flex items-center gap-1"><Shield className="w-3 h-3" /> Secure fields stay masked</span>
                    </div>
                    {maskingSaveError && (
                      <p className="text-xs text-red-600 mt-2 font-bold uppercase">{maskingSaveError}</p>
                    )}
                  </div>
                </div>
              </NeoCard>
            </section>

            {/* API Keys Section (Self Hosted Only) */}
            {isSelfHosted && (
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold uppercase tracking-tight">API Keys</h2>
                  {canEdit && (
                    <NeoButton size="sm" variant="secondary" onClick={() => { setShowCreateKeyModal(true); setCreatedApiKey(null); }}>
                      <Plus className="w-4 h-4" /> Create Key
                    </NeoButton>
                  )}
                </div>
                <NeoCard className="p-6">
                  <div className="space-y-4">
                    {isLoadingKeys ? (
                      <div className="text-center py-4 text-slate-500 text-sm font-bold uppercase animate-pulse">Loading keys...</div>
                    ) : apiKeys.length === 0 ? (
                      <div className="text-center py-8 bg-slate-50 border-2 border-dashed border-slate-900">
                        <Key className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                        <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">No API keys created yet</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {apiKeys.map((key) => (
                          <div key={key.id} className="flex items-center justify-between p-4 bg-slate-50 border-2 border-slate-900 hover:border-slate-700 transition-colors">
                            <div>
                              <div className="flex items-center gap-3">
                                <span className="font-mono text-sm font-bold text-slate-900">{key.truncatedKey}</span>
                                <NeoBadge variant="success" size="sm">Active</NeoBadge>
                              </div>
                              <div className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-wide">
                                Created {new Date(key.createdAt).toLocaleDateString()}
                                {key.lastUsedAt && ` • Last used ${new Date(key.lastUsedAt).toLocaleDateString()}`}
                              </div>
                            </div>
                            {canEdit && (
                              <NeoButton
                                variant="ghost"
                                size="sm"
                                className="text-red-600 hover:bg-red-50 hover:text-red-700"
                                onClick={() => handleRevokeApiKey(key.id)}
                              >
                                Revoke
                              </NeoButton>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </NeoCard>
              </section>
            )}

            {/* Danger Zone */}
            {canEdit && (
              <section className="space-y-4 pt-8">
                <h2 className="text-xl font-semibold uppercase tracking-tight text-red-600 flex items-center gap-2">
                  <AlertOctagon className="w-6 h-6" /> Danger Zone
                </h2>
                <NeoCard className="p-6 border-rose-600 bg-rose-50">
                  <div>
                    <h3 className="text-lg font-semibold text-rose-900 uppercase tracking-tight">Delete Project</h3>
                    <p className="text-rose-700 text-sm font-bold mt-1 max-w-xl">
                      Deleting a project is irreversible. All recordings, analytics, and data will be permanently removed.
                    </p>
                  </div>
                  <NeoButton
                    variant="danger"
                    onClick={() => setShowDeleteModal(true)}
                    leftIcon={<Trash2 className="w-4 h-4" />}
                    className="mt-4"
                  >
                    Delete Project Permanently
                  </NeoButton>
                </NeoCard>
              </section>
            )}
          </div>

          {/* Right Column: Configuration & Info */}
          <div className="space-y-8">
            {/* Recording Configuration */}
            <section className="space-y-4">
              <h2 className="text-xl font-semibold uppercase tracking-tight">Configuration</h2>
              <NeoCard className="p-6">
                <div className="divide-y divide-slate-200">
                  <div className="pb-6">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <label className="text-sm font-semibold uppercase text-slate-900 tracking-wide flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        Max Observability Duration
                        {isSavingDuration && <NeoBadge variant="neutral" size="sm">Saving</NeoBadge>}
                      </label>
                      <span className="font-mono text-sm font-black text-slate-900">{displayedMaxRecordingMinutes} min</span>
                    </div>
                    <div className="space-y-3">
                      <input
                        type="range"
                        min={1}
                        max={10}
                        step={1}
                        value={displayedMaxRecordingMinutes}
                        onChange={(e) => {
                          handleMaxRecordingMinutesDraftChange(Number(e.target.value));
                        }}
                        onPointerUp={() => {
                          void commitMaxRecordingMinutesDraft();
                        }}
                        onMouseUp={() => {
                          void commitMaxRecordingMinutesDraft();
                        }}
                        onTouchEnd={() => {
                          void commitMaxRecordingMinutesDraft();
                        }}
                        onKeyUp={(e) => {
                          if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
                            void commitMaxRecordingMinutesDraft();
                          }
                        }}
                        onBlur={() => {
                          void commitMaxRecordingMinutesDraft();
                        }}
                        disabled={!canEdit || isSavingDuration}
                        className="h-2 w-full cursor-pointer accent-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
                      />
                      <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wide text-slate-400">
                        <span>1 min</span>
                        <span>10 min</span>
                      </div>
                      {durationSaveError && (
                        <p className="text-xs font-bold text-red-600 mt-2 uppercase flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> {durationSaveError}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="pt-6">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div>
                        <label className="text-sm font-semibold uppercase text-slate-900 tracking-wide flex items-center gap-2">
                          <Percent className="w-4 h-4" />
                          Sample Rate
                          {isSavingSampleRate && <NeoBadge variant="neutral" size="sm">Saving</NeoBadge>}
                        </label>
                        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mt-0.5">Swift Package 0.2.0+ · React Native 1.2.0+</p>
                      </div>
                      <span className="font-mono text-sm font-black text-cyan-900">{displayedSampleRate}%</span>
                    </div>
                    <div className="space-y-3">
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={1}
                        value={displayedSampleRate}
                        onChange={(e) => {
                          handleSampleRateDraftChange(Number(e.target.value));
                        }}
                        onPointerUp={() => {
                          void commitSampleRateDraft();
                        }}
                        onMouseUp={() => {
                          void commitSampleRateDraft();
                        }}
                        onTouchEnd={() => {
                          void commitSampleRateDraft();
                        }}
                        onKeyUp={(e) => {
                          if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
                            void commitSampleRateDraft();
                          }
                        }}
                        onBlur={() => {
                          void commitSampleRateDraft();
                        }}
                        disabled={!canEdit || isSavingSampleRate}
                        className="h-2 w-full cursor-pointer accent-cyan-700 disabled:cursor-not-allowed disabled:opacity-60"
                      />
                      <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wide text-slate-400">
                        <span>0%</span>
                        <span>100%</span>
                      </div>
                      {sampleRateSaveError && (
                        <p className="text-xs font-bold text-red-600 uppercase flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> {sampleRateSaveError}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="pt-6">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div>
                        <label className="text-sm font-semibold uppercase text-slate-900 tracking-wide flex items-center gap-2">
                          Recording FPS
                          {isSavingRecordingFps && <NeoBadge variant="neutral" size="sm">Saving</NeoBadge>}
                        </label>
                        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mt-0.5">Swift Package 0.2.0+ · React Native 1.2.0+</p>
                      </div>
                      <span className="font-mono text-sm font-black text-cyan-900">{displayedRecordingFps} fps</span>
                    </div>
                    <div className="space-y-3">
                      <input
                        type="range"
                        min={1}
                        max={3}
                        step={1}
                        value={displayedRecordingFps}
                        onChange={(e) => {
                          handleRecordingFpsDraftChange(normalizeRecordingFps(Number(e.target.value)));
                        }}
                        onPointerUp={() => {
                          void commitRecordingFpsDraft();
                        }}
                        onMouseUp={() => {
                          void commitRecordingFpsDraft();
                        }}
                        onTouchEnd={() => {
                          void commitRecordingFpsDraft();
                        }}
                        onKeyUp={(e) => {
                          if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
                            void commitRecordingFpsDraft();
                          }
                        }}
                        onBlur={() => {
                          void commitRecordingFpsDraft();
                        }}
                        disabled={!canEdit || isSavingRecordingFps || Boolean(recordingFpsConfirmation)}
                        className="h-2 w-full cursor-pointer accent-cyan-700 disabled:cursor-not-allowed disabled:opacity-60"
                      />
                      {recordingFpsSaveError && (
                        <p className="text-xs font-bold text-red-600 uppercase flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> {recordingFpsSaveError}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </NeoCard>
            </section>

            {/* Technical Info */}
            <section className="space-y-4">
              <h2 className="text-xl font-semibold uppercase tracking-tight">Technical Details</h2>
              <NeoCard className="p-0 overflow-hidden">
                <div className="divide-y-2 divide-slate-200">
                  <div className="p-5 group hover:bg-slate-50 transition-colors">
                    <div className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2 flex items-center gap-2">
                      <Key className="w-3 h-3" /> Project ID
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="font-mono text-sm font-bold text-slate-900 break-all flex-1 bg-slate-50 px-3 py-2 border-2 border-slate-900">
                        {project.id}
                      </div>
                      <button
                        onClick={() => handleCopy(project.id, 'projectId')}
                        className="flex-shrink-0 p-2 hover:bg-slate-900 hover:text-white border border-slate-100/80 rounded transition-all active:scale-95"
                        title="Copy Project ID"
                      >
                        {copiedField === 'projectId' ? (
                          <Check className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="p-5 group hover:bg-slate-50 transition-colors">
                    <div className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2 flex items-center gap-2">
                      <Shield className="w-3 h-3" /> Public Key
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="font-mono text-sm font-bold text-slate-900 truncate flex-1 bg-slate-50 px-3 py-2 border-2 border-slate-900">
                        {project.publicKey}
                      </div>
                      <button
                        onClick={() => handleCopy(project.publicKey, 'publicKey')}
                        className="flex-shrink-0 p-2 hover:bg-slate-900 hover:text-white border border-slate-100/80 rounded transition-all active:scale-95"
                        title="Copy Public Key"
                      >
                        {copiedField === 'publicKey' ? (
                          <Check className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="p-5">
                    <div className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-3 flex items-center gap-2">
                      <Smartphone className="w-3 h-3" /> Platforms
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {project.platforms?.map((p: any) => (
                        <NeoBadge key={p} variant="info" size="md">{p}</NeoBadge>
                      )) || <span className="text-xs font-bold text-slate-400 uppercase">None configured</span>}
                    </div>
                  </div>
                </div>
              </NeoCard>
            </section>

          </div>
        </div>

        {/* Recording FPS Confirmation Modal */}
        <Modal
          isOpen={recordingFpsConfirmation !== null}
          onClose={handleCancelRecordingFpsChange}
          title="Confirm Recording FPS"
          footer={
            <div className="flex gap-2">
              <NeoButton
                variant="secondary"
                onClick={handleCancelRecordingFpsChange}
                disabled={isSavingRecordingFps}
              >
                Cancel
              </NeoButton>
              <NeoButton
                variant="primary"
                onClick={handleConfirmRecordingFpsChange}
                disabled={isSavingRecordingFps}
              >
                {isSavingRecordingFps ? 'Saving...' : 'OK'}
              </NeoButton>
            </div>
          }
        >
          <div className="space-y-4 py-2">
            <div className="flex gap-3 border border-amber-200 bg-amber-50 p-4 text-amber-900">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
              <div className="space-y-2 text-sm font-bold">
                <p>
                  Increasing capture FPS may result in performance issues and higher battery usage.
                </p>
                <p>
                  The safest and most tested setting is 1 FPS. If 1 FPS looks good, it is highly recommended to not change it.
                </p>
              </div>
            </div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Change recording from {recordingFps} FPS to {recordingFpsConfirmation ?? recordingFps} FPS?
            </p>
          </div>
        </Modal>

        {/* Create Key Modal */}
        <Modal
          isOpen={showCreateKeyModal}
          onClose={() => {
            setShowCreateKeyModal(false);
            setCreatedApiKey(null);
          }}
          title="Create API Key"
          footer={
            createdApiKey ? (
              <NeoButton onClick={() => setShowCreateKeyModal(false)}>Done</NeoButton>
            ) : (
              <div className="flex gap-2">
                <NeoButton variant="secondary" onClick={() => setShowCreateKeyModal(false)}>Cancel</NeoButton>
                <NeoButton onClick={handleCreateApiKey} disabled={isCreatingKey} variant="primary">
                  {isCreatingKey ? 'Creating...' : 'Create Key'}
                </NeoButton>
              </div>
            )
          }
        >
          {createdApiKey ? (
            <div className="space-y-4">
              <div className="bg-green-50 text-green-700 p-3 rounded-md border border-green-200 flex items-start gap-2 text-sm font-bold">
                <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <div>
                  <strong>KEY CREATED!</strong> Securely store this key now. It will not be shown again.
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 uppercase">API Key</label>
                <div className="flex gap-2">
                  <code className="flex-1 p-3 bg-slate-900 text-white rounded font-mono break-all text-xs">
                    {createdApiKey.key}
                  </code>
                  <NeoButton
                    variant="secondary"
                    size="sm"
                    onClick={() => navigator.clipboard.writeText(createdApiKey.key)}
                  >
                    <Copy className="w-4 h-4" />
                  </NeoButton>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4 py-4">
              <p className="text-slate-600 text-sm font-medium">
                This will create a new API key with full access scopes for the <strong>{project.name}</strong> project.
              </p>
              <div className="bg-rose-50 text-rose-800 p-3 rounded-md border border-rose-200 text-xs flex gap-2 font-bold">
                <Shield className="w-4 h-4 shrink-0" />
                Usually you only need the Public Key for client-side recording. Secret API keys are for backend administrative access.
              </div>
            </div>
          )}
        </Modal>

        {/* Delete Modal */}
        <Modal
          isOpen={showDeleteModal}
          onClose={() => {
            setShowDeleteModal(false);
            setDeleteConfirmText('');
            setDeleteOtpCode('');
            setDeleteOtpSent(false);
            setDeleteOtpMessage(null);
            setDeleteError(null);
          }}
          title="Delete Project"
          footer={
            <div className="flex gap-2">
              <NeoButton variant="secondary" onClick={() => {
                setShowDeleteModal(false);
                setDeleteConfirmText('');
                setDeleteOtpCode('');
                setDeleteOtpSent(false);
                setDeleteOtpMessage(null);
                setDeleteError(null);
              }}>Cancel</NeoButton>
              <NeoButton
                variant="danger"
                onClick={handleDelete}
                disabled={isDeleting || deleteConfirmText !== project.name || !deleteOtpCode.trim()}
              >
                {isDeleting ? 'Deleting...' : 'Permanently Delete'}
              </NeoButton>
            </div>
          }
        >
          <div className="space-y-5">
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <div className="flex gap-2 text-red-800 font-semibold mb-2 items-center">
                <AlertTriangle className="w-5 h-5" /> Warning: Final Confirmation
              </div>
              <p className="text-red-700 text-sm">
                This action will permanently purge <strong>{project.name}</strong> from the database. All recordings, analytics, funnel data, and user sessions will be immediately destroyed. This action <strong>cannot</strong> be undone.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                Type <strong className="font-mono">{project.name}</strong> to confirm:
              </label>
              <Input
                value={deleteConfirmText}
                onChange={(e) => {
                  setDeleteConfirmText(e.target.value);
                  setDeleteError(null);
                }}
                placeholder={project.name}
                className="border-red-200 focus:ring-red-500 focus:border-red-500"
              />
            </div>

            <div className="space-y-2">
              <NeoButton
                variant="secondary"
                onClick={handleSendDeleteOtp}
                disabled={isSendingDeleteOtp || deleteConfirmText !== project.name}
                className="w-full"
              >
                {isSendingDeleteOtp ? 'Sending OTP...' : deleteOtpSent ? 'Resend OTP' : 'Send OTP to Email'}
              </NeoButton>
              {deleteOtpMessage && (
                <p className="text-sm text-green-700 bg-green-50 border border-green-200 p-2 rounded">{deleteOtpMessage}</p>
              )}
            </div>

            {deleteOtpSent && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Enter OTP code:</label>
                <Input
                  value={deleteOtpCode}
                  onChange={(e) => {
                    setDeleteOtpCode(e.target.value);
                    setDeleteError(null);
                  }}
                  placeholder="XXXXXXXXXX"
                  maxLength={10}
                  className="border-red-200 focus:ring-red-500 focus:border-red-500 font-mono tracking-widest"
                />
              </div>
            )}

            {deleteError && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-100 p-2 rounded">{deleteError}</div>
            )}
          </div>
        </Modal>
      </div>
    </div>
  );
};

export default ProjectSettings;
