/* ==========================================================================
   MINI METRO - Core Simulation Engine
   Time, station spawns, passenger flows, train movements, loop lines,
   overcrowding countdown, and weekly upgrades
   ========================================================================== */

import { Geometry } from './geometry.js';
import { Pathfinding } from './pathfinding.js';

export class GameEngine {
  constructor(levelDef, audioManager, onWeeklyReward, onGameOver, onScoreChange) {
    this.level = levelDef;
    this.audio = audioManager;
    this.onWeeklyReward = onWeeklyReward;
    this.onGameOver = onGameOver;
    this.onScoreChange = onScoreChange;

    // Simulation state
    this.isPaused = false;
    this.timeScale = 1.0;
    this.isGameOver = false;

    // Clock
    this.simTime = 0;
    this.dayLength = 45.0; // seconds per game day
    this.dayOfWeek = 0; // 0 = Mon .. 6 = Sun
    this.hour = 8; // start at 8:00 AM
    this.lastHour = 8;
    this.week = 1;

    // Score & Stats
    this.score = 0;
    this.totalPassengersDelivered = 0;
    this.daysSurvived = 0;

    // Entities
    this.stations = [];
    this.lines = [];
    this.nextStationId = 1;
    this.nextLineId = 1;
    this.nextTrainId = 1;

    // Inventory & Assets
    this.maxLines = this.level.maxLines || 7;
    this.availableLocomotives = 0; // extra unassigned
    this.availableCarriages = this.level.initialCarriages || 0;
    this.totalBridges = this.level.initialBridges || 1;
    this.availableInterchanges = this.level.initialInterchanges || 0;

    // Spawning timers
    this.stationSpawnTimer = 0;
    this.stationSpawnInterval = this.level.spawnCooldown || 14.0;
    this.peepSpawnTimer = 0;

    this.worstOvercrowdStation = null;
    this.lastWarningAudioTime = 0;

    this.initLevel();
  }

  initLevel() {
    this.stations = [];
    this.lines = [];
    this.nextStationId = 1;
    this.nextLineId = 1;

    // Spawn initial stations
    this.level.initialStations.forEach(s => {
      this.addStation(s.x, s.y, s.type);
    });

    // Create line slots
    for (let i = 0; i < this.level.initialLines; i++) {
      this.createLine();
    }
  }

  createLine() {
    if (this.lines.length >= this.maxLines) return null;
    const colorIdx = this.lines.length % this.level.theme.lineColors.length;
    const line = {
      id: `line_${this.nextLineId++}`,
      index: this.lines.length,
      color: this.level.theme.lineColors[colorIdx],
      stations: [],
      trains: [],
      isLoop: false
    };

    // Every line starts with 1 free locomotive
    const train = this.createTrain(line);
    line.trains.push(train);

    this.lines.push(line);
    return line;
  }

  createTrain(line) {
    return {
      id: `train_${this.nextTrainId++}`,
      lineId: line.id,
      locomotives: 1,
      carriages: 0,
      capacity: 6,
      peeps: [],
      currentStationIndex: 0,
      nextStationIndex: 1,
      direction: 1,
      progress: 0.0,
      speed: (this.level.trainSpeedMultiplier || 1.0) * 0.38,
      atStation: false,
      dwellTimer: 0.0,
      dwellDuration: 0.75
    };
  }

  addStation(x, y, type = 'circle') {
    const station = {
      id: `st_${this.nextStationId++}`,
      x: x,
      y: y,
      type: type,
      isInterchange: false,
      capacity: 6,
      peeps: [],
      overcrowdTimer: 0.0,
      isOvercrowded: false
    };
    this.stations.push(station);
    if (this.audio) this.audio.playPeepSpawn(type);
    return station;
  }

  // Count bridges used by all tracks
  getUsedBridgesCount() {
    let count = 0;
    if (!this.level.rivers) return 0;

    this.lines.forEach(line => {
      if (line.stations.length < 2) return;
      for (let i = 0; i < line.stations.length - 1; i++) {
        const p1 = line.stations[i];
        const p2 = line.stations[i + 1];
        if (this.doesSegmentCrossRiver(p1, p2)) count++;
      }
      if (line.isLoop && line.stations.length >= 3) {
        const p1 = line.stations[line.stations.length - 1];
        const p2 = line.stations[0];
        if (this.doesSegmentCrossRiver(p1, p2)) count++;
      }
    });

    return count;
  }

  getAvailableBridges() {
    return Math.max(0, this.totalBridges - this.getUsedBridgesCount());
  }

  doesSegmentCrossRiver(p1, p2) {
    if (!this.level.rivers) return false;
    for (const river of this.level.rivers) {
      if (Geometry.segmentCrossesPolygon(p1, p2, river)) {
        return true;
      }
    }
    return false;
  }

