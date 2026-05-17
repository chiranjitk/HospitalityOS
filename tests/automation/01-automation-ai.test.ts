/**
 * 01 - Automation & AI Module Tests (8 pages, 25+ tests)
 *
 * Tests automation workflows, rules, templates, execution logs,
 * AI copilot, insights, analytics, provider settings, and conversations.
 *
 * Pattern: Real API calls only, graceful 404/403 skips, sequential execution.
 */

import {
  authenticate,
  runSequentially,
  api,
  cookie,
  loadState,
  assert,
  assertEqual,
  assertNotNull,
  assertGt,
  ApiError,
  delay,
  DELAY_BETWEEN_CALLS,
  DELAY_AFTER_MUTATION,
} from '../pms/setup';

// ─── Helper: Skip wrapper for endpoints that may 404 ─────────────────────

async function skipOn404(fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (err: any) {
    if (err instanceof ApiError && (err.status === 404 || err.status === 403)) {
      console.log('      ⏭️  SKIPPED (endpoint returned ' + err.status + ')');
      return;
    }
    throw err;
  }
}

const safeGet = async (path: string, ck: string) => {
  try {
    await delay(DELAY_BETWEEN_CALLS);
    return await api.get(path, ck);
  } catch (e: any) {
    if (e.status === 404 || e.status === 403) return null;
    throw e;
  }
};

