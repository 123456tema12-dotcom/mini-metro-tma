/* ==========================================================================
   MINI METRO - High-DPI Canvas 2D Rendering Engine
   Authentic Harry Beck / Vignelli subway map style:
   - 100% synchronized train and track paths (no flying off tracks!)
   - Octilinear 45°/90° curves with corner fillets
   - Parallel multi-line track corridors
   - Dashed tunnels & bridges across rivers
   - Crisp geometric station glyphs & queues
   - Passenger icons inside trains
   - Clockwise overcrowding countdown gauge
   - Floating "+1" score animations & tutorial hints
   ========================================================================== */

import { Geometry } from './geometry.js';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });

    // Camera
    this.camX = 0;
    this.camY = 0;
    this.zoom = 1.0;
    this.targetCamX = 0;
    this.targetCamY = 0;
    this.targetZoom = 1.0;
    this.dpr = window.devicePixelRatio || 1;

    // Theme state
    this.isNightMode = false;

    // Drag preview state
    this.dragPreview = null;

    // Floating score popups: array of { x, y, text, alpha, vy }
    this.scorePopups = [];

    this.resize();
  }

  resize() {
    const width = this.canvas.parentElement.clientWidth;
    const height = this.canvas.parentElement.clientHeight;
    this.dpr = window.devicePixelRatio || 1;

    this.canvas.width = Math.round(width * this.dpr);
    this.canvas.height = Math.round(height * this.dpr);
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
  }

  screenToWorld(sx, sy) {
    const cx = this.canvas.width / (2 * this.dpr);
    const cy = this.canvas.height / (2 * this.dpr);
    return {
      x: (sx - cx) / this.zoom + this.camX,
      y: (sy - cy) / this.zoom + this.camY
    };
  }

  worldToScreen(wx, wy) {
    const cx = this.canvas.width / (2 * this.dpr);
    const cy = this.canvas.height / (2 * this.dpr);
    return {
      x: (wx - this.camX) * this.zoom + cx,
      y: (wy - this.camY) * this.zoom + cy
    };
  }

  updateCamera(dt) {
    const lerpSpeed = Math.min(1.0, dt * 6.0);
    this.camX += (this.targetCamX - this.camX) * lerpSpeed;
    this.camY += (this.targetCamY - this.camY) * lerpSpeed;
    this.zoom += (this.targetZoom - this.zoom) * lerpSpeed;
  }

  focusOnStation(station, zoom = 1.5) {
    if (!station) return;
    this.targetCamX = station.x;
    this.targetCamY = station.y;
    this.targetZoom = zoom;
  }

  addScorePopup(x, y, text = '+1') {
    this.scorePopups.push({
      x,
      y: y - 10,
      text,
      alpha: 1.0,
      vy: -22
    });
  }

  updatePopups(dt) {
    for (let i = this.scorePopups.length - 1; i >= 0; i--) {
      const p = this.scorePopups[i];
      p.y += p.vy * dt;
      p.alpha -= dt * 1.2;
      if (p.alpha <= 0) {
        this.scorePopups.splice(i, 1);
      }
    }
  }

  // Calculate parallel track offset for any link between s1 and s2
  getLinkOffset(s1, s2, line, allLines) {
    const key = [s1.id, s2.id].sort().join('--');
    const sharingLines = [];

    allLines.forEach(l => {
      if (l.stations.length < 2) return;
      for (let i = 0; i < l.stations.length - 1; i++) {
        const k = [l.stations[i].id, l.stations[i + 1].id].sort().join('--');
        if (k === key && !sharingLines.some(item => item.id === l.id)) {
          sharingLines.push(l);
        }
      }
      if (l.isLoop && l.stations.length >= 3) {
        const k = [l.stations[l.stations.length - 1].id, l.stations[0].id].sort().join('--');
        if (k === key && !sharingLines.some(item => item.id === l.id)) {
          sharingLines.push(l);
        }
      }
    });

    const total = sharingLines.length;
    if (total <= 1) return 0;

    const idx = sharingLines.findIndex(l => l.id === line.id);
    if (idx === -1) return 0;

    const spacing = 9.0;
    return (idx - (total - 1) / 2) * spacing;
  }

  // Draw Water Bodies / Rivers
  drawRivers(rivers, theme) {
    if (!rivers) return;
    const ctx = this.ctx;
    const waterColor = this.isNightMode ? theme.waterNight : theme.waterDay;
    const outlineColor = this.isNightMode ? theme.waterOutlineNight : theme.waterOutlineDay;

    rivers.forEach(poly => {
      if (poly.length < 3) return;
      ctx.beginPath();
      ctx.moveTo(poly[0].x, poly[0].y);
      for (let i = 1; i < poly.length; i++) {
        ctx.lineTo(poly[i].x, poly[i].y);
      }
      ctx.closePath();

      ctx.fillStyle = waterColor;
      ctx.fill();

      if (outlineColor) {
        ctx.strokeStyle = outlineColor;
        ctx.lineWidth = 3.5 / this.zoom;
        ctx.stroke();
      }
    });
  }

  // Draw Metro Lines with exact canonical paths
  drawLines(lines, level) {
    const ctx = this.ctx;
    const rivers = level.rivers || [];
    const crossingStyle = level.crossingStyle || 'bridge';

    lines.forEach(line => {
      if (line.stations.length < 2) return;

      const drawSegment = (s1, s2) => {
        const offset = this.getLinkOffset(s1, s2, line, lines);
        // Canonical octilinear path
        const pathPoints = Geometry.getCanonicalMetroPath(s1, s2, offset);

        // Test river crossing
        let crossesRiver = false;
        for (const river of rivers) {
          if (Geometry.segmentCrossesPolygon(s1, s2, river)) {
            crossesRiver = true;
            break;
          }
        }

        ctx.strokeStyle = line.color;
        ctx.lineWidth = 7.0;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        if (crossesRiver) {
          if (crossingStyle === 'tunnel') {
            // Tunnel: dashed line
            ctx.setLineDash([7, 5]);
            ctx.beginPath();
            Geometry.drawRoundedPath(ctx, pathPoints, 16);
            ctx.stroke();
            ctx.setLineDash([]);
          } else {
            // Bridge: casing + track
            ctx.save();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 11.0;
            ctx.beginPath();
            Geometry.drawRoundedPath(ctx, pathPoints, 16);
            ctx.stroke();

            ctx.strokeStyle = line.color;
            ctx.lineWidth = 7.0;
            ctx.beginPath();
            Geometry.drawRoundedPath(ctx, pathPoints, 16);
            ctx.stroke();
            ctx.restore();
          }
        } else {
          ctx.beginPath();
          Geometry.drawRoundedPath(ctx, pathPoints, 16);
          ctx.stroke();
        }
      };

      for (let i = 0; i < line.stations.length - 1; i++) {
        drawSegment(line.stations[i], line.stations[i + 1]);
      }
      if (line.isLoop && line.stations.length >= 3) {
        drawSegment(line.stations[line.stations.length - 1], line.stations[0]);
      }
    });

    // Draw Line Terminators (end circle grab handles)
    lines.forEach(line => {
      if (line.stations.length < 2 || line.isLoop) return;
      const ends = [line.stations[0], line.stations[line.stations.length - 1]];

      ends.forEach(st => {
        ctx.beginPath();
        ctx.arc(st.x, st.y, 9.0, 0, Math.PI * 2);
        ctx.fillStyle = line.color;
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.5;
        ctx.stroke();
      });
    });
  }

  // Draw Active Drag Preview
  drawDragPreview() {
    if (!this.dragPreview) return;
    const { mode, line, fromStation, currentPos, targetStation, segmentS1, segmentS2 } = this.dragPreview;
    const ctx = this.ctx;
    const lineColor = line ? line.color : '#3b82f6';

    ctx.save();
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 6.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.setLineDash([8, 6]);

    if (mode === 'INSERT_MIDDLE' && segmentS1 && segmentS2) {
      const endPoint = targetStation ? targetStation : currentPos;
      const path1 = Geometry.getCanonicalMetroPath(segmentS1, endPoint);
      const path2 = Geometry.getCanonicalMetroPath(endPoint, segmentS2);

      ctx.beginPath();
      Geometry.drawRoundedPath(ctx, path1, 16);
      Geometry.drawRoundedPath(ctx, path2, 16);
      ctx.stroke();

      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(endPoint.x, endPoint.y, 10, 0, Math.PI * 2);
      ctx.fillStyle = lineColor;
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5;
      ctx.stroke();
    } else {
      const endPoint = targetStation ? targetStation : currentPos;
      const path = Geometry.getCanonicalMetroPath(fromStation, endPoint);

      ctx.beginPath();
      Geometry.drawRoundedPath(ctx, path, 16);
      ctx.stroke();

      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(endPoint.x, endPoint.y, 10, 0, Math.PI * 2);
      ctx.fillStyle = lineColor;
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }

    ctx.restore();
  }

  // Draw Trains: GUARANTEED to follow the EXACT same path as drawLines!
  drawTrains(lines) {
    const ctx = this.ctx;

    lines.forEach(line => {
      if (line.stations.length < 2) return;

      line.trains.forEach(train => {
        const s1 = line.stations[train.currentStationIndex];
        const s2 = line.stations[train.nextStationIndex];
        if (!s1 || !s2) return;

        // Use the EXACT SAME canonical path and offset as drawLines!
        const offset = this.getLinkOffset(s1, s2, line, lines);
        const pathPoints = Geometry.getCanonicalMetroPath(s1, s2, offset);
        const trainPos = Geometry.pointAlongPath(pathPoints, train.progress);

        ctx.save();
        ctx.translate(trainPos.x, trainPos.y);
        ctx.rotate(trainPos.angle);

        const trainLen = 26;
        const trainWidth = 13;

        // Locomotive Body
        ctx.fillStyle = line.color;
        ctx.beginPath();
        ctx.roundRect(-trainLen / 2, -trainWidth / 2, trainLen, trainWidth, 4);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.8;
        ctx.stroke();

        // Front Directional Notch
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.roundRect(trainLen / 2 - 4.5, -trainWidth / 3.5, 3.5, (trainWidth * 2) / 3.5, 1.5);
        ctx.fill();

        // Passenger shape glyphs inside the locomotive
        if (train.peeps.length > 0) {
          const maxGlyphs = Math.min(train.peeps.length, 6);
          const startX = -trainLen / 2 + 5;
          const spacing = 15 / Math.max(1, maxGlyphs - 1 || 1);

          for (let p = 0; p < maxGlyphs; p++) {
            const peep = train.peeps[p];
            const px = maxGlyphs === 1 ? 0 : startX + p * spacing;
            ctx.fillStyle = '#ffffff';
            this.drawShapeGlyph(ctx, px, 0, peep.type, 2.8, true);
          }
        }

        // Draw Attached Carriage if train has carriage (+6 capacity)
        if (train.carriages > 0) {
          const carLen = 22;
          const carOffset = -trainLen / 2 - carLen / 2 - 4;

          // Coupler
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2.0;
          ctx.beginPath();
          ctx.moveTo(-trainLen / 2, 0);
          ctx.lineTo(-trainLen / 2 - 4, 0);
          ctx.stroke();

          // Carriage Body
          ctx.fillStyle = line.color;
          ctx.beginPath();
          ctx.roundRect(carOffset - carLen / 2, -trainWidth / 2, carLen, trainWidth, 3.5);
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.8;
          ctx.stroke();

          // Carriage passengers
          const carriagePeeps = train.peeps.slice(6);
          if (carriagePeeps.length > 0) {
            const count = Math.min(carriagePeeps.length, 6);
            for (let c = 0; c < count; c++) {
              const peep = carriagePeeps[c];
              const cx = carOffset - carLen / 2 + 4 + c * 3;
              ctx.fillStyle = '#ffffff';
              this.drawShapeGlyph(ctx, cx, 0, peep.type, 2.5, true);
            }
          }
        }

        ctx.restore();
      });
    });
  }

  // Draw Stations, shapes, overcrowding gauge, and passenger queues
  drawStations(stations, theme) {
    const ctx = this.ctx;
    const strokeColor = this.isNightMode ? '#ffffff' : theme.stationStroke;
    const fillColor = this.isNightMode ? '#282a2d' : theme.stationFill;

    stations.forEach(st => {
      ctx.save();
      ctx.translate(st.x, st.y);

      // Overcrowding Warning Countdown Gauge
      if (st.overcrowdTimer > 0) {
        ctx.beginPath();
        const startAngle = -Math.PI / 2;
        const endAngle = startAngle + Math.PI * 2 * Math.min(1.0, st.overcrowdTimer);

        ctx.arc(0, 0, 24, startAngle, endAngle, false);
        if (st.overcrowdTimer > 0.65) {
          const pulse = (Math.sin(Date.now() * 0.018) + 1) * 0.5;
          ctx.strokeStyle = pulse > 0.4 ? '#ef4444' : '#b91c1c';
          ctx.lineWidth = 5.0;
        } else {
          ctx.strokeStyle = '#4b5563';
          ctx.lineWidth = 4.0;
        }
        ctx.lineCap = 'round';
        ctx.stroke();
      }

      // Interchange Station Outer Concentric Ring
      if (st.isInterchange) {
        ctx.beginPath();
        ctx.arc(0, 0, 20.5, 0, Math.PI * 2);
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 3.2;
        ctx.stroke();
      }

      // Main Station Geometric Glyph
      ctx.fillStyle = fillColor;
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 4.0;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';

      this.drawShapeGlyph(ctx, 0, 0, st.type, 14, false);
      ctx.fill();
      ctx.stroke();

      // Passenger Queue
      if (st.peeps.length > 0) {
        const peepSize = 4.5;
        const startOffsetX = 24;
        const startOffsetY = -10;
        const cols = 4;

        st.peeps.forEach((peep, idx) => {
          const col = idx % cols;
          const row = Math.floor(idx / cols);
          const px = startOffsetX + col * 11;
          const py = startOffsetY + row * 11;

          ctx.fillStyle = strokeColor;
          this.drawShapeGlyph(ctx, px, py, peep.type, peepSize, true);
        });
      }

      ctx.restore();
    });
  }

  // Draw Animated Tutorial Hint (pulsing connection line when no lines exist)
  drawTutorialHint(engine) {
    const totalConnected = engine.lines.reduce((sum, l) => sum + l.stations.length, 0);
    if (totalConnected > 0 || engine.stations.length < 2) return;

    const s1 = engine.stations[0];
    const s2 = engine.stations[1];
    const ctx = this.ctx;

    const pulse = (Math.sin(Date.now() * 0.005) + 1) * 0.5;
    ctx.save();
    ctx.strokeStyle = `rgba(245, 158, 11, ${0.4 + pulse * 0.5})`;
    ctx.lineWidth = 4.0;
    ctx.setLineDash([8, 8]);
    ctx.lineDashOffset = -Date.now() * 0.02;

    const path = Geometry.getCanonicalMetroPath(s1, s2);
    ctx.beginPath();
    Geometry.drawRoundedPath(ctx, path, 16);
    ctx.stroke();

    // Draw animated pulsating hand / dot
    const midPoint = Geometry.pointAlongPath(path, (Date.now() % 2000) / 2000);
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(midPoint.x, midPoint.y, 8, 0, Math.PI * 2);
    ctx.fillStyle = '#f59e0b';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.0;
    ctx.stroke();

    ctx.restore();
  }

  // Draw Floating Score Popups ("+1")
  drawScorePopups() {
    const ctx = this.ctx;
    this.scorePopups.forEach(p => {
      ctx.save();
      ctx.font = 'bold 16px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      ctx.fillStyle = `rgba(16, 185, 129, ${p.alpha})`;
      ctx.textAlign = 'center';
      ctx.fillText(p.text, p.x, p.y);
      ctx.restore();
    });
  }

  // Draw Geometric Shape Glyphs
  drawShapeGlyph(ctx, x, y, type, radius, isFilledOnly = false) {
    ctx.beginPath();
    switch (type) {
      case 'circle':
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        break;

      case 'triangle': {
        ctx.moveTo(x, y - radius * 1.15);
        ctx.lineTo(x + radius, y + radius * 0.75);
        ctx.lineTo(x - radius, y + radius * 0.75);
        ctx.closePath();
        break;
      }

      case 'square':
        ctx.roundRect(x - radius * 0.9, y - radius * 0.9, radius * 1.8, radius * 1.8, 2.5);
        break;

      case 'star': {
        const spikes = 5;
        const outer = radius * 1.25;
        const inner = radius * 0.58;
        let rot = (Math.PI / 2) * 3;
        const step = Math.PI / spikes;

        ctx.moveTo(x, y - outer);
        for (let i = 0; i < spikes; i++) {
          ctx.lineTo(x + Math.cos(rot) * outer, y + Math.sin(rot) * outer);
          rot += step;
          ctx.lineTo(x + Math.cos(rot) * inner, y + Math.sin(rot) * inner);
          rot += step;
        }
        ctx.closePath();
        break;
      }

      case 'diamond':
        ctx.moveTo(x, y - radius * 1.3);
        ctx.lineTo(x + radius * 1.05, y);
        ctx.lineTo(x, y + radius * 1.3);
        ctx.lineTo(x - radius * 1.05, y);
        ctx.closePath();
        break;

      case 'pentagon': {
        const sides = 5;
        const a = (Math.PI * 2) / sides;
        ctx.moveTo(x, y - radius);
        for (let i = 1; i < sides; i++) {
          ctx.lineTo(x + radius * Math.sin(a * i), y - radius * Math.cos(a * i));
        }
        ctx.closePath();
        break;
      }

      case 'cross': {
        const w = radius * 0.38;
        const l = radius * 1.15;
        ctx.moveTo(x - w, y - l);
        ctx.lineTo(x + w, y - l);
        ctx.lineTo(x + w, y - w);
        ctx.lineTo(x + l, y - w);
        ctx.lineTo(x + l, y + w);
        ctx.lineTo(x + w, y + w);
        ctx.lineTo(x + w, y + l);
        ctx.lineTo(x - w, y + l);
        ctx.lineTo(x - w, y + w);
        ctx.lineTo(x - l, y + w);
        ctx.lineTo(x - l, y - w);
        ctx.lineTo(x - w, y - w);
        ctx.closePath();
        break;
      }

      default:
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        break;
    }

    if (isFilledOnly) {
      ctx.fill();
    }
  }

  // Main Render Pass
  render(engine) {
    const ctx = this.ctx;
    const width = this.canvas.width;
    const height = this.canvas.height;
    const theme = engine.level.theme;

    this.updateCamera(1 / 60);
    this.updatePopups(1 / 60);

    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // Background fill
    ctx.fillStyle = this.isNightMode ? theme.bgNight : theme.bgDay;
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.scale(this.dpr, this.dpr);
    ctx.translate(width / (2 * this.dpr), height / (2 * this.dpr));
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-this.camX, -this.camY);

    // 1. Rivers & Water
    this.drawRivers(engine.level.rivers, theme);

    // 2. Tutorial pulsing guide if no lines
    this.drawTutorialHint(engine);

    // 3. Metro Lines
    this.drawLines(engine.lines, engine.level);

    // 4. Drag Preview
    this.drawDragPreview();

    // 5. Trains & Carriages
    this.drawTrains(engine.lines);

    // 6. Stations, Shapes & Queues (drawn on top of lines!)
    this.drawStations(engine.stations, theme);

    // 7. Floating "+1" score popups
    this.drawScorePopups();

    ctx.restore();
  }
}
