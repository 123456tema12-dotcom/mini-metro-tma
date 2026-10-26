/* ==========================================================================
   MINI METRO - Touch & Mouse Input Controller
   Mobile & Tablet gestures:
   - Draw new lines by dragging from station
   - Extend lines from terminators
   - Retract lines by dragging backwards over previous station
   - Close loops by dragging terminator back to start station
   - Insert intermediate stations by dragging middle-line kinks
   - Pinch-to-zoom & smooth pan
   - Telegram swipe-down-to-close prevention
   ========================================================================== */

import { Geometry } from './geometry.js';

export class InputManager {
  constructor(canvas, engine, renderer, audio, tg) {
    this.canvas = canvas;
    this.engine = engine;
    this.renderer = renderer;
    this.audio = audio;
    this.tg = tg;

    // Modes: 'NONE', 'PAN', 'PINCH', 'DRAW_NEW', 'EXTEND_LINE', 'INSERT_MIDDLE'
    this.mode = 'NONE';

    // Drag context
    this.activeLine = null;
    this.dragStartStation = null;
    this.targetStation = null;
    this.isExtendingFromEnd = true;
    this.dragInsertIndex = -1;
    this.segmentS1 = null;
    this.segmentS2 = null;

    // Pan & Pinch pointers
    this.lastPointers = new Map();
    this.pinchStartDist = 0;
    this.pinchStartZoom = 1.0;

    this.touchThreshold = 34; // Generous touch hitbox radius for mobile thumbs (pixels)
    this.lastSnappedStation = null;

    this.initEvents();
  }

  initEvents() {
    this.canvas.addEventListener('pointerdown', e => this.handlePointerDown(e), { passive: false });
    this.canvas.addEventListener('pointermove', e => this.handlePointerMove(e), { passive: false });
    this.canvas.addEventListener('pointerup', e => this.handlePointerUp(e), { passive: false });
    this.canvas.addEventListener('pointercancel', e => this.handlePointerUp(e), { passive: false });
    this.canvas.addEventListener('wheel', e => this.handleWheel(e), { passive: false });

    // Prevent Telegram / iOS swipe-down-to-close & pull-to-refresh on canvas
    document.addEventListener('touchmove', (e) => {
      if (e.target.closest('.modal-scroll-content, .city-select-grid')) {
        return; // Allow scrolling inside modals
      }
      e.preventDefault();
    }, { passive: false });

    document.addEventListener('gesturestart', (e) => e.preventDefault());
    document.addEventListener('gesturechange', (e) => e.preventDefault());
    document.addEventListener('gestureend', (e) => e.preventDefault());
  }

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

