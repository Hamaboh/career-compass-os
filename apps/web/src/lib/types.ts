import type { EmployeeRole, GoalHierarchyStatus, ContentSource } from '@career-compass/shared';

/** GET /auth/session, POST /auth/login のレスポンス。 */
export interface Session {
  employeeId: string;
  role: EmployeeRole;
  unitId: string | null;
}

export interface LoginResponse {
  id: string;
  name: string;
  role: EmployeeRole;
  unitId: string | null;
}

export interface Employee {
  id: string;
  email: string;
  name: string;
  role: EmployeeRole;
  unitId: string | null;
  positionId: string | null;
  accountStatus: 'pending' | 'active' | 'locked' | 'suspended' | 'deactivated';
  invitationStatus: string;
  createdAt: string;
  updatedAt: string;
}

export interface Unit {
  id: string;
  name: string;
  primaryUlEmployeeId: string | null;
  createdAt: string;
  updatedAt: string;
}

/** 5段階ラベル。common/utils/score-label.tsのtoQualitativeIndicator()が返す形。 */
export interface QualitativeIndicator {
  label: 'very_low' | 'low' | 'medium' | 'high' | 'very_high';
  note: string;
}

export interface Vision {
  id: string;
  employeeId: string;
  content: string;
  source: ContentSource;
  userApproved: boolean;
  status: GoalHierarchyStatus;
  createdAt: string;
  updatedAt: string;
}

export interface DreamHypothesis {
  id: string;
  employeeId: string;
  clusterId: string;
  version: number;
  hypothesisText: string;
  source: ContentSource;
  status: GoalHierarchyStatus;
  userReaction: 'agree' | 'partially_agree' | 'disagree' | null;
  linkedVisionId: string | null;
  createdAt: string;
}

export interface SelfAnalysisAnswer {
  id: string;
  sessionId: string;
  categoryCode: string;
  questionText: string;
  answerText: string;
  depthLevel: number;
  createdAt: string;
}

export interface PublicInsight {
  id: string;
  employeeId: string;
  insightType: string;
  contentText: string;
  userApproved: boolean;
  status: string;
  confidenceIndicator: QualitativeIndicator | null;
  createdAt: string;
}

export interface WhyRecord {
  id: string;
  employeeId: string;
  subjectType: string;
  subjectId: string;
  depthLevel: number;
  userText: string;
  source: ContentSource;
  status: string;
  convictionIndicator?: QualitativeIndicator | null;
  createdAt: string;
}

export interface Direction {
  id: string;
  employeeId: string;
  content: string;
  status: GoalHierarchyStatus;
  createdAt: string;
}

