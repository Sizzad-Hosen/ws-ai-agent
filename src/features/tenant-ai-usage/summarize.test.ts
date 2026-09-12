import { describe, expect, it } from "vitest";

import {
  summarizeUsage,
  USAGE_WINDOW_DAYS,
  type UsageLogRow,
} from "./summarize";

const WINDOW_START = new Date("2026-08-01T00:00:00.000Z");

function row(overrides: Partial<UsageLogRow> = {}): UsageLogRow {
  return {
    createdAt: new Date("2026-08-02T10:00:00.000Z"),
    inputTokens: BigInt(100),
    outputTokens: BigInt(50),
    totalTokens: BigInt(150),
    estimatedCost: "0.001250",
    status: "SUCCESS",
    requestType: "chat_reply",
    ...overrides,
  };
}

describe("summarizeUsage", () => {
  it("reports zeroes for an empty window without dividing by zero", () => {
    const summary = summarizeUsage([], WINDOW_START, 3);

    expect(summary.requests).toBe(0);
    expect(summary.errorRatePercent).toBe(0);
    expect(summary.estimatedCost).toBe("0.000000");
    expect(summary.byRequestType).toEqual([]);
    // One bucket per day inclusive of both ends.
    expect(summary.daily).toHaveLength(4);
  });

  it("sums tokens and counts requests", () => {
    const summary = summarizeUsage([row(), row(), row()], WINDOW_START, 3);

    expect(summary.requests).toBe(3);
    expect(summary.inputTokens).toBe(300);
    expect(summary.outputTokens).toBe(150);
    expect(summary.totalTokens).toBe(450);
  });

  it("sums cost exactly, without floating-point drift", () => {
    // 0.000001 added 1,000,000 times is 1.000000. Summed as doubles this
    // lands on 1.0000000000079181, which the sixth decimal place would show.
    // One shared row, repeated. Allocating a million objects would dominate
    // the run time and prove nothing extra.
    const rows: UsageLogRow[] = new Array<UsageLogRow>(1_000_000).fill(
      row({ estimatedCost: "0.000001" }),
    );

    expect(summarizeUsage(rows, WINDOW_START, 1).estimatedCost).toBe(
      "1.000000",
    );
  });

  it("treats a null cost as zero rather than as NaN", () => {
    const summary = summarizeUsage(
      [row({ estimatedCost: null }), row({ estimatedCost: "0.500000" })],
      WINDOW_START,
      3,
    );

    expect(summary.estimatedCost).toBe("0.500000");
  });

  it("counts every non-success status as a failure", () => {
    const summary = summarizeUsage(
      [
        row({ status: "SUCCESS" }),
        row({ status: "ERROR" }),
        row({ status: "THROTTLED" }),
        row({ status: "SUCCESS" }),
      ],
      WINDOW_START,
      3,
    );

    expect(summary.successfulRequests).toBe(2);
    expect(summary.failedRequests).toBe(2);
    expect(summary.errorRatePercent).toBe(50);
  });

  it("rounds the error rate to one decimal place", () => {
    const rows = [
      ...Array.from({ length: 2 }, () => row({ status: "ERROR" })),
      ...Array.from({ length: 1 }, () => row({ status: "SUCCESS" })),
    ];

    // 2/3 = 66.666...%
    expect(summarizeUsage(rows, WINDOW_START, 3).errorRatePercent).toBe(66.7);
  });

  it("keeps a quiet day as a zero bucket instead of closing the gap", () => {
    const summary = summarizeUsage(
      [row({ createdAt: new Date("2026-08-03T09:00:00.000Z") })],
      WINDOW_START,
      3,
    );

    expect(summary.daily.map((point) => point.day)).toEqual([
      "2026-08-01",
      "2026-08-02",
      "2026-08-03",
      "2026-08-04",
    ]);
    expect(summary.daily[1]?.inputTokens).toBe(0);
    expect(summary.daily[2]?.inputTokens).toBe(100);
  });

  it("ignores a row that falls outside the window", () => {
    const summary = summarizeUsage(
      [row({ createdAt: new Date("2026-07-01T09:00:00.000Z") })],
      WINDOW_START,
      3,
    );

    // Still counted in the totals; simply not placed in any daily bucket.
    expect(summary.requests).toBe(1);
    expect(summary.daily.every((point) => point.inputTokens === 0)).toBe(true);
  });

  it("ranks request types by volume and gives each a share", () => {
    const summary = summarizeUsage(
      [
        row({ requestType: "chat_reply" }),
        row({ requestType: "chat_reply" }),
        row({ requestType: "chat_reply" }),
        row({ requestType: "product_search" }),
      ],
      WINDOW_START,
      3,
    );

    expect(summary.byRequestType).toEqual([
      { requestType: "chat_reply", requests: 3, percent: 75 },
      { requestType: "product_search", requests: 1, percent: 25 },
    ]);
  });

  it("defaults to a thirty-day window", () => {
    expect(summarizeUsage([], WINDOW_START).daily).toHaveLength(
      USAGE_WINDOW_DAYS + 1,
    );
  });
});
