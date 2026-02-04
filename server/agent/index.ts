import { generateText, tool, Message } from 'ai';
import { google } from '@ai-sdk/google';
import { z } from 'zod';
import { Expense } from './types';
import {
  sum,
  mean,
  median,
  min,
  max,
} from '../utils/math-helpers';
import { groupBy } from '../utils/array-helpers';
import { isBetween } from '../utils/date-helpers';
import { detectAnomalies } from '../utils/anomaly-helper';
import { deepDelete } from '../utils/general';

// System prompt with date anchor and guidance
const SYSTEM_PROMPT = `You are a helpful personal finance assistant that analyzes expense data through natural dialogue.

**Today's date is December 30, 2025.** Use this to resolve relative date references:
- "last month" = November 2025 (Nov 1-30)
- "this month" = December 2025 (Dec 1-30)
- Bare month names (e.g., "September", "October") = 2025 unless context suggests otherwise

When the user asks for comparisons (e.g., "September vs October"), make multiple tool calls with different date ranges in a single step. For "top N" questions, use the \`get_spending_by_category\` tool with the \`topN\` parameter.

Each tool accepts optional filter parameters internally, so you can filter by category, date range, amount threshold, and exclude anomalies all in one call.

**Response format:**
- Always respond in Markdown
- Use tables, bold, and bullet points for clarity
- Round dollar amounts to 2 decimal places with a \`$\` prefix
- Be concise but informative

**Anomaly detection:** When excluding outliers, the threshold is mean + 2 × standard deviation.`;

// Tool schemas and definitions
const filterExpensesSchema = z.object({
  category: z
    .string()
    .optional()
    .describe('Filter by category name (e.g. "groceries", "dining")'),
  startDate: z
    .string()
    .optional()
    .describe('Start date in YYYY-MM-DD format (inclusive)'),
  endDate: z
    .string()
    .optional()
    .describe('End date in YYYY-MM-DD format (inclusive)'),
  minAmount: z
    .number()
    .optional()
    .describe('Minimum expense amount (inclusive)'),
  maxAmount: z
    .number()
    .optional()
    .describe('Maximum expense amount (inclusive)'),
  excludeAnomalies: z
    .boolean()
    .optional()
    .describe(
      'If true, exclude statistical outliers (amount > mean + 2*stddev)'
    ),
  limit: z
    .number()
    .optional()
    .describe('Maximum number of results to return'),
});

const calculateStatisticsSchema = z.object({
  metric: z
    .enum(['sum', 'mean', 'median', 'min', 'max'])
    .describe('The statistical metric to calculate'),
  category: z
    .string()
    .optional()
    .describe('Filter by category name'),
  startDate: z
    .string()
    .optional()
    .describe('Start date in YYYY-MM-DD format (inclusive)'),
  endDate: z
    .string()
    .optional()
    .describe('End date in YYYY-MM-DD format (inclusive)'),
  minAmount: z
    .number()
    .optional()
    .describe('Minimum expense amount (inclusive)'),
  maxAmount: z
    .number()
    .optional()
    .describe('Maximum expense amount (inclusive)'),
  excludeAnomalies: z
    .boolean()
    .optional()
    .describe(
      'If true, exclude statistical outliers before computing the metric'
    ),
});

const getSpendingByCategorySchema = z.object({
  startDate: z
    .string()
    .optional()
    .describe('Start date in YYYY-MM-DD format (inclusive)'),
  endDate: z
    .string()
    .optional()
    .describe('End date in YYYY-MM-DD format (inclusive)'),
  metric: z
    .enum(['sum', 'mean', 'median', 'count'])
    .optional()
    .default('sum')
    .describe('The metric to compute per category'),
  excludeAnomalies: z
    .boolean()
    .optional()
    .describe(
      'If true, exclude statistical outliers within each category before computing'
    ),
  topN: z
    .number()
    .optional()
    .describe('If set, return only the top N categories by the computed metric'),
});

const filterExpensesTool = tool({
  description:
    'Filter and retrieve a list of expenses matching specified criteria. Returns a formatted table of matching expenses.',
  inputSchema: filterExpensesSchema,
});

const calculateStatisticsTool = tool({
  description:
    'Calculate a single metric (sum, mean, median, min, max) on filtered expense data. Returns the computed value with context.',
  inputSchema: calculateStatisticsSchema,
});

