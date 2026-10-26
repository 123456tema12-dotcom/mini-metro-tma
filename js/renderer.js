/* ==========================================================================
   MINI METRO - High-DPI Canvas 2D Rendering Engine
   Authentic Harry Beck / Vignelli subway map style, crisp geometry, camera zoom & pan
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
    this.dpr = window.devicePixelRatio || 1;

    // Night mode flag
    this.isNightMode = false;

    // Track active dragging for preview
    this.dragPreview = null; // { line, fromStation, toStation, currentPos, type }

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

  // Coordinate transformations
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

  // Draw water bodies / rivers
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
        ctx.lineWidth = 4.0 / this.zoom;
        ctx.stroke();
      }
    });
  }

  // Draw all metro lines with parallel offsets when sharing links
  drawLines(lines, theme) {
    const ctx = this.ctx;

    // First, identify pairs of stations shared by multiple lines to offset them
    const linkMap = new Map(); // key = "idA-idB" sorted -> array of line references
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

    // Render each line segment
    lines.forEach(line => {
      if (line.stations.length < 2) return;
      ctx.strokeStyle = line.color;
      ctx.lineWidth = 7.0;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      const drawSegment = (s1, s2) => {
        const key = [s1.id, s2.id].sort().join('--');
        const sharingLines = linkMap.get(key) || [];
        const indexInSharing = sharingLines.findIndex(item => item.line.id === line.id);
        const totalSharing = sharingLines.length;

        // Calculate parallel track offset
        let offsetDistance = 0;
        if (totalSharing > 1) {
          const spacing = 8.0;
          offsetDistance = (indexInSharing - (totalSharing - 1) / 2) * spacing;
        }

        const normal = Geometry.getNormal(s1, s2, offsetDistance);
        const p1 = { x: s1.x + normal.x, y: s1.y + normal.y };
        const p2 = { x: s2.x + normal.x, y: s2.y + normal.y };

        const pathPoints = Geometry.generateMetroPath(p1, p2, 16);

        ctx.beginPath();
        Geometry.drawRoundedPath(ctx, pathPoints, 16);
        ctx.stroke();
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
      const endStations = [line.stations[0], line.stations[line.stations.length - 1]];

      endStations.forEach(st => {
        ctx.beginPath();
        ctx.arc(st.x, st.y, 8.5, 0, Math.PI * 2);
        ctx.fillStyle = line.color;
        ctx.fill();
        ctx.lineWidth = 2.0;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();
      });
    });
  }

  // Draw active line dragging preview
  drawDragPreview() {
    if (!this.dragPreview) return;
    const { line, fromStation, currentPos, targetStation } = this.dragPreview;
    const ctx = this.ctx;

    ctx.save();
    ctx.strokeStyle = line ? line.color : '#3b82f6';
    ctx.lineWidth = 6.0;
    ctx.lineCap = 'round';
    ctx.setLineDash([8, 6]);

    const endPoint = targetStation ? { x: targetStation.x, y: targetStation.y } : currentPos;
    const path = Geometry.generateMetroPath(fromStation, endPoint, 16);

    ctx.beginPath();
    Geometry.drawRoundedPath(ctx, path, 16);
    ctx.stroke();

    // End cursor circle
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(endPoint.x, endPoint.y, 9, 0, Math.PI * 2);
    ctx.fillStyle = line ? line.color : '#3b82f6';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.restore();
  }

  // Draw trains and carriages moving along lines
  drawTrains(lines) {
    const ctx = this.ctx;

    lines.forEach(line => {
      if (line.stations.length < 2) return;

      line.trains.forEach(train => {
        const s1 = line.stations[train.currentStationIndex];
        const s2 = line.stations[train.nextStationIndex];
        if (!s1 || !s2) return;

        // Compute track path between s1 and s2
        const pathPoints = Geometry.generateMetroPath(s1, s2, 16);
        const trainPos = Geometry.pointAlongPath(pathPoints, train.progress);

        // Train Locomotive
        ctx.save();
        ctx.translate(trainPos.x, trainPos.y);
        ctx.rotate(trainPos.angle);

        // Draw Locomotive body
        const trainLen = 24;
        const trainWidth = 12;
        ctx.fillStyle = line.color;
        ctx.beginPath();
        ctx.roundRect(-trainLen / 2, -trainWidth / 2, trainLen, trainWidth, 4);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Front window notch
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.roundRect(trainLen / 2 - 4, -trainWidth / 4, 3, trainWidth / 2, 1);
        ctx.fill();

        // Draw passenger glyphs inside train
        if (train.peeps.length > 0) {
          const maxGlyphs = Math.min(train.peeps.length, 6);
          const spacing = 14 / (maxGlyphs + 1);
          for (let p = 0; p < maxGlyphs; p++) {
            const peep = train.peeps[p];
            const px = -trainLen / 2 + 5 + p * 3;
            ctx.fillStyle = '#ffffff';
            this.drawShapeGlyph(ctx, px, 0, peep.type, 2.5, true);
          }
        }

        // Draw Attached Carriage if train has carriage
        if (train.carriages > 0) {
          const carLen = 20;
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
          ctx.roundRect(carOffset - carLen / 2, -trainWidth / 2, carLen, trainWidth, 3);
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.5;
          ctx.stroke();
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

      // Overcrowding Warning Gauge (Ring filling clockwise around station)
      if (st.overcrowdTimer > 0) {
        ctx.beginPath();
        const startAngle = -Math.PI / 2;
        const endAngle = startAngle + Math.PI * 2 * Math.min(1.0, st.overcrowdTimer);

        ctx.arc(0, 0, 22, startAngle, endAngle, false);
        // Transition to pulse alert red when > 70%
        if (st.overcrowdTimer > 0.7) {
          const pulse = (Math.sin(Date.now() * 0.015) + 1) * 0.5;
          ctx.strokeStyle = pulse > 0.4 ? '#ef4444' : '#b91c1c';
          ctx.lineWidth = 5.0;
        } else {
          ctx.strokeStyle = '#4b5563';
          ctx.lineWidth = 4.0;
        }
        ctx.lineCap = 'round';
        ctx.stroke();
      }

      // If station is an Interchange, draw outer double ring badge
      if (st.isInterchange) {
        ctx.beginPath();
        ctx.arc(0, 0, 19, 0, Math.PI * 2);
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 3.0;
        ctx.stroke();
      }

      // Draw Main Station Shape
      ctx.fillStyle = fillColor;
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 3.5;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';

      this.drawShapeGlyph(ctx, 0, 0, st.type, 13, false);
      ctx.fill();
      ctx.stroke();

      // Draw Passenger Queue beside station
      if (st.peeps.length > 0) {
        const peepSize = 4.0;
        const startOffsetX = 22;
        const startOffsetY = -8;
        const cols = 4;

        st.peeps.forEach((peep, idx) => {
          const col = idx % cols;
          const row = Math.floor(idx / cols);
          const px = startOffsetX + col * 10;
          const py = startOffsetY + row * 10;

          ctx.fillStyle = strokeColor;
          this.drawShapeGlyph(ctx, px, py, peep.type, peepSize, true);
        });
      }

      ctx.restore();
    });
  }

  // Draw geometric shape glyph (Circle, Triangle, Square, Star, Diamond, Pentagon, Cross)
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
        ctx.roundRect(x - radius * 0.9, y - radius * 0.9, radius * 1.8, radius * 1.8, 2);
        break;

      case 'star': {
        const spikes = 5;
        const outer = radius * 1.2;
        const inner = radius * 0.55;
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
        ctx.moveTo(x, y - radius * 1.25);
        ctx.lineTo(x + radius * 1.0, y);
        ctx.lineTo(x, y + radius * 1.25);
        ctx.lineTo(x - radius * 1.0, y);
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
        const w = radius * 0.35;
        const l = radius * 1.1;
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

  // Main Render Frame
  render(engine) {
    const ctx = this.ctx;
    const width = this.canvas.width;
    const height = this.canvas.height;
    const theme = engine.level.theme;

    // Reset transform
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // Clear background
    ctx.fillStyle = this.isNightMode ? theme.bgNight : theme.bgDay;
    ctx.fillRect(0, 0, width, height);

    // Apply Camera transform
    ctx.save();
    ctx.scale(this.dpr, this.dpr);
    ctx.translate(width / (2 * this.dpr), height / (2 * this.dpr));
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-this.camX, -this.camY);

    // 1. Rivers & Water
    this.drawRivers(engine.level.rivers, theme);

    // 2. Metro Lines
    this.drawLines(engine.lines, theme);

    // 3. Active Drag preview
    this.drawDragPreview();

    // 4. Trains & Carriages
    this.drawTrains(engine.lines);

    // 5. Stations & Passengers
    this.drawStations(engine.stations, theme);

    ctx.restore();
  }
}
