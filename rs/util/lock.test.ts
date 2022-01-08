import { expect } from "chai";
import { test } from "mocha";
import { resolver } from "./resolver";
import { Lock } from "./lock";
import { sleep } from "./sleep";

test("Lock", async () => {
  type Task = () => Promise<void>;
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

  const [t1, r1] = makeTask("t1");
  const [t2, r2] = makeTask("t2");
  const [t3, r3] = makeTask("t3");

  const loop = new Lock();
  loop.withLock(t1);
  loop.withLock(t2);

  await sleep();
  expect(log).deep.equal(["t1 enter"]);
  r1();
  await sleep();
  expect(log).deep.equal(["t1 enter", "t1 exit", "t2 enter"]);
  r2();
  await sleep();
  expect(log).deep.equal(["t1 enter", "t1 exit", "t2 enter", "t2 exit"]);

  r3();
  loop.withLock(t3);
  await sleep();
  expect(log).deep.equal([
    "t1 enter",
    "t1 exit",
    "t2 enter",
    "t2 exit",
    "t3 enter",
    "t3 exit",
  ]);
});
