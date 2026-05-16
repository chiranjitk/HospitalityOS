/**
 * Automation Trigger Engine — Core Evaluation & Execution
 *
 * This is the heart of the StaySuite automation system.
 * It:
 * 1. Fetches all `active` automation rules for the tenant matching the event type
 * 2. Evaluates each rule's `triggerConditions` against the event payload
 * 3. For matching rules, executes each action in sequence
 * 4. Logs every execution to `AutomationExecutionLog`
 * 5. Updates the rule's execution stats (count, lastExecutedAt)
 * 6. Handles errors gracefully — one failed action or rule never crashes the system
 */

import { db } from '@/lib/db';
import { evaluateTriggerConditions } from './conditions';
import {
  executeAction,
  type AutomationContext,
  type Action,
  type ActionResult,
} from './actions';

// ── Types ──

/** Result of evaluating a single rule against an event */
export interface RuleEvaluation {
  ruleId: string;
  ruleName: string;
  matches: boolean;
  matchedConditions: string[];
  actionsExecuted: number;
  totalActions: number;
  actionResults: ActionResult[];
  errors: string[];
  durationMs: number;
}

/** Overall engine evaluation result */
export interface EngineResult {
  event: string;
  tenantId: string;
  timestamp: Date;
  rulesEvaluated: number;
  rulesMatched: number;
  rulesFailed: number;
  evaluations: RuleEvaluation[];
}

/**
 * Main entry point: evaluate and execute all automation rules for an event.
 *
 * This function:
 * - Fetches active rules for the tenant + event type
 * - Evaluates each rule's conditions against the payload
 * - Executes all actions for matching rules
 * - Logs results to `AutomationExecutionLog`
 * - Updates rule execution stats
 *
 * **Never throws.** All errors are caught and logged internally.
 *
 * @param context - The automation context (event, tenant, payload)
 * @returns A summary of all rule evaluations
 */
