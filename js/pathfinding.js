/* ==========================================================================
   MINI METRO - Passenger Routing & Multi-line Network Pathfinding
   BFS shortest path across lines, transfer stations, and shape destinations
   ========================================================================== */

export class Pathfinding {
  /**
   * Build an adjacency map of the current transit network:
   * Station -> array of { neighborStationId, lineId }
   */
  static buildNetworkGraph(lines, stations) {
    const graph = new Map(); // stationId -> array of { toId, lineId }
    stations.forEach(s => graph.set(s.id, []));

    lines.forEach(line => {
      if (!line.stations || line.stations.length < 2) return;
      for (let i = 0; i < line.stations.length - 1; i++) {
        const u = line.stations[i].id;
        const v = line.stations[i + 1].id;
        if (graph.has(u)) graph.get(u).push({ toId: v, lineId: line.id });
        if (graph.has(v)) graph.get(v).push({ toId: u, lineId: line.id });
      }
      // If line is looping
      if (line.isLoop && line.stations.length >= 3) {
        const u = line.stations[line.stations.length - 1].id;
        const v = line.stations[0].id;
        if (graph.has(u)) graph.get(u).push({ toId: v, lineId: line.id });
        if (graph.has(v)) graph.get(v).push({ toId: u, lineId: line.id });
      }
    });

    return graph;
  }

  /**
   * Find shortest path from startStation to ANY station matching targetShape.
   * Returns: { canReach: boolean, firstLineId: string|null, nextTransferStationId: string|null, stopsCount: number }
   */
  static findRouteToShape(startStation, targetShape, lines, stations) {
    if (!startStation || !targetShape) return { canReach: false };

    // Target stations with this shape
    const targetStationIds = new Set(
      stations.filter(s => s.type === targetShape && s.id !== startStation.id).map(s => s.id)
    );
    if (targetStationIds.size === 0) return { canReach: false };

    const graph = this.buildNetworkGraph(lines, stations);

    // BFS queue entries: { stationId, currentLineId, transfersCount, firstLineId, path: [stationIds] }
    const queue = [{
      stationId: startStation.id,
      currentLineId: null,
      transfers: 0,
      firstLineId: null,
      path: [startStation.id]
    }];

    // Visited set: key = `${stationId}_${lineId}`
    const visited = new Set();
    visited.add(`${startStation.id}_null`);

    let bestSolution = null;

    while (queue.length > 0) {
      const cur = queue.shift();

      // Check if reached destination
      if (targetStationIds.has(cur.stationId)) {
        bestSolution = cur;
        break;
      }

      const neighbors = graph.get(cur.stationId) || [];
      for (const edge of neighbors) {
        const isTransfer = cur.currentLineId !== null && cur.currentLineId !== edge.lineId;
        const nextTransfers = cur.transfers + (isTransfer ? 1 : 0);
        // Cap max transfers to 3 for subway sanity
        if (nextTransfers > 3) continue;

        const visitKey = `${edge.toId}_${edge.lineId}`;
        if (!visited.has(visitKey)) {
          visited.add(visitKey);
          queue.push({
            stationId: edge.toId,
            currentLineId: edge.lineId,
            transfers: nextTransfers,
            firstLineId: cur.firstLineId || edge.lineId,
            path: [...cur.path, edge.toId]
          });
        }
      }
    }

    if (!bestSolution) {
      return { canReach: false };
    }

    // Determine the next station where passenger disembarks (either target or transfer point)
    return {
      canReach: true,
      firstLineId: bestSolution.firstLineId,
      fullPath: bestSolution.path,
      targetStationId: bestSolution.stationId,
      transfers: bestSolution.transfers
    };
  }

  /**
   * Determine if a passenger waiting at station should embark onto arriving train.
   */
  static shouldPassengerEmbark(peep, currentStation, trainLine, lines, stations) {
    if (!peep || !currentStation || !trainLine) return false;
    const targetShape = peep.type;

    // Check if trainLine visits a station with this targetShape directly!
    const lineHasTarget = trainLine.stations.some(s => s.type === targetShape);
    if (lineHasTarget) return true;

    // Otherwise, check if this train line leads to a valid transfer station that can reach targetShape
    const route = this.findRouteToShape(currentStation, targetShape, lines, stations);
    if (route.canReach && route.firstLineId === trainLine.id) {
      return true;
    }

    return false;
  }

  /**
   * Determine if a passenger currently on a train should disembark at station.
   */
  static shouldPassengerDisembark(peep, station, trainLine, lines, stations) {
    if (!peep || !station || !trainLine) return false;

    // 1. Reached final destination!
    if (station.type === peep.type) {
      return { disembark: true, isDestination: true };
    }

    // 2. Train line does NOT visit the target shape directly,
    // and this station offers a connection / transfer to a line that can!
    const lineHasTarget = trainLine.stations.some(s => s.type === peep.type);
    if (!lineHasTarget) {
      // Find other lines passing through this station
      const otherLinesAtStation = lines.filter(l => l.id !== trainLine.id && l.stations.some(s => s.id === station.id));
      for (const otherLine of otherLinesAtStation) {
        if (otherLine.stations.some(s => s.type === peep.type)) {
          // Great! Transfer here directly to reach the destination
          return { disembark: true, isDestination: false };
        }
      }
    }

    return { disembark: false, isDestination: false };
  }
}
