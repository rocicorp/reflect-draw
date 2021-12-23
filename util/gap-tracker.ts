import { TDigest } from "tdigest";

export class GapTracker {
  private _name: string;
  private _summaryFrequencyMs: number;
  private _lastSummaryMs: number | undefined;
  private _last: number | undefined;

  private readonly _digest: any;
  constructor(name: string, summaryFrequencyMs = 1000) {
    this._name = name;
    this._summaryFrequencyMs = summaryFrequencyMs;
    this._digest = new TDigest({ mode: "disc" });
  }

  push(value: number) {
    if (this._last !== undefined) {
      const diff = value - this._last;
      this._digest.push(diff);
    }
    this._last = value;

    const now = performance.now();
    if (this._lastSummaryMs === undefined) {
      this._lastSummaryMs = now;
    } else if (now - this._lastSummaryMs > this._summaryFrequencyMs) {
      console.log(`${this._name} gap summary`, this._digest.summary());
      this._lastSummaryMs = now;
    }
  }
}
