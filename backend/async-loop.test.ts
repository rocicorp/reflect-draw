import { expect } from "chai";
import { test } from "mocha";
import { resolver } from "../frontend/resolver";
import { Task, AsyncLoop } from "./async-loop";

test("AsyncLoop", async () => {
  const log: string[] = [];

  function makeTask(name: string) {
    const { promise, resolve } = resolver<void>();
    const task = async () => {
      log.push(`${name} enter`);
      await promise;
      log.push(`${name} exit`);
    };
    return [task, resolve] as [Task, () => void];
  }

  function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  const [t1, r1] = makeTask("t1");
  const [t2, r2] = makeTask("t2");
  const [t3, r3] = makeTask("t3");

  const loop = new AsyncLoop();
  loop.addTask(t1);
  loop.addTask(t2);

  expect(log).deep.equal(["t1 enter"]);
  r1();
  await sleep(0);
  expect(log).deep.equal(["t1 enter", "t1 exit", "t2 enter"]);
  r2();
  await sleep(0);
  expect(log).deep.equal(["t1 enter", "t1 exit", "t2 enter", "t2 exit"]);

  r3();
  loop.addTask(t3);
  await sleep(0);
  expect(log).deep.equal([
    "t1 enter",
    "t1 exit",
    "t2 enter",
    "t2 exit",
    "t3 enter",
    "t3 exit",
  ]);
});