const getSpendingByCategoryTool = tool({
  description:
    'Group expenses by category and compute an aggregate metric per category. Useful for seeing spending breakdown by category.',
  inputSchema: getSpendingByCategorySchema,
});

// Shared filter helper
function applyFilters(
  expenses: Expense[],
  params: {
    category?: string;
    startDate?: string;
    endDate?: string;
    minAmount?: number;
    maxAmount?: number;
  }
): Expense[] {
  let filtered = expenses;

  if (params.category) {
    const categoryLower = params.category.toLowerCase();
    filtered = filtered.filter(
      (e) => e.category?.toLowerCase() === categoryLower
    );
  }

  if (params.startDate || params.endDate) {
    filtered = filtered.filter((e) =>
      isBetween(e.date, params.startDate, params.endDate)
    );
  }

  if (params.minAmount !== undefined) {
    filtered = filtered.filter((e) => e.amount >= params.minAmount!);
  }

  if (params.maxAmount !== undefined) {
    filtered = filtered.filter((e) => e.amount <= params.maxAmount!);
  }

  return filtered;
}

// Tool execution dispatcher
function executeTool(
  toolName: string,
  toolInput: Record<string, unknown>,
  expenses: Expense[]
): string | Record<string, unknown> {
  const input = toolInput as any;

  if (toolName === 'filter_expenses') {
    let filtered = applyFilters(expenses, {
      category: input.category,
      startDate: input.startDate,
      endDate: input.endDate,
      minAmount: input.minAmount,
      maxAmount: input.maxAmount,
    });

    // Exclude anomalies if requested
    if (input.excludeAnomalies && filtered.length > 0) {
      const outliers = detectAnomalies(filtered, 2);
      const outlierSet = new Set(outliers);
      filtered = filtered.filter((e) => !outlierSet.has(e));
    }

    // Sort by amount descending
    filtered = filtered.sort((a, b) => b.amount - a.amount);

    // Apply limit
    if (input.limit) {
      filtered = filtered.slice(0, input.limit);
    }

    // Format as markdown table
    if (filtered.length === 0) {
      return `No expenses found matching the criteria.`;
    }

    let table = `Found ${filtered.length} expenses:\n\n`;
    table += '| Date | Vendor | Category | Amount |\n';
    table += '|------|--------|----------|--------|\n';
    for (const e of filtered) {
      const cat = e.category || 'Uncategorized';
      table += `| ${e.date} | ${e.vendor} | ${cat} | $${e.amount.toFixed(2)} |\n`;
    }
    return table;
  }

  if (toolName === 'calculate_statistics') {
    let filtered = applyFilters(expenses, {
      category: input.category,
      startDate: input.startDate,
      endDate: input.endDate,
      minAmount: input.minAmount,
      maxAmount: input.maxAmount,
    });

    // Exclude anomalies if requested
    if (input.excludeAnomalies && filtered.length > 0) {
      const outliers = detectAnomalies(filtered, 2);
      const outlierSet = new Set(outliers);
      filtered = filtered.filter((e) => !outlierSet.has(e));
    }

    // Extract amounts
    const amounts = filtered.map((e) => e.amount);
    let value: number;

    if (amounts.length === 0) {
      value = 0;
    } else {
      const metric = input.metric || 'sum';
      if (metric === 'sum') value = sum(amounts);
      else if (metric === 'mean') value = mean(amounts);
      else if (metric === 'median') value = median(amounts);
      else if (metric === 'min') value = min(amounts);
      else if (metric === 'max') value = max(amounts);
      else value = 0;
    }

    return {
      metric: input.metric || 'sum',
      value: Math.round(value * 100) / 100, // round to 2 decimal places
      count: filtered.length,
      category: input.category || 'all',
      startDate: input.startDate || 'all time',
      endDate: input.endDate || 'all time',
    };
  }

  if (toolName === 'get_spending_by_category') {
    // Filter by date range
    let filtered = expenses;
    if (input.startDate || input.endDate) {
      filtered = filtered.filter((e) =>
        isBetween(e.date, input.startDate, input.endDate)
      );
    }

    // Group by category
    const grouped = groupBy(filtered, (e) => e.category ?? 'uncategorized');

    // Compute metric per group
    const categories: Array<{
      name: string;
      value: number;
      count: number;
    }> = [];

    for (const [categoryName, categoryExpenses] of Object.entries(grouped)) {
      let categoryFiltered = categoryExpenses;

      // Exclude anomalies within this category if requested
      if (input.excludeAnomalies && categoryFiltered.length > 0) {
        const outliers = detectAnomalies(categoryFiltered, 2);
        const outlierSet = new Set(outliers);
        categoryFiltered = categoryFiltered.filter((e) => !outlierSet.has(e));
      }

      // Compute metric
      const amounts = categoryFiltered.map((e) => e.amount);
      let value: number;

      if (amounts.length === 0) {
        value = 0;
      } else {
        const metric = input.metric || 'sum';
        if (metric === 'sum') value = sum(amounts);
        else if (metric === 'mean') value = mean(amounts);
        else if (metric === 'median') value = median(amounts);
        else if (metric === 'count') value = amounts.length;
        else value = 0;
      }

      categories.push({
        name: categoryName,
        value: Math.round(value * 100) / 100,
        count: categoryFiltered.length,
      });
    }

    // Sort by value descending
    categories.sort((a, b) => b.value - a.value);

    // Apply topN
    if (input.topN) {
      categories.splice(input.topN);
    }

    return {
      metric: input.metric || 'sum',
      categories,
      period: {
        startDate: input.startDate || 'all time',
        endDate: input.endDate || 'all time',
      },
    };
  }

  return { error: 'Unknown tool' };
}