  // Station and Passenger Spawns
  updateSpawns(dt) {
    // 1. Station Spawner
    this.stationSpawnTimer += dt;
    if (this.stationSpawnTimer >= this.stationSpawnInterval) {
      this.stationSpawnTimer = 0;
      this.spawnNewStation();
      this.stationSpawnInterval = Math.max(7.5, this.stationSpawnInterval * 0.98);
    }

    // 2. Peep Spawner
    this.peepSpawnTimer += dt;
    const baseInterval = 3.4 / (this.level.peepSpawnRate || 1.0);
    const tension = 1.0 + (this.week - 1) * 0.16;
    const peepInterval = Math.max(0.9, baseInterval / tension);

    if (this.peepSpawnTimer >= peepInterval) {
      this.peepSpawnTimer = 0;
      this.spawnRandomPeep();
    }
  }

  spawnNewStation() {
    const maxRadius = Math.min(380, 160 + this.stations.length * 15);
    const minSeparation = 78;

    let attempts = 0;
    while (attempts < 60) {
      attempts++;
      const angle = Math.random() * Math.PI * 2;
      const r = 60 + Math.random() * (maxRadius - 60);
      const x = Math.round(Math.cos(angle) * r);
      const y = Math.round(Math.sin(angle) * r);

      let tooClose = false;
      for (const s of this.stations) {
        if (Geometry.dist({ x, y }, s) < minSeparation) {
          tooClose = true;
          break;
        }
      }
      if (tooClose) continue;

      const shape = this.chooseNewStationShape();
      this.addStation(x, y, shape);
      break;
    }
  }

  chooseNewStationShape() {
    const counts = { circle: 0, triangle: 0, square: 0, rare: 0 };
    this.stations.forEach(s => {
      if (counts[s.type] !== undefined) counts[s.type]++;
      else counts.rare++;
    });

    const rand = Math.random();
    if (rand < 0.55 && counts.circle < 14) return 'circle';
    if (rand < 0.85 && counts.triangle < 8) return 'triangle';
    if (rand < 0.96 && counts.square < 5) return 'square';

    if (this.week >= 2 || this.stations.length > 7) {
      const rareShapes = ['star', 'diamond', 'pentagon', 'cross'];
      const existingRares = new Set(this.stations.map(s => s.type));
      for (const r of rareShapes) {
        if (!existingRares.has(r)) return r;
      }
    }

    return 'circle';
  }

  spawnRandomPeep() {
    if (this.stations.length < 2) return;
    const eligibleStations = this.stations.filter(s => s.peeps.length < (s.isInterchange ? 24 : 12));
    if (eligibleStations.length === 0) return;

    const sourceStation = eligibleStations[Math.floor(Math.random() * eligibleStations.length)];

    const availableShapes = Array.from(new Set(
      this.stations.map(s => s.type).filter(t => t !== sourceStation.type)
    ));
    if (availableShapes.length === 0) return;

    const targetShape = availableShapes[Math.floor(Math.random() * availableShapes.length)];

    const peep = {
      id: `peep_${Date.now()}_${Math.random()}`,
      type: targetShape,
      originStationId: sourceStation.id,
      spawnTime: this.simTime
    };

    sourceStation.peeps.push(peep);
    if (this.audio) this.audio.playPeepSpawn(targetShape);
  }

  // Update Clock
  updateClock(dt) {
    this.simTime += dt;
    const dayProgress = (this.simTime % this.dayLength) / this.dayLength;
    this.hour = Math.floor(dayProgress * 24);

    if (this.hour !== this.lastHour) {
      this.lastHour = this.hour;
      if (this.audio) this.audio.playHourTick();
    }

    const currentTotalDays = Math.floor(this.simTime / this.dayLength);
    const newDayOfWeek = currentTotalDays % 7;

    if (currentTotalDays > this.daysSurvived) {
      this.daysSurvived = currentTotalDays;
    }

    // Week Transition (Sunday 23:59 -> Monday 00:00)
    if (this.dayOfWeek === 6 && newDayOfWeek === 0) {
      this.dayOfWeek = newDayOfWeek;
      this.week++;
      this.triggerWeeklyReward();
      return;
    }
    this.dayOfWeek = newDayOfWeek;
  }

  triggerWeeklyReward() {
    this.isPaused = true;
    if (this.audio) this.audio.playWeeklyReward();

    // Standard Award: +1 Locomotive
    this.availableLocomotives++;

    const choices = [];
    if (this.lines.length < this.maxLines) {
      choices.push({ id: 'line', name: 'New Metro Line', desc: '+1 new transit line', icon: '🚇' });
    }
    choices.push({ id: 'carriage', name: 'Carriage', desc: '+6 passenger train capacity', icon: '🚃' });
    choices.push({ id: 'bridge', name: '2 Tunnels / Bridges', desc: 'Cross rivers and bays', icon: '🌉' });
    choices.push({ id: 'interchange', name: 'Interchange Station', desc: 'Boost station capacity to 18', icon: '🏢' });

    const shuffled = choices.sort(() => 0.5 - Math.random());
    const offer = [shuffled[0], shuffled[1]];

    if (this.onWeeklyReward) {
      this.onWeeklyReward(this.week, this.score, offer);
    }
  }

