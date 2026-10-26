/* ==========================================================================
   MINI METRO - Touch & Mouse Input Controller
   Mobile & Tablet gestures: pinch-to-zoom, pan, line drawing, middle-link insertion
   ========================================================================== */

import { Geometry } from './geometry.js';

export class InputManager {
  constructor(canvas, engine, renderer, audio, tg) {
    this.canvas = canvas;
    this.engine = engine;
    this.renderer = renderer;
    this.audio = audio;
    this.tg = tg;

    // Interaction modes: 'NONE', 'PAN', 'PINCH', 'DRAW_NEW', 'EXTEND_LINE', 'INSERT_MIDDLE'
    this.mode = 'NONE';

    // Dragging context
    this.activeLine = null;
    this.dragStartStation = null;
    this.targetStation = null;
    this.dragInsertIndex = -1; // for middle line insertion

    // Pan & Pinch state
    this.lastPointers = new Map(); // pointerId -> { x, y }
    this.pinchStartDist = 0;
    this.pinchStartZoom = 1.0;

    this.touchThreshold = 32; // Generous touch hitbox radius for mobile thumbs (pixels)

    this.initEvents();
  }

  initEvents() {
    this.canvas.addEventListener('pointerdown', e => this.handlePointerDown(e), { passive: false });
    this.canvas.addEventListener('pointermove', e => this.handlePointerMove(e), { passive: false });
    this.canvas.addEventListener('pointerup', e => this.handlePointerUp(e), { passive: false });
    this.canvas.addEventListener('pointercancel', e => this.handlePointerUp(e), { passive: false });

    // Desktop mouse wheel zoom
    this.canvas.addEventListener('wheel', e => this.handleWheel(e), { passive: false });
  }

  // Find station under pointer within touch threshold
  findStationNear(worldPos) {
    let closest = null;
    let minDist = this.touchThreshold / this.renderer.zoom;

    for (const st of this.engine.stations) {
      const d = Geometry.dist(worldPos, st);
      if (d < minDist) {
        minDist = d;
        closest = st;
      }
    }
    return closest;
  }

  // Find line terminator near pointer
  findLineTerminatorNear(worldPos) {
    const threshold = this.touchThreshold / this.renderer.zoom;
    for (const line of this.engine.lines) {
      if (line.stations.length < 2 || line.isLoop) continue;
      const first = line.stations[0];
      const last = line.stations[line.stations.length - 1];

      if (Geometry.dist(worldPos, last) < threshold) {
        return { line, station: last, isEnd: true };
      }
      if (Geometry.dist(worldPos, first) < threshold) {
        return { line, station: first, isEnd: false };
      }
    }
    return null;
  }

  // Find line segment near pointer (for middle-link insertion)
  findLineSegmentNear(worldPos) {
    const threshold = 16 / this.renderer.zoom;
    for (const line of this.engine.lines) {
      if (line.stations.length < 2) continue;
      for (let i = 0; i < line.stations.length - 1; i++) {
        const s1 = line.stations[i];
        const s2 = line.stations[i + 1];
        const d = Geometry.distToSegment(worldPos, s1, s2);
        if (d < threshold) {
          return { line, index: i + 1, s1, s2 };
        }
      }
    }
    return null;
  }

  handlePointerDown(e) {
    e.preventDefault();
    this.canvas.setPointerCapture(e.pointerId);
    this.lastPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // Two finger pinch-to-zoom
    if (this.lastPointers.size === 2) {
      this.mode = 'PINCH';
      const pts = Array.from(this.lastPointers.values());
      this.pinchStartDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      this.pinchStartZoom = this.renderer.zoom;
      this.renderer.dragPreview = null;
      return;
    }

    if (this.lastPointers.size > 2) return;

    const worldPos = this.renderer.screenToWorld(e.clientX, e.clientY);

    // 1. Check if clicking on an existing line terminator to extend it
    const terminator = this.findLineTerminatorNear(worldPos);
    if (terminator) {
      this.mode = 'EXTEND_LINE';
      this.activeLine = terminator.line;
      this.dragStartStation = terminator.station;
      this.isExtendingFromEnd = terminator.isEnd;

      this.renderer.dragPreview = {
        line: this.activeLine,
        fromStation: this.dragStartStation,
        currentPos: worldPos,
        targetStation: null
      };
      if (this.tg) this.tg.hapticImpact('light');
      return;
    }

    // 2. Check if touching a station to start a new line or extend
    const station = this.findStationNear(worldPos);
    if (station) {
      // Find an unused line with 0 stations
      const freeLine = this.engine.lines.find(l => l.stations.length === 0);
      if (freeLine) {
        this.mode = 'DRAW_NEW';
        this.activeLine = freeLine;
        this.dragStartStation = station;
        this.renderer.dragPreview = {
          line: this.activeLine,
          fromStation: this.dragStartStation,
          currentPos: worldPos,
          targetStation: null
        };
        if (this.tg) this.tg.hapticImpact('light');
        return;
      }
    }

    // 3. Check if touching a line segment to insert a middle station
    const segment = this.findLineSegmentNear(worldPos);
    if (segment) {
      this.mode = 'INSERT_MIDDLE';
      this.activeLine = segment.line;
      this.dragInsertIndex = segment.index;
      this.dragStartStation = segment.s1;
      this.renderer.dragPreview = {
        line: this.activeLine,
        fromStation: segment.s1,
        currentPos: worldPos,
        targetStation: null
      };
      if (this.tg) this.tg.hapticImpact('light');
      return;
    }

    // 4. Otherwise, empty space -> Pan camera
    this.mode = 'PAN';
  }

