import assert from "node:assert/strict";
import { orderSignals } from "./route-queue.mjs";

const cases = [
  [],
  [3],
  [9, 1, 4, 1, 7],
  [5, 5, 5, 5],
  Array.from({ length: 128 }, (_, index) => ((index * 73) ^ (index >>> 2)) % 41)
];
for (const values of cases) {
  const expected = values.map((cost, index) => ({ cost, index })).sort((left, right) => left.cost - right.cost || left.index - right.index).map((item) => item.index);
  assert.deepEqual(orderSignals(values).order, expected);
}
console.log("route queue tests passed");
