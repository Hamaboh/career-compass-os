import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { bootstrapTestApp } from './utils/bootstrap-test-app';
import { MockAiOrchestrationService } from './utils/mock-ai-orchestration.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { hashPassword } from '../src/common/security/password-hash';
import { AiOrchestrationService } from '../src/modules/ai-orchestration/ai-orchestration.service';

/**
 * 自己分析〜目標形成ドメイン（Step: 自己分析〜夢・Why・目標形成）のe2eテスト。
 * 実際のAnthropic APIは呼ばず、MockAiOrchestrationServiceに差し替える
 * （test/utils/mock-mail.service.tsと同じ方針）。
 *
 * 重点的に検証するのは<constraints>/<ai_principles>由来の境界:
 *   - 内部スコア(emotionIntensityInternal等)がHTTPレスポンスに一切出ないこと
 *   - 他ユーザーの個人データにアクセスできないこと(RLS)
 *   - <why>要件: Whyが弱いままではLongTermGoalを確定できないこと（確定前ゲート）
 *   - <company_alignment>要件: 制度接続にgrowthNoteが必須であり、whyReconfirmedが
 *     機械的に算出されること
 */
// MVP完成フェーズでAppModuleのモジュール数が増え、フルブートストラップがJestデフォルトの
// 30秒hookタイムアウトを超える場合があるため、他のe2eスペックと同じく緩める。
jest.setTimeout(120000);

