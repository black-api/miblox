// HeUi — clock: fixed timestep accumulator with a clamped variable step.

export class Clock {
  /**
   * @param {object} options
   * @param {number} [options.fixedStep] seconds per fixed step (default 1/60)
   * @param {number} [options.maxDelta] clamp for the variable step
   * @param {number} [options.maxSteps] max fixed steps per frame
   */
  constructor({ fixedStep = 1 / 60, maxDelta = 0.25, maxSteps = 5 } = {}) {
    this.fixedStep = fixedStep;
    this.maxDelta = maxDelta;
    this.maxSteps = maxSteps;
    this.accumulator = 0;
    this.elapsed = 0;
    this.frame = 0;
    this.timeScale = 1;
    this.paused = false;
  }

  /**
   * Advances the clock and returns the steps the caller must run.
   * @param {number} deltaSeconds real time since the previous frame
   * @returns {{fixed: number, variable: number, steps: number}}
   */
  advance(deltaSeconds) {
    const delta = Math.min(Math.max(deltaSeconds, 0), this.maxDelta);
    this.frame += 1;
    if (this.paused) return { fixed: 0, variable: 0, steps: 0 };

    const scaled = delta * this.timeScale;
    this.accumulator += scaled;

    let steps = 0;
    while (this.accumulator >= this.fixedStep && steps < this.maxSteps) {
      this.accumulator -= this.fixedStep;
      steps += 1;
    }
    // Drop the backlog instead of spiralling after a long pause.
    if (steps === this.maxSteps) this.accumulator = 0;

    this.elapsed += scaled;
    return { fixed: this.fixedStep, variable: scaled, steps };
  }
}
