/* ==========================================================================
   MINI METRO - High-DPI Canvas 2D Rendering Engine
   Authentic Harry Beck / Vignelli subway map style:
   - Octilinear 45°/90° track routing
   - Parallel multi-line track corridors
   - Dashed tunnels & bridges across rivers
   - Crisp geometric station glyphs & queues
   - Passenger icons inside trains
   - Clockwise overcrowding countdown gauge
   - Camera zoom, pan & game-over focus
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

    // Drag previews
    this.dragPreview = null; // { mode, line, fromStation, currentPos, targetStation, insertIndex }

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

  // Smooth camera interpolation
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

  // Draw Metro Lines with Parallel Offsets and River Crossings (Bridges / Tunnels)
  drawLines(lines, level) {
    const ctx = this.ctx;
    const rivers = level.rivers || [];
    const crossingStyle = level.crossingStyle || 'bridge';

    // 1. Identify pairs of stations shared by multiple lines to offset them
    const linkMap = new Map();
    lines.forEach(line => {
      if (line.stations.length < 2) return;
      const processPair = (s1, s2) => {
        const key = [s1.id, s2.id].sort().join('--');
        if (!linkMap.has(key)) linkMap.set(key, []);
        linkMap.get(key).push({ line, s1, s2 });
      };

      for (let i = 0; i < line.stations.length - 1; i++) {
        processPair(line.stations[i], line.stations[i + 1]);
      }
      if (line.isLoop && line.stations.length >= 3) {
        processPair(line.stations[line.stations.length - 1], line.stations[0]);
      }
    });

    // 2. Render each segment
    lines.forEach(line => {
      if (line.stations.length < 2) return;

      const drawSegment = (s1, s2) => {
        const key = [s1.id, s2.id].sort().join('--');
        const sharingLines = linkMap.get(key) || [];
        const indexInSharing = sharingLines.findIndex(item => item.line.id === line.id);
        const totalSharing = sharingLines.length;

        // Calculate parallel track offset
        let offsetDistance = 0;
        if (totalSharing > 1) {
          const spacing = 9.0;
          offsetDistance = (indexInSharing - (totalSharing - 1) / 2) * spacing;
        }

        const normal = Geometry.getNormal(s1, s2, offsetDistance);
        const p1 = { x: s1.x + normal.x, y: s1.y + normal.y };
        const p2 = { x: s2.x + normal.x, y: s2.y + normal.y };

        const pathPoints = Geometry.generateMetroPath(p1, p2);

        // Check if segment crosses river
        let crossesRiver = false;
        for (const river of rivers) {
          if (Geometry.segmentCrossesPolygon(p1, p2, river)) {
            crossesRiver = true;
            break;
          }
        }

        // Standard track stroke
        ctx.strokeStyle = line.color;
        ctx.lineWidth = 7.0;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        if (crossesRiver) {
          if (crossingStyle === 'tunnel') {
            // London Tube Tunnel: dashed track under water
            ctx.setLineDash([7, 5]);
            ctx.beginPath();
            Geometry.drawRoundedPath(ctx, pathPoints, 16);
            ctx.stroke();
            ctx.setLineDash([]);
          } else {
            // Bridge: draw solid track with bridge casing
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

    // 3. Draw Line Terminators (T-bar / grab handle at line ends)
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

  // Draw active drag preview (new line, extending, or middle-line kink)
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
      // Draw rubber-band kink from S1 -> cursor -> S2
      const endPoint = targetStation ? targetStation : currentPos;
      const path1 = Geometry.generateMetroPath(segmentS1, endPoint);
      const path2 = Geometry.generateMetroPath(endPoint, segmentS2);

      ctx.beginPath();
      Geometry.drawRoundedPath(ctx, path1, 16);
      Geometry.drawRoundedPath(ctx, path2, 16);
      ctx.stroke();

      // End cursor circle
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(endPoint.x, endPoint.y, 10, 0, Math.PI * 2);
      ctx.fillStyle = lineColor;
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5;
      ctx.stroke();
    } else {
      // Normal draw new or extend
      const endPoint = targetStation ? targetStation : currentPos;
      const path = Geometry.generateMetroPath(fromStation, endPoint);

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

  // Draw Trains with passenger shape glyphs inside
  drawTrains(lines) {
    const ctx = this.ctx;

    lines.forEach(line => {
      if (line.stations.length < 2) return;

      line.trains.forEach(train => {
        const s1 = line.stations[train.currentStationIndex];
        const s2 = line.stations[train.nextStationIndex];
        if (!s1 || !s2) return;

        const pathPoints = Geometry.generateMetroPath(s1, s2);
        const trainPos = Geometry.pointAlongPath(pathPoints, train.progress);

        ctx.save();
        ctx.translate(trainPos.x, trainPos.y);
        ctx.rotate(trainPos.angle);

        // Train Locomotive Dimensions
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

      // Overcrowding Warning Countdown Gauge (fills clockwise from 12 o'clock)
      if (st.overcrowdTimer > 0) {
        ctx.beginPath();
        const startAngle = -Math.PI / 2;
        const endAngle = startAngle + Math.PI * 2 * Math.min(1.0, st.overcrowdTimer);

        ctx.arc(0, 0, 24, startAngle, endAngle, false);
        if (st.overcrowdTimer > 0.65) {
          // Urgent pulsing red
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

  // Draw Geometric Shape Glyphs
  drawShapeGlyph(ctx, x, y, type, radius, isFilledOnly = false) {
    ctx.beginPath();
    switch (type) {
      case 'circle':
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        break;

      case 'triangle': {
        const h = radius * 1.732;
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

    // Smooth camera updates
    this.updateCamera(1 / 60);

    // Reset canvas transform
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // Background fill
    ctx.fillStyle = this.isNightMode ? theme.bgNight : theme.bgDay;
    ctx.fillRect(0, 0, width, height);

    // Apply Camera view
    ctx.save();
    ctx.scale(this.dpr, this.dpr);
    ctx.translate(width / (2 * this.dpr), height / (2 * this.dpr));
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-this.camX, -this.camY);

    // 1. Rivers & Water
    this.drawRivers(engine.level.rivers, theme);

    // 2. Metro Lines (with tunnels and bridges)
    this.drawLines(engine.lines, engine.level);

    // 3. Active Line Drag Preview
    this.drawDragPreview();

    // 4. Trains & Carriages
    this.drawTrains(engine.lines);

    // 5. Stations, Shapes & Queues (drawn on top of lines!)
    this.drawStations(engine.stations, theme);

    ctx.restore();
  }
}