export async function evaluateAndExecuteRules(
  context: AutomationContext,
): Promise<EngineResult> {
  const startTime = Date.now();
  const result: EngineResult = {
    event: context.event,
    tenantId: context.tenantId,
    timestamp: context.timestamp,
    rulesEvaluated: 0,
    rulesMatched: 0,
    rulesFailed: 0,
    evaluations: [],
  };

  try {
    // Step 1: Fetch all active rules for this tenant + event type
    const rules = await db.automationRule.findMany({
      where: {
        tenantId: context.tenantId,
        triggerEvent: context.event,
        isActive: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    if (rules.length === 0) {
      return result;
    }

    result.rulesEvaluated = rules.length;

    // Step 2: Evaluate each rule
    for (const rule of rules) {
      const evaluation = await evaluateRule(rule, context);
      result.evaluations.push(evaluation);

      if (evaluation.matches) {
        result.rulesMatched++;
      }
      if (evaluation.errors.length > 0 && evaluation.actionsExecuted === 0) {
        result.rulesFailed++;
      }
    }

    return result;
  } catch (error) {
    // Top-level error — the engine itself failed (e.g., DB query error)
    console.error(
      `[AutomationEngine] Fatal error evaluating rules for "${context.event}":`,
      error instanceof Error ? error.message : error,
    );
    return result;
  } finally {
    const totalDuration = Date.now() - startTime;
    if (result.rulesEvaluated > 0) {
      console.log(
        `[AutomationEngine] Event "${context.event}" — ` +
        `${result.rulesEvaluated} rules evaluated, ${result.rulesMatched} matched, ` +
        `${result.rulesFailed} failed — ${totalDuration}ms`,
      );
    }
  }
}

/**
 * Evaluate a single rule: check conditions, execute actions, log results.
 */
async function evaluateRule(
  rule: {
    id: string;
    name: string;
    triggerConditions: string | null;
    actions: string;
    executionCount: number;
    lastExecutedAt: Date | null;
  },
  context: AutomationContext,
): Promise<RuleEvaluation> {
  const ruleStart = Date.now();

  const evaluation: RuleEvaluation = {
    ruleId: rule.id,
    ruleName: rule.name,
    matches: false,
    matchedConditions: [],
    actionsExecuted: 0,
    totalActions: 0,
    actionResults: [],
    errors: [],
    durationMs: 0,
  };

  try {
    // Step 1: Evaluate conditions
    const conditionsMatch = evaluateTriggerConditions(
      rule.triggerConditions,
      context.payload,
    );

    if (!conditionsMatch) {
      evaluation.durationMs = Date.now() - ruleStart;
      return evaluation;
    }

    evaluation.matches = true;

    // Step 2: Parse actions
    const actions = parseActions(rule.actions);
    if (actions === null) {
      evaluation.errors.push('Failed to parse actions JSON — must be a valid array');
      evaluation.durationMs = Date.now() - ruleStart;
      await logExecution(rule.id, context, 'failed', evaluation);
      return evaluation;
    }

    if (actions.length === 0) {
      evaluation.errors.push('Rule has no actions defined');
      evaluation.durationMs = Date.now() - ruleStart;
      await logExecution(rule.id, context, 'failed', evaluation);
      return evaluation;
    }

    evaluation.totalActions = actions.length;

    // Step 3: Execute actions sequentially (one failure doesn't stop others)
    for (const action of actions) {
      const actionResult = await executeAction(action, context);
      evaluation.actionResults.push(actionResult);

      if (actionResult.success) {
        evaluation.actionsExecuted++;
      } else if (actionResult.error) {
        evaluation.errors.push(
          `[${actionResult.actionType}] ${actionResult.error}`,
        );
      }
    }

    // Step 4: Determine overall status
    const hasFailures = evaluation.errors.length > 0;
    const status = hasFailures
      ? evaluation.actionsExecuted > 0
        ? 'partial'
        : 'failed'
      : 'success';

    evaluation.durationMs = Date.now() - ruleStart;

    // Step 5: Log execution + update rule stats
    await Promise.all([
      logExecution(rule.id, context, status, evaluation),
      updateRuleStats(rule.id, status === 'success'),
    ]);

    return evaluation;
  } catch (error) {
    evaluation.errors.push(
      error instanceof Error ? error.message : 'Unknown rule evaluation error',
    );
    evaluation.durationMs = Date.now() - ruleStart;

    // Log the failure
    await logExecution(rule.id, context, 'failed', evaluation).catch(() => {});

    return evaluation;
  }
}

/**
 * Parse the actions JSON string from a rule into an Action array.
 * Returns null if parsing fails or the result is not an array.
 */
function parseActions(actionsJson: string): Action[] | null {
  try {
    const parsed = JSON.parse(actionsJson);
    if (!Array.isArray(parsed)) {
      return null;
    }
    // Validate each action has a type
    return parsed.filter(
      (a: Record<string, unknown>) =>
        a && typeof a === 'object' && typeof a.type === 'string',
    ) as Action[];
  } catch {
    return null;
  }
}

/**
 * Create an execution log entry for a rule run.
 */
async function logExecution(
  ruleId: string,
  context: AutomationContext,
  status: 'success' | 'partial' | 'failed',
  evaluation: RuleEvaluation,
): Promise<void> {
  try {
    await db.automationExecutionLog.create({
      data: {
        ruleId,
        status,
        triggerData: JSON.stringify({
          event: context.event,
          payload: context.payload,
          timestamp: context.timestamp,
        }),
        actionsResult: JSON.stringify({
          matched: evaluation.matches,
          actionsExecuted: evaluation.actionsExecuted,
          totalActions: evaluation.totalActions,
          actionResults: evaluation.actionResults.map((r) => ({
            type: r.actionType,
            success: r.success,
            error: r.error,
            durationMs: r.durationMs,
          })),
          errors: evaluation.errors,
        }),
        errorMessage:
          evaluation.errors.length > 0
            ? evaluation.errors.join('; ')
            : null,
      },
    });
  } catch (error) {
    console.error(
      `[AutomationEngine] Failed to write execution log for rule ${ruleId}:`,
      error instanceof Error ? error.message : error,
    );
  }
}

/**
 * Update the rule's execution count and lastExecutedAt timestamp.
 */
async function updateRuleStats(
  ruleId: string,
  wasSuccess: boolean,
): Promise<void> {
  if (!wasSuccess) return; // Only update stats for successful runs

  try {
    await db.automationRule.update({
      where: { id: ruleId },
      data: {
        executionCount: { increment: 1 },
        lastExecutedAt: new Date(),
      },
    });
  } catch (error) {
    console.error(
      `[AutomationEngine] Failed to update stats for rule ${ruleId}:`,
      error instanceof Error ? error.message : error,
    );
  }
}