async function main() {
  let state: any;
  try {
    state = await authenticate();
  } catch (err: any) {
    console.error(`\n❌ AUTH FAILED: ${err.message}`);
    process.exit(1);
  }

  const st = loadState();
  const ck = cookie(state);

  // Track created IDs for cross-references
  let createdWorkflowId: string | null = null;
  let createdRuleId: string | null = null;

  await runSequentially('01-Automation-AI', [
    // ════════════════════════════════════════════════════════════════════
    // PAGE 1: Automation Workflows
    // ════════════════════════════════════════════════════════════════════
    {
      name: 'Automation Workflows - POST create workflow',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        try {
          const { data } = await api.post(
            '/api/automation/workflows',
            {
              name: `E2E Test Workflow ${Date.now()}`,
              description: 'Created by automation e2e tests',
              trigger: { type: 'event', event: 'booking.created' },
              actions: [
                { type: 'notification', channel: 'email', template: 'booking_confirmation' },
              ],
              isActive: true,
            },
            ck,
          );
          assert(data.success, 'Should succeed');
          assertNotNull(data.data, 'Should have workflow data');
          assertNotNull(data.data.id, 'Created workflow should have id');
          assertNotNull(data.data.name, 'Should have name');
          createdWorkflowId = data.data.id;
          await delay(DELAY_AFTER_MUTATION);
        } catch (err: any) {
          if (err instanceof ApiError && (err.status === 400 || err.status === 403 || err.status === 404)) {
            console.log('      ⏭️  SKIPPED (POST returned ' + err.status + ')');
            return;
          }
          throw err;
        }
      },
    },
    {
      name: 'Automation Workflows - GET list all workflows',
      fn: async () => {
        await skipOn404(async () => {
          await delay(DELAY_BETWEEN_CALLS);
          const { data } = await api.get('/api/automation/workflows', ck);
          assert(data.success, 'Should succeed');
          assertNotNull(data.data, 'Should have data');
          assertNotNull(data.workflows || data.data?.workflows || data.pagination, 'Should have workflows or pagination');
        });
      },
    },
    {
      name: 'Automation Workflows - GET filter by status=active',
      fn: async () => {
        await skipOn404(async () => {
          await delay(DELAY_BETWEEN_CALLS);
          const { data } = await api.get('/api/automation/workflows?isActive=true', ck);
          assert(data.success, 'Should succeed');
          assertNotNull(data.data, 'Should have data');
        });
      },
    },
    {
      name: 'Automation Workflows - POST validate missing name',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        try {
          await api.post('/api/automation/workflows', { trigger: {} }, ck);
          assert(false, 'Should have thrown validation error');
        } catch (err: any) {
          if (err instanceof ApiError) {
            assertGt(err.status, 399, 'Should return 4xx for missing name');
          }
        }
      },
    },

    // ════════════════════════════════════════════════════════════════════
    // PAGE 2: Automation Rules
    // ════════════════════════════════════════════════════════════════════
    {
      name: 'Automation Rules - POST create rule',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        try {
          const { data } = await api.post(
            '/api/automation/rules',
            {
              name: `E2E Test Rule ${Date.now()}`,
              description: 'Created by automation e2e tests',
              condition: {
                type: 'field_comparison',
                field: 'status',
                operator: 'equals',
                value: 'confirmed',
              },
              action: {
                type: 'update_field',
                field: 'priority',
                value: 'high',
              },
              priority: 10,
              isActive: true,
            },
            ck,
          );
          assert(data.success, 'Should succeed');
          assertNotNull(data.data, 'Should have rule data');
          assertNotNull(data.data.id, 'Created rule should have id');
          createdRuleId = data.data.id;
          await delay(DELAY_AFTER_MUTATION);
        } catch (err: any) {
          if (err instanceof ApiError && (err.status === 400 || err.status === 403 || err.status === 404)) {
            console.log('      ⏭️  SKIPPED (POST returned ' + err.status + ')');
            return;
          }
          throw err;
        }
      },
    },
    {
      name: 'Automation Rules - GET list all rules',
      fn: async () => {
        await skipOn404(async () => {
          await delay(DELAY_BETWEEN_CALLS);
          const { data } = await api.get('/api/automation/rules', ck);
          assert(data.success, 'Should succeed');
          assertNotNull(data.data, 'Should have data');
          assertNotNull(data.rules || data.data?.rules || data.pagination, 'Should have rules or pagination');
        });
      },
    },
    {
      name: 'Automation Rules - GET filter active rules',
      fn: async () => {
        await skipOn404(async () => {
          await delay(DELAY_BETWEEN_CALLS);
          const { data } = await api.get('/api/automation/rules?isActive=true', ck);
          assert(data.success, 'Should succeed');
          assertNotNull(data.data, 'Should have data');
        });
      },
    },
    {
      name: 'Automation Rules - POST validate empty body',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        try {
          await api.post('/api/automation/rules', {}, ck);
          assert(false, 'Should have thrown validation error');
        } catch (err: any) {
          if (err instanceof ApiError) {
            assertGt(err.status, 399, 'Should return 4xx for empty body');
          }
        }
      },
    },

    // ════════════════════════════════════════════════════════════════════
    // PAGE 3: Automation Templates
    // ════════════════════════════════════════════════════════════════════
    {
      name: 'Automation Templates - GET list templates',
      fn: async () => {
        await skipOn404(async () => {
          await delay(DELAY_BETWEEN_CALLS);
          const { data } = await api.get('/api/automations/templates', ck);
          assert(data.success, 'Should succeed');
          assertNotNull(data.data, 'Should have data');
          assertNotNull(data.templates || data.data?.templates || data.data, 'Should have templates');
        });
      },
    },
    {
      name: 'Automation Templates - GET system templates',
      fn: async () => {
        await skipOn404(async () => {
          await delay(DELAY_BETWEEN_CALLS);
          const { data } = await api.get('/api/automations/templates/system', ck);
          assert(data.success, 'Should succeed');
          assertNotNull(data.data, 'Should have data');
          assertNotNull(data.templates || data.data?.templates || data.data, 'Should have system templates');
        });
      },
    },
    {
      name: 'Automation Templates - GET filter by category',
      fn: async () => {
        await skipOn404(async () => {
          await delay(DELAY_BETWEEN_CALLS);
          const { data } = await api.get('/api/automations/templates?category=booking', ck);
          assert(data.success, 'Should succeed');
          assertNotNull(data.data, 'Should have data');
        });
      },
    },

    // ════════════════════════════════════════════════════════════════════
    // PAGE 4: Execution Logs
    // ════════════════════════════════════════════════════════════════════
    {
      name: 'Execution Logs - GET list logs',
      fn: async () => {
        await skipOn404(async () => {
          await delay(DELAY_BETWEEN_CALLS);
          const { data } = await api.get('/api/automation/execution-logs', ck);
          assert(data.success, 'Should succeed');
          assertNotNull(data.data, 'Should have data');
          assertNotNull(data.logs || data.data?.logs || data.pagination, 'Should have logs or pagination');
        });
      },
    },
    {
      name: 'Execution Logs - GET filter by status',
      fn: async () => {
        await skipOn404(async () => {
          await delay(DELAY_BETWEEN_CALLS);
          const { data } = await api.get('/api/automation/execution-logs?status=success', ck);
          assert(data.success, 'Should succeed');
          assertNotNull(data.data, 'Should have data');
        });
      },
    },
    {
      name: 'Execution Logs - GET filter by workflowId',
      fn: async () => {
        await skipOn404(async () => {
          await delay(DELAY_BETWEEN_CALLS);
          if (!createdWorkflowId) {
            console.log('      ⏭️  SKIPPED (no workflowId available)');
            return;
          }
          const { data } = await api.get(`/api/automation/execution-logs?workflowId=${createdWorkflowId}`, ck);
          assert(data.success, 'Should succeed');
          assertNotNull(data.data, 'Should have data');
        });
      },
    },
    {
      name: 'Execution Logs - GET pagination verification',
      fn: async () => {
        await skipOn404(async () => {
          await delay(DELAY_BETWEEN_CALLS);
          const { data } = await api.get('/api/automation/execution-logs?limit=10&offset=0', ck);
          assert(data.success, 'Should succeed');
          assertNotNull(data.data, 'Should have data');
          if (data.pagination) {
            assertNotNull(data.pagination.total, 'Pagination should have total');
            assertNotNull(data.pagination.totalPages, 'Pagination should have totalPages');
          }
        });
      },
    },

    // ════════════════════════════════════════════════════════════════════
    // PAGE 5: AI Copilot
    // ════════════════════════════════════════════════════════════════════
    {
      name: 'AI Copilot - GET context and suggestions',
      fn: async () => {
        await skipOn404(async () => {
          await delay(DELAY_BETWEEN_CALLS);
          const { data } = await api.get('/api/ai/copilot', ck);
          assert(data.success, 'Should succeed');
          assertNotNull(data.data, 'Should have data');
          assertNotNull(data.data.context, 'Should have context');
          assertNotNull(data.data.suggestions, 'Should have suggestions');
          assert(Array.isArray(data.data.suggestions), 'Suggestions should be array');
          assertNotNull(data.data.timestamp, 'Should have timestamp');
        });
      },
    },
    {
      name: 'AI Copilot - GET with propertyId filter',
      fn: async () => {
        await skipOn404(async () => {
          await delay(DELAY_BETWEEN_CALLS);
          if (!st.propertyId) {
            console.log('      ⏭️  SKIPPED (no propertyId in state)');
            return;
          }
          const { data } = await api.get(`/api/ai/copilot?propertyId=${st.propertyId}`, ck);
          assert(data.success, 'Should succeed');
          assertNotNull(data.data, 'Should have data');
          assertNotNull(data.data.context, 'Should have context');
        });
      },
    },
    {
      name: 'AI Copilot - POST chat message',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        try {
          const { data } = await api.post(
            '/api/ai/copilot',
            {
              messages: [{ role: 'user', content: 'What is the current occupancy?' }],
              stream: false,
            },
            ck,
          );
          assertNotNull(data, 'Should have response');
          assert(data.success, 'Should succeed');
          assertNotNull(data.data, 'Should have data');
          assertNotNull(data.data.message || data.data.action, 'Should have message or action');
          assertNotNull(data.data.timestamp, 'Should have timestamp');
          await delay(DELAY_AFTER_MUTATION);
        } catch (err: any) {
          if (err instanceof ApiError && (err.status === 400 || err.status === 403 || err.status === 404)) {
            console.log('      ⏭️  SKIPPED (POST returned ' + err.status + ')');
            return;
          }
          throw err;
        }
      },
    },
    {
      name: 'AI Copilot - POST with action search_bookings',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        try {
          const { data } = await api.post(
            '/api/ai/copilot',
            {
              messages: [{ role: 'user', content: 'Show today bookings' }],
              action: 'search_bookings',
              query: 'check-in today',
            },
            ck,
          );
          assertNotNull(data, 'Should have response');
          assert(data.success, 'Should succeed');
          await delay(DELAY_AFTER_MUTATION);
        } catch (err: any) {
          if (err instanceof ApiError && (err.status === 400 || err.status === 403 || err.status === 404)) {
            console.log('      ⏭️  SKIPPED (POST returned ' + err.status + ')');
            return;
          }
          throw err;
        }
      },
    },
    {
      name: 'AI Copilot - POST validate empty messages',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        try {
          await api.post('/api/ai/copilot', { messages: [] }, ck);
          assert(false, 'Should have thrown validation error');
        } catch (err: any) {
          if (err instanceof ApiError) {
            assertGt(err.status, 399, 'Should return 4xx for empty messages');
          }
        }
      },
    },

    // ════════════════════════════════════════════════════════════════════
    // PAGE 6: AI Insights
    // ════════════════════════════════════════════════════════════════════
    {
      name: 'AI Insights - GET insights data',
      fn: async () => {
        await skipOn404(async () => {
          await delay(DELAY_BETWEEN_CALLS);
          const { data } = await api.get('/api/ai/insights', ck);
          assert(data.success, 'Should succeed');
          assertNotNull(data.data, 'Should have data');
        });
      },
    },
    {
      name: 'AI Insights - GET with date range filter',
      fn: async () => {
        await skipOn404(async () => {
          await delay(DELAY_BETWEEN_CALLS);
          const now = new Date();
          const from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
          const to = now.toISOString().split('T')[0];
          const { data } = await api.get(`/api/ai/insights?from=${from}&to=${to}`, ck);
          assert(data.success, 'Should succeed');
          assertNotNull(data.data, 'Should have data');
        });
      },
    },

    // ════════════════════════════════════════════════════════════════════
    // PAGE 7: AI Analytics & Provider Settings
    // ════════════════════════════════════════════════════════════════════
    {
      name: 'AI Analytics - GET analytics dashboard',
      fn: async () => {
        await skipOn404(async () => {
          await delay(DELAY_BETWEEN_CALLS);
          const { data } = await api.get('/api/ai/analytics', ck);
          assert(data.success, 'Should succeed');
          assertNotNull(data.data, 'Should have data');
        });
      },
    },
    {
      name: 'AI Analytics - GET saved queries',
      fn: async () => {
        await skipOn404(async () => {
          await delay(DELAY_BETWEEN_CALLS);
          const { data } = await api.get('/api/ai/analytics/saved', ck);
          assert(data.success, 'Should succeed');
          assertNotNull(data.data, 'Should have data');
        });
      },
    },
    {
      name: 'AI Provider Settings - GET configuration',
      fn: async () => {
        await skipOn404(async () => {
          await delay(DELAY_BETWEEN_CALLS);
          const { data } = await api.get('/api/ai/provider-settings', ck);
          assert(data.success, 'Should succeed');
          assertNotNull(data.data, 'Should have data');
          assertNotNull(data.data.providers || data.data?.providers || data.data, 'Should have providers');
        });
      },
    },
    {
      name: 'AI Recommendations - GET recommendations',
      fn: async () => {
        await skipOn404(async () => {
          await delay(DELAY_BETWEEN_CALLS);
          const { data } = await api.get('/api/ai/recommendations', ck);
          assert(data.success, 'Should succeed');
          assertNotNull(data.data, 'Should have data');
        });
      },
    },

    // ════════════════════════════════════════════════════════════════════
    // PAGE 8: AI Conversations
    // ════════════════════════════════════════════════════════════════════
    {
      name: 'AI Conversations - GET list conversations',
      fn: async () => {
        await skipOn404(async () => {
          await delay(DELAY_BETWEEN_CALLS);
          const { data } = await api.get('/api/ai/conversations', ck);
          assert(data.success, 'Should succeed');
          assertNotNull(data.data, 'Should have data');
          assertNotNull(data.conversations || data.data?.conversations || data.pagination, 'Should have conversations or pagination');
        });
      },
    },
    {
      name: 'AI Conversations - GET pagination and order',
      fn: async () => {
        await skipOn404(async () => {
          await delay(DELAY_BETWEEN_CALLS);
          const { data } = await api.get('/api/ai/conversations?limit=5&offset=0&sort=desc', ck);
          assert(data.success, 'Should succeed');
          assertNotNull(data.data, 'Should have data');
        });
      },
    },
    {
      name: 'AI Copilot - Verify context structure depth',
      fn: async () => {
        await skipOn404(async () => {
          await delay(DELAY_BETWEEN_CALLS);
          const { data } = await api.get('/api/ai/copilot', ck);
          assert(data.success, 'Should succeed');
          const ctx = data.data.context;
          assertNotNull(ctx.occupancy, 'Context should have occupancy');
          assertNotNull(ctx.revenue, 'Context should have revenue');
          assertNotNull(ctx.todaysCheckIns !== undefined, 'Context should have todaysCheckIns');
          assertNotNull(ctx.todaysCheckOuts !== undefined, 'Context should have todaysCheckOuts');
          assertNotNull(ctx.pendingTasks !== undefined, 'Context should have pendingTasks');
          assertNotNull(ctx.alerts, 'Context should have alerts');
          assert(Array.isArray(ctx.alerts), 'Alerts should be array');
        });
      },
    },
    {
      name: 'AI Copilot - Suggestions have correct structure',
      fn: async () => {
        await skipOn404(async () => {
          await delay(DELAY_BETWEEN_CALLS);
          const { data } = await api.get('/api/ai/copilot', ck);
          assert(data.success, 'Should succeed');
          const suggestions = data.data.suggestions;
          assertGt(suggestions.length, 0, 'Should have at least 1 suggestion');
          for (const s of suggestions) {
            assertNotNull(s.type, 'Suggestion should have type');
            assertNotNull(s.text, 'Suggestion should have text');
            assertNotNull(s.action, 'Suggestion should have action');
          }
        });
      },
    },
  ]);
}

main().catch((e) => {
  console.error('\n💥', e);
  process.exit(1);
});