  findLineSegmentNear(worldPos) {
    const threshold = 18 / this.renderer.zoom;
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
      if (line.isLoop && line.stations.length >= 3) {
        const s1 = line.stations[line.stations.length - 1];
        const s2 = line.stations[0];
        const d = Geometry.distToSegment(worldPos, s1, s2);
        if (d < threshold) {
          return { line, index: line.stations.length, s1, s2 };
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

    // 1. Check if clicking on line terminator handle (Extend or Retract)
    const terminator = this.findLineTerminatorNear(worldPos);
    if (terminator) {
      this.mode = 'EXTEND_LINE';
      this.activeLine = terminator.line;
      this.dragStartStation = terminator.station;
      this.isExtendingFromEnd = terminator.isEnd;

      this.renderer.dragPreview = {
        mode: 'EXTEND',
        line: this.activeLine,
        fromStation: this.dragStartStation,
        currentPos: worldPos,
        targetStation: null
      };
      if (this.tg) this.tg.hapticImpact('light');
      return;
    }

    // 2. Check if touching a station to start new line
    const station = this.findStationNear(worldPos);
    if (station) {
      const freeLine = this.engine.lines.find(l => l.stations.length === 0);
      if (freeLine) {
        this.mode = 'DRAW_NEW';
        this.activeLine = freeLine;
        this.dragStartStation = station;
        this.renderer.dragPreview = {
          mode: 'NEW',
          line: this.activeLine,
          fromStation: this.dragStartStation,
          currentPos: worldPos,
          targetStation: null
        };
        if (this.tg) this.tg.hapticImpact('light');
        return;
      }
    }

    // 3. Check if touching a line segment to insert intermediate station (kink drag)
    const segment = this.findLineSegmentNear(worldPos);
    if (segment) {
      this.mode = 'INSERT_MIDDLE';
      this.activeLine = segment.line;
      this.dragInsertIndex = segment.index;
      this.dragStartStation = segment.s1;
      this.segmentS1 = segment.s1;
      this.segmentS2 = segment.s2;

      this.renderer.dragPreview = {
        mode: 'INSERT_MIDDLE',
        line: this.activeLine,
        segmentS1: segment.s1,
        segmentS2: segment.s2,
        currentPos: worldPos,
        targetStation: null
      };
      if (this.tg) this.tg.hapticImpact('light');
      return;
    }

    // 4. Otherwise, pan camera
    this.mode = 'PAN';
  }

  handlePointerMove(e) {
    e.preventDefault();
    if (!this.lastPointers.has(e.pointerId)) return;

    const prevPos = this.lastPointers.get(e.pointerId);
    const curPos = { x: e.clientX, y: e.clientY };
    this.lastPointers.set(e.pointerId, curPos);

    if (this.mode === 'PINCH' && this.lastPointers.size === 2) {
      const pts = Array.from(this.lastPointers.values());
      const curDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      if (this.pinchStartDist > 0) {
        const factor = curDist / this.pinchStartDist;
        const newZoom = Math.max(0.4, Math.min(2.5, this.pinchStartZoom * factor));
        this.renderer.zoom = newZoom;
        this.renderer.targetZoom = newZoom;
      }
      return;
    }

    if (this.mode === 'PAN') {
      const dx = (curPos.x - prevPos.x) / this.renderer.zoom;
      const dy = (curPos.y - prevPos.y) / this.renderer.zoom;
      this.renderer.camX -= dx;
      this.renderer.camY -= dy;
      this.renderer.targetCamX = this.renderer.camX;
      this.renderer.targetCamY = this.renderer.camY;
      return;
    }

    if (['DRAW_NEW', 'EXTEND_LINE', 'INSERT_MIDDLE'].includes(this.mode)) {
      const worldPos = this.renderer.screenToWorld(e.clientX, e.clientY);
      const nearbyStation = this.findStationNear(worldPos);

      let validTarget = null;
      if (nearbyStation) {
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

    if (this.targetStation && this.activeLine) {
      const line = this.activeLine;
      const target = this.targetStation;

      // 1. Draw new line
      if (this.mode === 'DRAW_NEW' && this.dragStartStation && target.id !== this.dragStartStation.id) {
        const crossing = this.engine.doesSegmentCrossRiver(this.dragStartStation, target);
        if (crossing && this.engine.getAvailableBridges() <= 0) {
          if (this.tg) this.tg.hapticNotification('error');
          this.cleanup();
          return;
        }

        line.stations = [this.dragStartStation, target];
        if (this.audio) this.audio.playLineConnect();
        if (this.tg) this.tg.hapticNotification('success');
      }

      // 2. Extend line or Retract line
      else if (this.mode === 'EXTEND_LINE') {
        const numSt = line.stations.length;

        // Retract: dragged backwards onto previous station!
        if (this.isExtendingFromEnd && numSt >= 2 && target.id === line.stations[numSt - 2].id) {
          line.stations.pop();
          line.isLoop = false;
          if (this.audio) this.audio.playLineConnect();
          if (this.tg) this.tg.hapticNotification('warning');
        } else if (!this.isExtendingFromEnd && numSt >= 2 && target.id === line.stations[1].id) {
          line.stations.shift();
          line.isLoop = false;
          if (this.audio) this.audio.playLineConnect();
          if (this.tg) this.tg.hapticNotification('warning');
        }
        // Closing loop: connected end to start station!
        else if (numSt >= 3 && this.isExtendingFromEnd && target.id === line.stations[0].id) {
          const crossing = this.engine.doesSegmentCrossRiver(line.stations[numSt - 1], target);
          if (crossing && this.engine.getAvailableBridges() <= 0) {
            if (this.tg) this.tg.hapticNotification('error');
            this.cleanup();
            return;
          }
          line.isLoop = true;
          if (this.audio) this.audio.playLineConnect();
          if (this.tg) this.tg.hapticNotification('success');
        }
        // Extend to target station
        else if (target.id !== this.dragStartStation.id && !line.isLoop) {
          const crossing = this.engine.doesSegmentCrossRiver(this.dragStartStation, target);
          if (crossing && this.engine.getAvailableBridges() <= 0) {
            if (this.tg) this.tg.hapticNotification('error');
            this.cleanup();
            return;
          }

          if (this.isExtendingFromEnd) {
            line.stations.push(target);
          } else {
            line.stations.unshift(target);
          }
          if (this.audio) this.audio.playLineConnect();
          if (this.tg) this.tg.hapticNotification('success');
        }
      }

      // 3. Insert intermediate station (kink drag)
      else if (this.mode === 'INSERT_MIDDLE' && this.segmentS1 && this.segmentS2) {
        if (!line.stations.some(s => s.id === target.id)) {
          line.stations.splice(this.dragInsertIndex, 0, target);
          if (this.audio) this.audio.playLineConnect();
          if (this.tg) this.tg.hapticNotification('success');
        }
      }
    }

    this.cleanup();
  }

  cleanup() {
    this.activeLine = null;
    this.dragStartStation = null;
    this.targetStation = null;
    this.segmentS1 = null;
    this.segmentS2 = null;
    this.dragInsertIndex = -1;
    this.renderer.dragPreview = null;
  }

  handleWheel(e) {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.12 : 0.88;
    const newZoom = Math.max(0.4, Math.min(2.5, this.renderer.zoom * zoomFactor));
    this.renderer.zoom = newZoom;
    this.renderer.targetZoom = newZoom;
  }
}