export class FinanceAgent {
  private expenses: Expense[];
  private conversationHistory: Array<{
    role: 'user' | 'assistant' | 'tool';
    content: string | Record<string, unknown>;
  }> = [];

  constructor(expenses: Expense[]) {
    this.expenses = expenses;
  }

  async run(query: string): Promise<string> {
    // Add user query to conversation history
    this.conversationHistory.push({
      role: 'user',
      content: query,
    });

    // Build prompt from conversation history
    let fullPrompt = query;
    if (this.conversationHistory.length > 1) {
      // Include previous context
      fullPrompt = this.conversationHistory
        .map((msg) => {
          if (msg.role === 'user') {
            return `User: ${msg.content}`;
          } else if (msg.role === 'assistant') {
            return `Assistant: ${msg.content}`;
          } else if (msg.role === 'tool') {
            return `Tool result: ${JSON.stringify(msg.content)}`;
          }
        })
        .join('\n\n');
    }

    // Agentic loop
    while (true) {
      try {
        const result = await generateText({
          model: google('gemini-2.5-flash'),
          system: SYSTEM_PROMPT,
          prompt: fullPrompt,
          tools: {
            filter_expenses: filterExpensesTool,
            calculate_statistics: calculateStatisticsTool,
            get_spending_by_category: getSpendingByCategoryTool,
          },
        });

        // If the model is done, return the response
        if (result.finishReason === 'stop') {
          this.conversationHistory.push({
            role: 'assistant',
            content: result.text,
          });
          return result.text;
        }

        // If the model made tool calls, execute them
        if (result.finishReason === 'tool-calls') {
          // Execute all tool calls
          const toolResults: Record<string, unknown> = {};
          for (const toolCall of result.toolCalls) {
            const toolResult = executeTool(
              toolCall.toolName,
              toolCall.input as Record<string, unknown>,
              this.expenses
            );
            toolResults[toolCall.toolCallId] = toolResult;
          }

          // Add tool result to history
          this.conversationHistory.push({
            role: 'tool',
            content: toolResults,
          });

          // Update prompt to include tool results and continue the loop
          fullPrompt += '\n\nTool execution results:\n';
          for (const [callId, result] of Object.entries(toolResults)) {
            fullPrompt += `[${callId}]: ${typeof result === 'string' ? result : JSON.stringify(result)}\n`;
          }

          continue;
        }

        // If anything else happened, return an error
        return 'I encountered an issue processing your request. Please try again.';
      } catch (error) {
        console.error('Error in FinanceAgent.run:', error instanceof Error ? error.message : String(error));
        if (error instanceof Error) {
          console.error(error.stack);
        }
        throw error;
      }
    }
  }
}
