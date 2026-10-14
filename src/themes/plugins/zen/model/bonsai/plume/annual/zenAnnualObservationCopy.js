const copyRows = rows => rows.map(row => ({ ...row }));

// Only the two annual producers call this, after building the complete seasonal
// observation. Their fresh plain rows hold scalar data and the independent dense
// arrays copied below; organ relationships use string IDs. If a producer adds a
// mutable field or shared object, update this owner and its graph contract together.
export function copyZenCherryAnnualObservation(observation) {
  return {
    ...observation,
    nodes: observation.nodes.map(node => ({ ...node, p: node.p.slice() })),
    segments: copyRows(observation.segments),
    axes: observation.axes.map(axis => ({ ...axis,
      direction: axis.direction.slice(), unitIds: axis.unitIds.slice() })),
    annualUnits: observation.annualUnits.map(annualUnit => ({ ...annualUnit,
      nodeIds: annualUnit.nodeIds.slice() })),
    buds: observation.buds.map(bud => ({ ...bud,
      tangent: bud.tangent.slice(), decisionCycles: bud.decisionCycles.slice() })),
    flowers: observation.flowers.map(flower => ({ ...flower, position: flower.position.slice() })),
    events: copyRows(observation.events),
    ledger: { ...observation.ledger,
      transactions: copyRows(observation.ledger.transactions),
      deferredBudIds: observation.ledger.deferredBudIds.slice() },
    metrics: { ...observation.metrics },
  };
}
