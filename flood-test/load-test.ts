import { step, TestSettings, By, beforeAll, afterAll } from "@flood/element";

export const settings: TestSettings = {
  waitUntil: "visible",
  browser: "chrome",
  viewport: { width: 1920, height: 1080 },
};

export default () => {
  beforeAll(async (browser) => {
    const startDelay = 500 + Math.random() * 500; // Random start delay between 500ms to 1000ms
    await browser.wait(`${startDelay}ms`);
  });

  afterAll(async (browser) => {
    await browser.wait("700ms");
  });

  step("Start", async (browser) => {
    await browser.visit("https://reflect-draw-cesar-load-test.vercel.app/d/QRT19V");
  });

  step("Step 2 move cursor", async (browser) => {
    const rectangles = await browser.findElements(By.css("svg > rect"));
    for (let i = 0; i < 15; i++) {
      for (let rect of rectangles) {
        const center = await rect.centerPoint();
        await browser.page.mouse.move(center[0], center[1]);
        const randomX = Math.floor(Math.random() * 20) + 800;
        const randomY = Math.floor(Math.random() * 20) + 600;
        await browser.page.mouse.move(randomX, randomY, { steps: 100 } );
      }
    }
  });
};