export interface LongTermGoal {
  id: string;
  employeeId: string;
  directionId: string | null;
  title: string;
  description: string | null;
  targetDate: string | null;
  source: ContentSource;
  userApproved: boolean;
  status: GoalHierarchyStatus;
  smartSpecific: 'ok' | 'needs_improvement' | 'insufficient' | null;
  smartMeasurable: 'ok' | 'needs_improvement' | 'insufficient' | null;
  smartAchievable: 'ok' | 'needs_improvement' | 'insufficient' | null;
  smartRelevant: 'ok' | 'needs_improvement' | 'insufficient' | null;
  smartTimebound: 'ok' | 'needs_improvement' | 'insufficient' | null;
  smartAuditedAt: string | null;
  smartOverrideReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Checkpoint {
  id: string;
  employeeId: string;
  longTermGoalId: string;
  title: string;
  description: string | null;
  targetDate: string | null;
  status: GoalHierarchyStatus;
  createdAt: string;
}

export interface Action {
  id: string;
  employeeId: string;
  checkpointId: string | null;
  longTermGoalId: string | null;
  title: string;
  description: string | null;
  dueDate: string | null;
  status: 'not_started' | 'in_progress' | 'done' | 'blocked';
  source: ContentSource;
  completedAt: string | null;
  createdAt: string;
}

export interface Evidence {
  id: string;
  actionId: string;
  title: string;
  description: string | null;
  url: string | null;
  submittedAt: string;
}

export interface ProgressEntry {
  id: string;
  employeeId: string;
  longTermGoalId: string | null;
  checkpointId: string | null;
  percentComplete: number;
  statusNote: string;
  recordedAt: string;
}

export interface Reflection {
  id: string;
  employeeId: string;
  longTermGoalId: string | null;
  checkpointId: string | null;
  prompt: string | null;
  content: string;
  createdAt: string;
}

export interface GoalAiInsight {
  id: string;
  employeeId: string;
  longTermGoalId: string;
  kind: 'issue_detected' | 'revision_candidate' | 'next_action_suggestion';
  contentText: string;
  basedOn: Record<string, unknown>;
  status: string;
  userApproved: boolean;
  confidenceIndicator: QualitativeIndicator | null;
  createdAt: string;
  reviewedAt: string | null;
}

export interface ReminderSchedule {
  id: string;
  employeeId: string;
  longTermGoalId: string | null;
  checkpointId: string | null;
  triggerType: 'interim_check' | 'deadline' | 'reflection';
  scheduledAt: string;
  status: 'pending' | 'due' | 'completed' | 'skipped';
  completedAt: string | null;
}

export interface OneOnOnePrepSheet {
  id: string;
  employeeId: string;
  unitLeaderId: string;
  previousSessionSummary: string | null;
  goalProgressSummary: string;
  changesSummary: string;
  issuesSummary: string;
  incompleteActionsSummary: string;
  achievementsSummary: string;
  fieldContextSummary: string;
  recommendedQuestions: string[];
  goalRevisionCandidates: string[];
  nextActionCandidates: string[];
  reviewedByUlAt: string | null;
  generatedAt: string;
}

export interface OneOnOneSession {
  id: string;
  employeeId: string;
  unitLeaderId: string;
  prepSheetId: string | null;
  scheduledAt: string | null;
  heldAt: string | null;
  notes: string | null;
  status: 'scheduled' | 'completed' | 'cancelled';
  createdAt: string;
}

export interface AppNotification {
  id: string;
  recipientEmployeeId: string;
  notificationType:
    | 'action_due'
    | 'interim_check'
    | 'reflection_prompt'
    | 'one_on_one_prep'
    | 'unanswered'
    | 'smart_incomplete'
    | 'goal_deadline'
    | 'goal_updated'
    | 'ai_important_suggestion';
  title: string;
  body: string;
  relatedType: string | null;
  relatedId: string | null;
  deliveredAt: string;
  readAt: string | null;
}

export interface KpiMaster {
  id: string;
  kpiFamilyId: string;
  versionNo: number;
  title: string;
  description: string | null;
  changeReason: string | null;
  status: 'active' | 'provisional' | 'archived';
  createdAt: string;
}

export interface UlmMaster {
  id: string;
  unitId: string | null;
  ulmFamilyId: string;
  versionNo: number;
  title: string;
  description: string | null;
  changeReason: string | null;
  status: 'active' | 'provisional' | 'archived';
  createdAt: string;
}

export interface InstitutionalConnection {
  id: string;
  employeeId: string;
  connectableType: 'long_term_goal' | 'checkpoint';
  connectableId: string;
  institutionType: 'kpi' | 'ulm';
  institutionId: string;
  relevanceLabel: string;
  growthNote: string;
  careerNote: string | null;
  whyReconfirmed: boolean;
  status: string;
  createdAt: string;
}

export interface EvaluationPeriod {
  id: string;
  periodType: 'quarter' | 'half_year' | 'fiscal_year' | 'custom';
  periodStartDate: string;
  periodEndDate: string;
  periodLabel: string;
}

export interface Competency {
  id: string;
  competencyName: string;
}

export interface Position {
  id: string;
  positionName: string;
  positionLevel: number;
}

export interface AppSettings {
  id: string;
  notificationDigestEnabled: boolean;
  defaultInterimCheckDays: number;
  defaultSmartRecheckDays: number;
  updatedByEmployeeId: string | null;
  updatedAt: string;
}

export interface AuditLogEntry {
  id: string;
  actorEmployeeId: string | null;
  actorType: 'human' | 'system';
  action: string;
  targetType: string | null;
  targetId: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  createdAt: string;
}

export interface Invitation {
  id: string;
  employeeId: string;
  status: 'pending' | 'opened' | 'otp_verified' | 'activated' | 'expired' | 'revoked';
  expiresAt: string;
  createdAt: string;
  employee: { id: string; name: string; email: string; role: EmployeeRole };
}
