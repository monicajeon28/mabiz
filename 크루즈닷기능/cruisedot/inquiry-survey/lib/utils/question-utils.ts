import type { ChatBotQuestion } from '@prisma/client';

type FlowQuestionRef = Pick<ChatBotQuestion, 'id' | 'order'>;

const toNumeric = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value.trim());
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }

  return null;
};

const createResolver = (flowQuestions: FlowQuestionRef[]) => {
  const idSet = new Set<number>();
  const orderToId = new Map<number, number>();

  flowQuestions.forEach((question) => {
    idSet.add(question.id);
    if (typeof question.order === 'number' && Number.isFinite(question.order)) {
      orderToId.set(question.order, question.id);
    }
  });

  const resolve = (raw: unknown): number | null => {
    const numeric = toNumeric(raw);
    if (numeric === null) {
      return null;
    }

    if (idSet.has(numeric)) {
      return numeric;
    }

    const orderMatch = orderToId.get(numeric);
    if (orderMatch !== undefined) {
      return orderMatch;
    }

    return numeric;
  };

  return resolve;
};

/**
 * Normalizes navigation-related fields (nextQuestionIdA/B/Ids).
 * Handles legacy data where these fields stored question order instead of ID.
 */
export const normalizeQuestionNavigation = <
  T extends Pick<ChatBotQuestion, 'nextQuestionIdA' | 'nextQuestionIdB' | 'nextQuestionIds'>
>(
  question: T,
  flowQuestions: FlowQuestionRef[],
): Omit<T, 'nextQuestionIds'> & {
  nextQuestionIds: Array<number | null> | null;
  nextQuestionIdA: number | null;
  nextQuestionIdB: number | null;
} => {
  const resolve = createResolver(flowQuestions);

  const resolvedA = resolve(question.nextQuestionIdA);
  const resolvedB = resolve(question.nextQuestionIdB);

  let rawNextIds: unknown = question.nextQuestionIds;
  if (typeof rawNextIds === 'string') {
    try {
      rawNextIds = JSON.parse(rawNextIds);
    } catch {
      rawNextIds = [];
    }
  }

  const nextIdsSource = Array.isArray(rawNextIds) ? rawNextIds : [];
  const resolvedNextIds = nextIdsSource.map((value) => resolve(value));

  return {
    ...question,
    nextQuestionIdA: resolvedA,
    nextQuestionIdB: resolvedB,
    nextQuestionIds: nextIdsSource.length > 0 ? resolvedNextIds : null,
  };
};