  applyUpgradeChoice(choiceId) {
    if (choiceId === 'line') {
      this.createLine();
    } else if (choiceId === 'carriage') {
      this.availableCarriages++;
      // Auto attach carriage to train with no carriage if possible
      for (const line of this.lines) {
        for (const train of line.trains) {
          if (train.carriages === 0 && this.availableCarriages > 0) {
            train.carriages++;
            train.capacity += 6;
            this.availableCarriages--;
            break;
          }
        }
      }
    } else if (choiceId === 'bridge') {
      this.totalBridges += 2;
    } else if (choiceId === 'interchange') {
      this.availableInterchanges++;
    }
    this.isPaused = false;
  }

  // Update trains along lines
  updateTrains(dt) {
    this.lines.forEach(line => {
      if (line.stations.length < 2) return;

      line.trains.forEach(train => {
        if (train.atStation) {
          train.dwellTimer += dt;
          if (train.dwellTimer >= train.dwellDuration) {
            train.atStation = false;
            train.dwellTimer = 0.0;
          }
          return;
        }

        train.progress += train.speed * dt;
        if (train.progress >= 1.0) {
          train.progress = 0.0;
          this.handleTrainArrival(train, line);
        }
      });
    });
  }

  handleTrainArrival(train, line) {
    train.currentStationIndex = train.nextStationIndex;
    const station = line.stations[train.currentStationIndex];
    if (!station) return;

    train.atStation = true;
    train.dwellTimer = 0.0;

    // 1. Disembarking
    const remainingPeeps = [];
    for (const peep of train.peeps) {
      const decision = Pathfinding.shouldPassengerDisembark(
        peep, station, line, this.lines, this.stations
      );

      if (decision.disembark) {
        if (decision.isDestination) {
          this.score++;
          this.totalPassengersDelivered++;
          if (this.onScoreChange) this.onScoreChange(this.score);
          if (this.audio) this.audio.playPeepDeliver();
        } else {
          station.peeps.push(peep);
          if (this.audio) this.audio.playPeepBoard();
        }
      } else {
        remainingPeeps.push(peep);
      }
    }
    train.peeps = remainingPeeps;

    // 2. Embarking
    const remainingStationPeeps = [];
    for (const peep of station.peeps) {
      if (train.peeps.length < train.capacity) {
        const shouldEmbark = Pathfinding.shouldPassengerEmbark(
          peep, station, line, this.lines, this.stations
        );
        if (shouldEmbark) {
          train.peeps.push(peep);
          if (this.audio) this.audio.playPeepBoard();
          continue;
        }
      }
      remainingStationPeeps.push(peep);
    }
    station.peeps = remainingStationPeeps;

    // 3. Next Station
    const numStations = line.stations.length;
    if (line.isLoop && numStations >= 3) {
      // Loop Line: Continuous circulation
      train.nextStationIndex = (train.currentStationIndex + 1) % numStations;
    } else {
      let nextIdx = train.currentStationIndex + train.direction;
      if (nextIdx >= numStations) {
        train.direction = -1;
        nextIdx = numStations - 2;
      } else if (nextIdx < 0) {
        train.direction = 1;
        nextIdx = 1;
      }
      train.nextStationIndex = Math.max(0, Math.min(numStations - 1, nextIdx));
    }
  }

  // Station Overcrowding
  updateOvercrowding(dt) {
    let worstStation = null;
    let maxOvercrowd = 0;

    this.stations.forEach(station => {
      const cap = station.isInterchange ? 18 : 6;
      station.capacity = cap;

      if (station.peeps.length > cap) {
        station.isOvercrowded = true;
        station.overcrowdTimer += dt / 18.0;

        if (station.overcrowdTimer > maxOvercrowd) {
          maxOvercrowd = station.overcrowdTimer;
          worstStation = station;
        }

        if (station.overcrowdTimer >= 1.0) {
          this.triggerGameOver(station);
        }
      } else {
        if (station.overcrowdTimer > 0) {
          station.overcrowdTimer = Math.max(0, station.overcrowdTimer - dt / 8.0);
          if (station.overcrowdTimer === 0) {
            station.isOvercrowded = false;
          }
        }
      }
    });

    this.worstOvercrowdStation = worstStation;

    if (maxOvercrowd > 0.65) {
      const now = Date.now();
      if (now - this.lastWarningAudioTime > 2200) {
        this.lastWarningAudioTime = now;
        if (this.audio) this.audio.playOvercrowdWarning();
      }
    }
  }

  triggerGameOver(overcrowdedStation) {
    if (this.isGameOver) return;
    this.isGameOver = true;
    this.isPaused = true;
    if (this.audio) this.audio.playGameOver();
    if (this.onGameOver) {
      this.onGameOver({
        score: this.score,
        daysSurvived: this.daysSurvived,
        overcrowdedStation: overcrowdedStation
      });
    }
  }

  update(rawDt) {
    if (this.isPaused || this.isGameOver) return;
    const dt = Math.min(0.1, rawDt) * this.timeScale;

    this.updateClock(dt);
    this.updateSpawns(dt);
    this.updateTrains(dt);
    this.updateOvercrowding(dt);
  }
}
