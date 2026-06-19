/**
 * Monday.com API 통합
 * Track D: A/B 테스트 할당을 Monday.com 보드에 자동 동기화
 */

import { logger } from '@/lib/logger';

export interface MondayTaskInput {
  week: number;
  counselorId: string;
  counselorName: string;
  abTestGroup: "A" | "B";
  targetCalls: number;
  scriptVersion: string;
}

export interface MondayTaskOutput {
  id: string;
  week: number;
  counselorId: string;
  counselorName: string;
  abTestGroup: "A" | "B";
  mondayTaskId: string;
  createdAt: Date;
}

/**
 * Monday.com GraphQL 클라이언트
 */
export class MondayClient {
  private apiKey: string;
  private boardId: string;
  private readonly ENDPOINT = "https://api.monday.com/v2";

  constructor(apiKey: string, boardId: string) {
    this.apiKey = apiKey;
    this.boardId = boardId;
  }

  /**
   * GraphQL 쿼리 실행
   */
  private async executeQuery<T = any>(query: string, variables?: Record<string, any>): Promise<T> {
    const response = await fetch(this.ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: this.apiKey,
      },
      body: JSON.stringify({
        query,
        variables,
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      throw new Error(`Monday.com API error: ${response.statusText}`);
    }

    const data = await response.json();

    if (data.errors) {
      throw new Error(`GraphQL error: ${JSON.stringify(data.errors)}`);
    }

    return data.data;
  }

  /**
   * A/B 테스트 주간 태스크 생성
   */
  async createWeeklyTask(task: MondayTaskInput): Promise<MondayTaskOutput> {
    const itemName = `[A/B Test - Week ${task.week}] ${task.counselorName}: ${task.abTestGroup}안 목표 ${task.targetCalls}콜`;

    // Column 값들을 JSON으로 인코딩
    const columnValues = JSON.stringify({
      status: task.abTestGroup === "A" ? "A_GROUP" : "B_GROUP",
      week: `Week ${task.week}`,
      script_version: task.scriptVersion,
      target_calls: String(task.targetCalls),
      counselor_id: task.counselorId,
    });

    const mutation = `
      mutation CreateItem($boardId: String!, $itemName: String!, $columnValues: JSON!) {
        create_item(board_id: $boardId, item_name: $itemName, column_values: $columnValues) {
          id
        }
      }
    `;

    const response = await this.executeQuery<{
      create_item: { id: string };
    }>(mutation, {
      boardId: this.boardId,
      itemName,
      columnValues,
    });

    return {
      id: `${task.week}_${task.counselorId}`,
      week: task.week,
      counselorId: task.counselorId,
      counselorName: task.counselorName,
      abTestGroup: task.abTestGroup,
      mondayTaskId: response.create_item.id,
      createdAt: new Date(),
    };
  }

  /**
   * 일괄 생성: 주간 모든 할당 태스크 생성
   */
  async createWeeklyTasks(tasks: MondayTaskInput[]): Promise<MondayTaskOutput[]> {
    const results: MondayTaskOutput[] = [];

    for (const task of tasks) {
      try {
        const result = await this.createWeeklyTask(task);
        results.push(result);
      } catch (error) {
        logger.error(`Failed to create task for ${task.counselorName}:`, { error: error instanceof Error ? error.message : String(error) });
        // 에러가 발생해도 계속 진행 (부분 실패 처리)
      }
    }

    return results;
  }

  /**
   * 태스크 상태 업데이트 (진행 중 / 완료)
   */
  async updateTaskStatus(
    mondayTaskId: string,
    status: "pending" | "in_progress" | "completed"
  ): Promise<void> {
    const statusMap = {
      pending: "Not started",
      in_progress: "In progress",
      completed: "Done",
    };

    const mutation = `
      mutation UpdateItem($boardId: String!, $itemId: String!, $columnId: String!, $value: String!) {
        update_item_column_value(board_id: $boardId, item_id: $itemId, column_id: $columnId, value: $value) {
          id
        }
      }
    `;

    await this.executeQuery(mutation, {
      boardId: this.boardId,
      itemId: mondayTaskId,
      columnId: "status",
      value: statusMap[status],
    });
  }

  /**
   * 주간 태스크 조회
   */
  async getWeeklyTasks(week: number): Promise<any[]> {
    const query = `
      query {
        items_page(board_id: "${this.boardId}", limit: 100) {
          cursor
          items {
            id
            name
            column_values {
              id
              text
            }
          }
        }
      }
    `;

    const response = await this.executeQuery<{
      items_page: {
        items: Array<{
          id: string;
          name: string;
          column_values: Array<{ id: string; text: string }>;
        }>;
      };
    }>(query);

    // Week 필터링
    return response.items_page.items.filter((item) => item.name.includes(`Week ${week}`));
  }
}

/**
 * Factory: Monday.com 클라이언트 생성
 */
export function createMondayClient(apiKey: string, boardId: string): MondayClient {
  if (!apiKey || !boardId) {
    throw new Error("Monday.com API key and board ID are required");
  }

  return new MondayClient(apiKey, boardId);
}

/**
 * 환경 변수에서 Monday.com 클라이언트 생성
 */
export function getMondayClient(): MondayClient {
  const apiKey = process.env.MONDAY_API_KEY;
  const boardId = process.env.MONDAY_AB_TEST_BOARD_ID;

  if (!apiKey) {
    throw new Error("MONDAY_API_KEY environment variable is not set");
  }

  if (!boardId) {
    throw new Error("MONDAY_AB_TEST_BOARD_ID environment variable is not set");
  }

  return createMondayClient(apiKey, boardId);
}

/**
 * Slack 알림 (옵션: Monday.com과 함께 작동)
 */
export async function notifySlackAboutSync(
  week: number,
  tasksCreated: number,
  slackWebhookUrl?: string
): Promise<void> {
  if (!slackWebhookUrl) {
    slackWebhookUrl = process.env.SLACK_WEBHOOK_URL;
  }

  if (!slackWebhookUrl) {
    logger.warn("SLACK_WEBHOOK_URL is not set, skipping Slack notification");
    return;
  }

  const message = {
    text: `✅ Week ${week} A/B Test Assignments Synced to Monday.com`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `✅ *Week ${week} A/B Test Sync Complete*\n\n📊 *Tasks Created*: ${tasksCreated}\n🎯 *Target*: 50 calls per week\n📅 *Period*: Week ${week}/12`,
        },
      },
    ],
  };

  try {
    const response = await fetch(slackWebhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(message),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      logger.error(`Slack notification failed: ${response.statusText}`);
    }
  } catch (error) {
    logger.error("Failed to send Slack notification:", { error: error instanceof Error ? error.message : String(error) });
  }
}
