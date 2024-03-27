import { step, TestSettings, Until, By } from "@flood/element";


export default () => {
  step("Test: MouseMove", async (browser) => {
    console.log("LoadPage");
    await browser.visit(
      "https://reflect-draw-cesar-load-test.vercel.app/d/QRT19V"
    );
    for (let i = 0; i < 60; i++) {
      const randomX = Math.floor(Math.random() * 1024);
      const randomY = Math.floor(Math.random() * 768);
      await browser.page.mouse.move(randomX, randomY, { steps: 100 });
      
    }
  });
};

export const settings: TestSettings = {
  clearCache: true,
  disableCache: true,
  waitTimeout: 30,
  screenshotOnFailure: true,
  stepDelay: 7.5,
  actionDelay: 7.5,
  browser: "chrome",
  viewport: { width: 1024, height: 768 },
};