  handlePointerMove(e) {
    e.preventDefault();
    if (!this.lastPointers.has(e.pointerId)) return;

    const prevPos = this.lastPointers.get(e.pointerId);
    const curPos = { x: e.clientX, y: e.clientY };
    this.lastPointers.set(e.pointerId, curPos);

    // Two finger pinch zoom
    if (this.mode === 'PINCH' && this.lastPointers.size === 2) {
      const pts = Array.from(this.lastPointers.values());
      const curDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      if (this.pinchStartDist > 0) {
        const factor = curDist / this.pinchStartDist;
        this.renderer.zoom = Math.max(0.4, Math.min(2.5, this.pinchStartZoom * factor));
      }
      return;
    }

    // Pan camera
    if (this.mode === 'PAN') {
      const dx = (curPos.x - prevPos.x) / this.renderer.zoom;
      const dy = (curPos.y - prevPos.y) / this.renderer.zoom;
      this.renderer.camX -= dx;
      this.renderer.camY -= dy;
      return;
    }

    // Line drawing / extending / inserting
    if (['DRAW_NEW', 'EXTEND_LINE', 'INSERT_MIDDLE'].includes(this.mode)) {
      const worldPos = this.renderer.screenToWorld(e.clientX, e.clientY);
      const nearbyStation = this.findStationNear(worldPos);

      // Check if nearby station is valid target
      let validTarget = null;
      if (nearbyStation && nearbyStation.id !== this.dragStartStation.id) {
        // Line can connect if:
        // - it's not already the immediate neighbor
        // - or it's closing a loop
        validTarget = nearbyStation;
      }

      this.targetStation = validTarget;

      if (this.renderer.dragPreview) {
        this.renderer.dragPreview.currentPos = worldPos;
        this.renderer.dragPreview.targetStation = validTarget;
      }

      // Haptic tick when snapping onto a station
      if (validTarget && validTarget !== this.lastSnappedStation) {
        this.lastSnappedStation = validTarget;
        if (this.tg) this.tg.hapticSelection();
      } else if (!validTarget) {
        this.lastSnappedStation = null;
      }
    }
  }

  handlePointerUp(e) {
    e.preventDefault();
    try {
      this.canvas.releasePointerCapture(e.pointerId);
    } catch (_) {}
    this.lastPointers.delete(e.pointerId);

    if (this.lastPointers.size === 0) {
      this.finishInteraction();
      this.mode = 'NONE';
    } else if (this.lastPointers.size === 1) {
      this.mode = 'PAN';
    }
  }

  finishInteraction() {
    this.renderer.dragPreview = null;

    if (this.targetStation && this.activeLine && this.dragStartStation) {
      const line = this.activeLine;
      const target = this.targetStation;

      // Check bridge constraint
      const crossingRequiresBridge = this.engine.doesSegmentCrossRiver(this.dragStartStation, target);
      if (crossingRequiresBridge && this.engine.getAvailableBridges() <= 0) {
        if (this.tg) this.tg.hapticNotification('error');
        this.cleanupDrag();
        return;
      }

      if (this.mode === 'DRAW_NEW') {
        // Start new line with [startStation, targetStation]
        line.stations = [this.dragStartStation, target];
        if (this.audio) this.audio.playLineConnect();
        if (this.tg) this.tg.hapticNotification('success');
      } else if (this.mode === 'EXTEND_LINE') {
        // Check for loop creation
        if (line.stations.length >= 2 && target.id === line.stations[0].id && this.isExtendingFromEnd) {
          line.isLoop = true;
          if (this.audio) this.audio.playLineConnect();
          if (this.tg) this.tg.hapticNotification('success');
        } else {
          // Extend to target station
          if (this.isExtendingFromEnd) {
            line.stations.push(target);
          } else {
            line.stations.unshift(target);
          }
          if (this.audio) this.audio.playLineConnect();
          if (this.tg) this.tg.hapticNotification('success');
        }
      } else if (this.mode === 'INSERT_MIDDLE') {
        // Insert station at index
        if (!line.stations.some(s => s.id === target.id)) {
          line.stations.splice(this.dragInsertIndex, 0, target);
          if (this.audio) this.audio.playLineConnect();
          if (this.tg) this.tg.hapticNotification('success');
        }
      }
    }

    this.cleanupDrag();
  }

  cleanupDrag() {
    this.activeLine = null;
    this.dragStartStation = null;
    this.targetStation = null;
    this.dragInsertIndex = -1;
    this.renderer.dragPreview = null;
  }

  handleWheel(e) {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    this.renderer.zoom = Math.max(0.4, Math.min(2.5, this.renderer.zoom * zoomFactor));
  }
}