describe('自己分析〜目標形成ドメイン (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let mockAi: MockAiOrchestrationService;
  const password = 'TestPass123!';
  const suffix = Date.now();
  const ids: Record<string, string> = {};

  async function seedEmployee(key: string, role: 'ADMIN' | 'MEMBER') {
    const passwordHash = await hashPassword(password);
    const employee = await prisma.withSystemBypass((tx) =>
      tx.employee.create({
        data: {
          email: `${key}-${suffix}@example.com`,
          name: key,
          role,
          accountStatus: 'active',
          invitationStatus: 'activated',
          passwordHash,
        },
      }),
    );
    ids[key] = employee.id;
  }

  async function login(key: string): Promise<{ cookie: string; csrfToken: string }> {
    const res = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email: `${key}-${suffix}@example.com`, password })
      .expect(200);
    const cookies = res.get('Set-Cookie')!;
    const sessionCookie = cookies.find((c) => c.startsWith('__Host-session='))!.split(';')[0];
    const csrfCookie = cookies.find((c) => c.startsWith('csrf_token='))!.split(';')[0];
    return { cookie: `${sessionCookie}; ${csrfCookie}`, csrfToken: csrfCookie.split('=')[1] };
  }

  beforeAll(async () => {
    app = await bootstrapTestApp((builder) =>
      builder.overrideProvider(AiOrchestrationService).useClass(MockAiOrchestrationService),
    );
    prisma = app.get(PrismaService);
    mockAi = app.get(AiOrchestrationService) as unknown as MockAiOrchestrationService;

    await seedEmployee('admin', 'ADMIN');
    await seedEmployee('memberA', 'MEMBER');
    await seedEmployee('memberB', 'MEMBER');
  });

  afterAll(async () => {
    await app.close();
  });

  describe('自己分析: セッション・回答・内部スコアの非公開・RLS分離', () => {
    let memberA: { cookie: string; csrfToken: string };
    let memberB: { cookie: string; csrfToken: string };
    let sessionId: string;

    beforeAll(async () => {
      memberA = await login('memberA');
      memberB = await login('memberB');
      mockAi.setResponse('self-analysis.answer-classify.v1', { emotionIntensity: 10, topicTags: ['test'] });
    });

    it('セッションを開始すると最初の質問が返る', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/self-analysis/sessions')
        .set('Cookie', memberA.cookie)
        .set('X-CSRF-Token', memberA.csrfToken)
        .send({})
        .expect(201);
      sessionId = res.body.session.id;
      expect(res.body.nextQuestion.categoryCode).toBe('PAST_EXPERIENCE');
      expect(res.body.session.status).toBe('exploring');
    });

    it('回答するとAI分類が呼ばれ、内部スコアはレスポンスに含まれない', async () => {
      const res = await request(app.getHttpServer())
        .post(`/v1/self-analysis/sessions/${sessionId}/answers`)
        .set('Cookie', memberA.cookie)
        .set('X-CSRF-Token', memberA.csrfToken)
        .send({
          categoryCode: 'PAST_EXPERIENCE',
          questionText: 'これまでの仕事の中で、特に印象に残っている経験を教えてください。',
          depthLevel: 0,
          rawText: '十分な長さの、平静な回答文をここに書きます。特に強い感情語は含めません。',
        })
        .expect(201);

      expect(res.body.answer).not.toHaveProperty('emotionIntensityInternal');
      expect(res.body.nextQuestion.categoryCode).toBe('SUCCESS_ACHIEVEMENT');
      expect(mockAi.calls.some((c) => c.templateId === 'self-analysis.answer-classify.v1')).toBe(true);
    });

    it('他ユーザーは自己分析セッションにアクセスできない(RLS、404で存在も秘匿)', async () => {
      await request(app.getHttpServer())
        .get(`/v1/self-analysis/sessions/${sessionId}`)
        .set('Cookie', memberB.cookie)
        .expect(404);
    });

    it('自己分析インサイトのレスポンスにも内部スコアが含まれない(hidden-strength生成)', async () => {
      // 3カテゴリ分の回答を積み上げてhidden-strength生成の最低件数(3件)を満たす。
      await request(app.getHttpServer())
        .post(`/v1/self-analysis/sessions/${sessionId}/answers`)
        .set('Cookie', memberA.cookie)
        .set('X-CSRF-Token', memberA.csrfToken)
        .send({
          categoryCode: 'SUCCESS_ACHIEVEMENT',
          questionText: 'これまでで「うまくいった」「達成感があった」と感じた出来事は何ですか。',
          depthLevel: 0,
          rawText: '十分な長さの、平静な回答文をここに書きます。特に強い感情語は含めません。',
        })
        .expect(201);
      await request(app.getHttpServer())
        .post(`/v1/self-analysis/sessions/${sessionId}/answers`)
        .set('Cookie', memberA.cookie)
        .set('X-CSRF-Token', memberA.csrfToken)
        .send({
          categoryCode: 'FAILURE_DISSATISFACTION',
          questionText: 'これまでの仕事で、うまくいかなかった・不満だったと感じた出来事はありますか。',
          depthLevel: 0,
          rawText: '十分な長さの、平静な回答文をここに書きます。特に強い感情語は含めません。',
        })
        .expect(201);

      mockAi.setResponse('self-analysis.hidden-strength.v1', {
        contentText: 'テスト用の隠れた強み',
        confidenceScore: 70,
        gapEvidenceAnswerIds: [],
      });

      const res = await request(app.getHttpServer())
        .post('/v1/self-analysis/insights/hidden-strength')
        .set('Cookie', memberA.cookie)
        .set('X-CSRF-Token', memberA.csrfToken)
        .send({})
        .expect(201);

      expect(res.body).not.toHaveProperty('confidenceScoreInternal');
      expect(res.body.hiddenStrengthFlag).toBe(true);
      expect(res.body.userApproved).toBe(false); // <ai_principles>: AIの提示は未承認のまま保存される
      expect(res.body.confidenceIndicator).toEqual({ label: expect.any(String), note: expect.any(String) });
    });
  });

  describe('夢探索→Vision昇格', () => {
    let memberA: { cookie: string; csrfToken: string };
    let hypothesisId: string;

    beforeAll(async () => {
      memberA = await login('memberA');
      // generateHypotheses は承認済みインサイトを必要とするため、直接1件作成する。
      // self_analysis_insightsはADMINでもFOR SELECTのみ（書き込み不可）というRLS設計のため、
      // withSystemBypass（role=ADMIN扱い）では書き込めない。本人自身のRLSコンテキストで作成する
      // （これは設計どおりの正しい挙動 — <constraints>「個人データを他ユーザーに漏らさない」を
      // withSystemBypassですら迂回できないことがこのテストの失敗により実地で確認できた）。
      await prisma.withRlsContext(
        { employeeId: ids.memberA, role: 'MEMBER', unitId: null, ipAddress: null },
        (tx) =>
          tx.selfAnalysisInsight.create({
            data: {
              employeeId: ids.memberA,
              insightType: 'strength',
              contentText: 'テスト用の承認済みインサイト',
              derivedFromAnswerIds: [],
              userApproved: true,
              status: 'confirmed',
            },
        }),
      );
      mockAi.setResponse('dream.hypothesis-generate.v1', {
        hypotheses: [
          { text: '夢の仮説A', basis: '根拠A', confidenceScore: 60 },
          { text: '夢の仮説B', basis: '根拠B', confidenceScore: 50 },
        ],
      });
    });

    it('夢の仮説を複数生成する(単一の正解を押し付けない)', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/dream-hypotheses')
        .set('Cookie', memberA.cookie)
        .set('X-CSRF-Token', memberA.csrfToken)
        .send({})
        .expect(201);
      expect(res.body.length).toBeGreaterThanOrEqual(2);
      expect(res.body[0].source).toBe('ai_inferred');
      // DreamHypothesisはuserApprovedではなくuserReaction(agree/adjust/reject/undecided)を持つ
      // （Phase2 2.2節の3種の反応モデル）。生成直後は未反応でnull。
      expect(res.body[0].userReaction).toBeNull();
      hypothesisId = res.body[0].id;
    });

    it('仮説をVisionへ明示的に昇格できる(本人操作が必須)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/v1/dream-hypotheses/${hypothesisId}/promote-to-vision`)
        .set('Cookie', memberA.cookie)
        .set('X-CSRF-Token', memberA.csrfToken)
        .send({})
        .expect(201);
      expect(res.body.source).toBe('user_stated');
      expect(res.body.userApproved).toBe(true);
      expect(res.body.originDreamHypothesisId).toBe(hypothesisId);
    });
  });

  describe('<why>要件: Whyが弱いままではLongTermGoalを確定できない', () => {
    let memberA: { cookie: string; csrfToken: string };
    let visionId: string;
    let directionId: string;
    let goalId: string;

    beforeAll(async () => {
      memberA = await login('memberA');
      const visionRes = await request(app.getHttpServer())
        .post('/v1/visions')
        .set('Cookie', memberA.cookie)
        .set('X-CSRF-Token', memberA.csrfToken)
        .send({ content: 'エンジニアリング組織のリーダーになる' })
        .expect(201);
      visionId = visionRes.body.id;

      const directionRes = await request(app.getHttpServer())
        .post('/v1/directions')
        .set('Cookie', memberA.cookie)
        .set('X-CSRF-Token', memberA.csrfToken)
        .send({ visionId, content: 'マネジメントスキルを伸ばす方向性' })
        .expect(201);
      directionId = directionRes.body.id;

      const goalRes = await request(app.getHttpServer())
        .post('/v1/long-term-goals')
        .set('Cookie', memberA.cookie)
        .set('X-CSRF-Token', memberA.csrfToken)
        .send({ directionId, title: 'チームリーダーになる' })
        .expect(201);
      goalId = goalRes.body.id;
    });

    it('Whyが存在しない状態では確定できない(WHY_NOT_CONVINCING)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/v1/long-term-goals/${goalId}/confirm`)
        .set('Cookie', memberA.cookie)
        .set('X-CSRF-Token', memberA.csrfToken)
        .send({})
        .expect(400);
      expect(res.body.error.code).toBe('WHY_NOT_CONVINCING');
    });

    it('弱いWhyを提出しても確定できない(isWeak=trueのまま)', async () => {
      mockAi.setResponse('why.deepen.v1', {
        convictionScore: 20,
        isWeak: true,
        followUpQuestion: '本当にそれだけが理由ですか？もう少し深掘りしてみましょう。',
      });
      const answerRes = await request(app.getHttpServer())
        .post('/v1/why-records')
        .set('Cookie', memberA.cookie)
        .set('X-CSRF-Token', memberA.csrfToken)
        .send({ subjectType: 'long_term_goal', subjectId: goalId, userText: '会社に言われたからです。' })
        .expect(201);
      expect(answerRes.body.isWeak).toBe(true);
      expect(answerRes.body.whyRecord).not.toHaveProperty('convictionScoreInternal');

      const confirmRes = await request(app.getHttpServer())
        .post(`/v1/long-term-goals/${goalId}/confirm`)
        .set('Cookie', memberA.cookie)
        .set('X-CSRF-Token', memberA.csrfToken)
        .send({})
        .expect(400);
      expect(confirmRes.body.error.code).toBe('WHY_NOT_CONVINCING');
    });

    it('十分に強いWhyを提出すれば確定できる', async () => {
      mockAi.setResponse('why.deepen.v1', { convictionScore: 85, isWeak: false });
      const answerRes = await request(app.getHttpServer())
        .post('/v1/why-records')
        .set('Cookie', memberA.cookie)
        .set('X-CSRF-Token', memberA.csrfToken)
        .send({
          subjectType: 'long_term_goal',
          subjectId: goalId,
          userText: '自分自身が心から人の成長を支援したいと思っているからです。',
        })
        .expect(201);
      expect(answerRes.body.isWeak).toBe(false);

      // <smart_gate>要件（後続Stepで追加）: 確定にはSMART監査の実行も必要になった。
      mockAi.setResponse('smart.audit.v1', {
        specific: 'ok',
        measurable: 'ok',
        achievable: 'ok',
        relevant: 'ok',
        timebound: 'ok',
        auditNote: '良い目標です。',
        followUpQuestions: [],
      });
      await request(app.getHttpServer())
        .post(`/v1/long-term-goals/${goalId}/smart-audit`)
        .set('Cookie', memberA.cookie)
        .set('X-CSRF-Token', memberA.csrfToken)
        .send({})
        .expect(201);

      const confirmRes = await request(app.getHttpServer())
        .post(`/v1/long-term-goals/${goalId}/confirm`)
        .set('Cookie', memberA.cookie)
        .set('X-CSRF-Token', memberA.csrfToken)
        .send({})
        .expect(201);
      expect(confirmRes.body.status).toBe('confirmed');
    });

    it('<company_alignment>: 制度接続にはgrowthNoteが必須で、whyReconfirmedが自動算出される', async () => {
      const adminAuth = await login('admin');
      const kpiRes = await request(app.getHttpServer())
        .post('/v1/kpi-master')
        .set('Cookie', adminAuth.cookie)
        .set('X-CSRF-Token', adminAuth.csrfToken)
        .send({ title: 'テスト用会社KPI' })
        .expect(201);

      // growthNote必須（未指定なら400）
      await request(app.getHttpServer())
        .post('/v1/institutional-connections')
        .set('Cookie', memberA.cookie)
        .set('X-CSRF-Token', memberA.csrfToken)
        .send({
          connectableType: 'long_term_goal',
          connectableId: goalId,
          institutionType: 'kpi',
          institutionId: kpiRes.body.id,
          relevanceLabel: 'high',
        })
        .expect(400);

      const connRes = await request(app.getHttpServer())
        .post('/v1/institutional-connections')
        .set('Cookie', memberA.cookie)
        .set('X-CSRF-Token', memberA.csrfToken)
        .send({
          connectableType: 'long_term_goal',
          connectableId: goalId,
          institutionType: 'kpi',
          institutionId: kpiRes.body.id,
          relevanceLabel: 'high',
          growthNote: 'このKPIを追うことで自分のリーダーシップ力が鍛えられます。',
        })
        .expect(201);
      // goalIdは直前のテストで強いWhyが確定済みのため、whyReconfirmedはtrueになる。
      expect(connRes.body.whyReconfirmed).toBe(true);
    });

    it('目標候補の生成→受諾でLongTermGoalが作られる(<implementation_scope> 14〜15番)', async () => {
      mockAi.setResponse('goal-candidate.generate.v1', {
        candidates: [{ title: 'AI提案の目標', description: '説明文', rationale: 'Whyとの接続理由' }],
      });
      const genRes = await request(app.getHttpServer())
        .post('/v1/goal-candidates/generate')
        .set('Cookie', memberA.cookie)
        .set('X-CSRF-Token', memberA.csrfToken)
        .send({ directionId })
        .expect(201);
      expect(genRes.body.length).toBeGreaterThanOrEqual(1);
      const candidateId = genRes.body[0].id;

      const acceptRes = await request(app.getHttpServer())
        .post(`/v1/goal-candidates/${candidateId}/accept`)
        .set('Cookie', memberA.cookie)
        .set('X-CSRF-Token', memberA.csrfToken)
        .send({})
        .expect(201);
      expect(acceptRes.body.title).toBe('AI提案の目標');
      expect(acceptRes.body.source).toBe('ai_inferred');
      expect(acceptRes.body.userApproved).toBe(true); // 本人がacceptした時点で承認済みとして扱う
    });
  });
});
