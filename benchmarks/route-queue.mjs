export function orderSignals(signals) {
  const pending = signals.map((cost, index) => ({ cost, index }));
  const order = [];
  let operations = 0;
  while (pending.length) {
    let minimum = 0;
    for (let index = 1; index < pending.length; index += 1) {
      operations += 1;
      if (pending[index].cost < pending[minimum].cost || (pending[index].cost === pending[minimum].cost && pending[index].index < pending[minimum].index)) minimum = index;
    }
    order.push(pending.splice(minimum, 1)[0].index);
  }
  return { order, operations };
}
