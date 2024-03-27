import { step, TestSettings, Until, By } from "@flood/element";


export default () => {
  step("Test: Login", async (browser) => {
    console.log("LoadPage");
    await browser.visit(
      "https://app.workcanvas.com/d/ATKEZArO6WpLWHKba9Qg8PnPUq1OFvbq"
    );
    
    const inputName = await browser.findElement(
      By.css("input[class^='anonymous-user-login_name']")
    )
    await inputName.type(Math.random().toString(36).substring(7));

    const btnSubmit = await browser.findElement(
      By.css("div[class^='anonymous-user-login_submitButton']")
    )
    await btnSubmit.click();
  });

  step("Test: MouseMove", async (browser) => {
    console.log("MouseMove");
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
