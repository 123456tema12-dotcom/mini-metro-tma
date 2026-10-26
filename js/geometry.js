/* ==========================================================================
   MINI METRO - Geometry & Transit Track Routing Utilities
   Strict 45°/90° octilinear routing, canonical bidirectional curves,
   parallel track offsets, and river crossing detection for bridges/tunnels.
   ========================================================================== */

export const Geometry = {
  dist(p1, p2) {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    return Math.hypot(dx, dy);
  },

  distSq(p1, p2) {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    return dx * dx + dy * dy;
  },

  closestPointOnSegment(p, a, b) {
    const l2 = this.distSq(a, b);
    if (l2 === 0) return { x: a.x, y: a.y, t: 0 };
    let t = ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    return {
      x: a.x + t * (b.x - a.x),
      y: a.y + t * (b.y - a.y),
      t: t
    };
  },

  distToSegment(p, a, b) {
    const cp = this.closestPointOnSegment(p, a, b);
    return this.dist(p, cp);
  },

  segmentsIntersect(p1, p2, p3, p4) {
    const ccw = (a, b, c) => (c.y - a.y) * (b.x - a.x) > (b.y - a.y) * (c.x - a.x);
    return (
      ccw(p1, p3, p4) !== ccw(p2, p3, p4) &&
      ccw(p1, p2, p3) !== ccw(p1, p2, p4)
    );
  },

  segmentCrossesPolygon(p1, p2, polyPoints) {
    if (!polyPoints || polyPoints.length < 3) return false;
    for (let i = 0; i < polyPoints.length; i++) {
      const a = polyPoints[i];
      const b = polyPoints[(i + 1) % polyPoints.length];
      if (this.segmentsIntersect(p1, p2, a, b)) {
        return true;
      }
    }
    return false;
  },

  getNormal(p1, p2, offsetDistance = 1) {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const len = Math.hypot(dx, dy) || 1;
    return {
      x: (-dy / len) * offsetDistance,
      y: (dx / len) * offsetDistance
    };
  },

  /**
   * Canonical Octilinear Track Routing:
   * GUARANTEES that the track curve between station A and station B is
   * 100% IDENTICAL whether traveling forward (A -> B) or backward (B -> A).
   * This prevents trains from ever flying off the track!
   */
  getCanonicalMetroPath(s1, s2, offset = 0) {
    // Determine canonical station ordering
    let reverse = false;
    let pA = s1;
    let pB = s2;

    if (s1.id > s2.id) {
      pA = s2;
      pB = s1;
      reverse = true;
    }

    const dx = pB.x - pA.x;
    const dy = pB.y - pA.y;
    const ax = Math.abs(dx);
    const ay = Math.abs(dy);

    // Calculate parallel track offset vector
    let nx = 0;
    let ny = 0;
    if (offset !== 0) {
      const len = Math.hypot(dx, dy) || 1;
      nx = (-dy / len) * offset;
      ny = (dx / len) * offset;
    }

    const start = { x: pA.x + nx, y: pA.y + ny };
    const end = { x: pB.x + nx, y: pB.y + ny };

    let points;
    // If straight line or 45-degree diagonal
    if (ax < 3 || ay < 3 || Math.abs(ax - ay) < 3) {
      points = [start, end];
    } else {
      const signX = Math.sign(dx) || 1;
      const signY = Math.sign(dy) || 1;

      let bend;
      if (ax > ay) {
        bend = {
          x: start.x + (ax - ay) * signX,
          y: start.y
        };
      } else {
        bend = {
          x: start.x,
          y: start.y + (ay - ax) * signY
        };
      }
      points = [start, bend, end];
    }

    // If caller asked for path from s1 to s2, and canonical was s2 to s1, reverse points
    if (reverse) {
      points = [...points].reverse();
    }

    return points;
  },

  // Draw smooth rounded path
  drawRoundedPath(ctx, points, cornerRadius = 16) {
    if (!points || points.length < 2) return;
    if (points.length === 2) {
      ctx.moveTo(points[0].x, points[0].y);
      ctx.lineTo(points[1].x, points[1].y);
      return;
    }

    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length - 1; i++) {
      const prev = points[i - 1];
      const cur = points[i];
      const next = points[i + 1];

      const d1 = this.dist(prev, cur);
      const d2 = this.dist(cur, next);
      const r = Math.min(cornerRadius, d1 * 0.45, d2 * 0.45);

      ctx.arcTo(cur.x, cur.y, next.x, next.y, r);
    }
    ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
  },

  /**
   * Traverse a multi-segment path at progress t [0..1]
   */
  pointAlongPath(points, t) {
    if (!points || points.length === 0) return { x: 0, y: 0, angle: 0 };
    if (points.length === 1) return { x: points[0].x, y: points[0].y, angle: 0 };
    if (t <= 0) {
      const a = points[0];
      const b = points[1];
      return { x: a.x, y: a.y, angle: Math.atan2(b.y - a.y, b.x - a.x) };
    }
    if (t >= 1) {
      const a = points[points.length - 2];
      const b = points[points.length - 1];
      return { x: b.x, y: b.y, angle: Math.atan2(b.y - a.y, b.x - a.x) };
    }

    let totalLen = 0;
    const lens = [];
    for (let i = 0; i < points.length - 1; i++) {
      const segLen = this.dist(points[i], points[i + 1]);
      lens.push(segLen);
      totalLen += segLen;
    }

    const targetLen = t * totalLen;
    let accum = 0;
    for (let i = 0; i < lens.length; i++) {
      if (accum + lens[i] >= targetLen || i === lens.length - 1) {
        const segT = lens[i] > 0 ? (targetLen - accum) / lens[i] : 0;
        const p1 = points[i];
        const p2 = points[i + 1];
        return {
          x: p1.x + (p2.x - p1.x) * segT,
          y: p1.y + (p2.y - p1.y) * segT,
          angle: Math.atan2(p2.y - p1.y, p2.x - p1.x)
        };
      }
      accum += lens[i];
    }
    return { x: points[points.length - 1].x, y: points[points.length - 1].y, angle: 0 };
  }
};
