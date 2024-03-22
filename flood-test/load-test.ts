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
    await browser.visit("https://reflect-draw.vercel.app/d/YYVVf2");
  });

  step("Step 2 move cursor", async (browser) => {
    const rectangles = await browser.findElements(By.css("svg > rect"));
    for (let i = 0; i < 15; i++) {
      for (let rect of shuffleArray(rectangles)) {
        const center = await rect.centerPoint();
        await browser.page.mouse.move(center[0], center[1]);
        
        // Randomize the x and y coordinates within a range
        const randomX = Math.floor(Math.random() * 20) + 800;
        const randomY = Math.floor(Math.random() * 20) + 600;
        await browser.page.mouse.move(randomX, randomY, { steps: 100 } );
      }
    }
  });
};

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]]; 
  }
  return array;
}
