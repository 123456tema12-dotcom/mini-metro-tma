/* ==========================================================================
   MINI METRO - Geometry & Transit Track Routing Utilities
   Strict 45°/90° octilinear routing, rounded corner fillets, parallel track offsets,
   and river crossing detection for bridges and tunnels.
   ========================================================================== */

export const Geometry = {
  // Distance between two 2D points
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

  // Closest point on line segment [a, b] to point p
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

  // Test if two segments [p1, p2] and [p3, p4] intersect
  segmentsIntersect(p1, p2, p3, p4) {
    const ccw = (a, b, c) => (c.y - a.y) * (b.x - a.x) > (b.y - a.y) * (c.x - a.x);
    return (
      ccw(p1, p3, p4) !== ccw(p2, p3, p4) &&
      ccw(p1, p2, p3) !== ccw(p1, p2, p4)
    );
  },

  // Find exact intersection point of two segments, if any
  segmentIntersectionPoint(p1, p2, p3, p4) {
    const d = (p2.x - p1.x) * (p4.y - p3.y) - (p2.y - p1.y) * (p4.x - p3.x);
    if (Math.abs(d) < 0.0001) return null;

    const u = ((p3.x - p1.x) * (p4.y - p3.y) - (p3.y - p1.y) * (p4.x - p3.x)) / d;
    const v = ((p3.x - p1.x) * (p2.y - p1.y) - (p3.y - p1.y) * (p2.x - p1.x)) / d;

    if (u >= 0 && u <= 1 && v >= 0 && v <= 1) {
      return {
        x: p1.x + u * (p2.x - p1.x),
        y: p1.y + u * (p2.y - p1.y),
        u: u
      };
    }
    return null;
  },

  // Check if a line segment crosses any edge of a polygon
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

  // Find all intersection points of a segment with a polygon (e.g. river banks)
  getRiverCrossingIntervals(p1, p2, polyPoints) {
    if (!polyPoints || polyPoints.length < 3) return [];
    const hits = [];
    for (let i = 0; i < polyPoints.length; i++) {
      const a = polyPoints[i];
      const b = polyPoints[(i + 1) % polyPoints.length];
      const hit = this.segmentIntersectionPoint(p1, p2, a, b);
      if (hit) {
        hits.push(hit);
      }
    }
    hits.sort((a, b) => a.u - b.u);
    return hits;
  },

  // Compute perpendicular offset normal vector for a segment [p1, p2]
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
   * Authentic Mini Metro Octilinear Routing (0°, 45°, 90°, 135°...)
   * Lines strictly bend at 45° or 90° with smooth rounded corners.
   */
  generateMetroPath(p1, p2) {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const ax = Math.abs(dx);
    const ay = Math.abs(dy);

    // Direct line if already strictly horizontal, vertical, or 45-degree diagonal
    if (ax < 2 || ay < 2 || Math.abs(ax - ay) < 2) {
      return [p1, p2];
    }

    const signX = Math.sign(dx);
    const signY = Math.sign(dy);

    // Choose whether to bend horizontally first or vertically first
    // In Mini Metro, the longer axis gets the straight run first
    let bend;
    if (ax > ay) {
      bend = {
        x: p1.x + (ax - ay) * signX,
        y: p1.y
      };
    } else {
      bend = {
        x: p1.x,
        y: p1.y + (ay - ax) * signY
      };
    }

    return [p1, bend, p2];
  },

  /**
   * Draw rounded path on Canvas 2D with smooth corner radius (fillet)
   */
  drawRoundedPath(ctx, points, cornerRadius = 14) {
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
   * Evaluate position and tangent angle along a multi-segment path at progress t [0..1]
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

    let targetLen = t * totalLen;
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
