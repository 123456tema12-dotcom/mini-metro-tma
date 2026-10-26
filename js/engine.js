/* ==========================================================================
   MINI METRO - Core Simulation Engine
   Time, station spawns, passenger flows, train movements, overcrowding & weekly upgrades
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
    this.simTime = 0; // Total seconds of simulation
    this.dayLength = 48.0; // Real-world seconds per game day
    this.dayOfWeek = 0; // 0 = Mon, 1 = Tue, ..., 6 = Sun
    this.hour = 0; // 0..23
    this.lastHour = 0;
    this.week = 1;

    // Scoring & Stats
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
    this.availableLines = this.level.initialLines;
    this.maxLines = this.level.maxLines || 7;
    this.availableLocomotives = 0; // extra unassigned
    this.availableCarriages = this.level.initialCarriages || 0;
    this.totalBridges = this.level.initialBridges || 1;
    this.availableInterchanges = this.level.initialInterchanges || 0;

    // Spawning timers
    this.stationSpawnTimer = 0;
    this.stationSpawnInterval = this.level.spawnCooldown || 14.0;
    this.peepSpawnTimer = 0;

    // Active overcapacity warning state
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

    // Create line color instances
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
      stations: [], // ordered list of Station references
      trains: [],   // list of Train instances
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
      direction: 1, // +1 moving forward, -1 moving backward
      progress: 0.0, // 0..1 between current and next station
      speed: (this.level.trainSpeedMultiplier || 1.0) * 0.35, // progress fraction per second
      atStation: false,
      dwellTimer: 0.0,
      dwellDuration: 0.8
    };
  }

  addStation(x, y, type = 'circle') {
    const station = {
      id: `st_${this.nextStationId++}`,
      x: x,
      y: y,
      type: type, // 'circle', 'triangle', 'square', 'star', 'diamond', 'pentagon', 'cross'
      isInterchange: false,
      capacity: 6,
      peeps: [],
      overcrowdTimer: 0.0, // 0..1
      isOvercrowded: false,
      pulseAnim: 0.0
    };
    this.stations.push(station);
    if (this.audio) this.audio.playPeepSpawn(type);
    return station;
  }

  // Count how many bridges/tunnels are currently used by all lines
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
      // Slightly decrease interval as time goes on, down to 8s
      this.stationSpawnInterval = Math.max(8.0, this.stationSpawnInterval * 0.98);
    }

    // 2. Peep Spawner
    this.peepSpawnTimer += dt;
    const baseInterval = 3.6 / (this.level.peepSpawnRate || 1.0);
    // Acceleration over weeks
    const tension = 1.0 + (this.week - 1) * 0.15;
    const peepInterval = Math.max(1.0, baseInterval / tension);

    if (this.peepSpawnTimer >= peepInterval) {
      this.peepSpawnTimer = 0;
      this.spawnRandomPeep();
    }
  }

  spawnNewStation() {
    // Generate position in expanding circle
    const maxRadius = Math.min(380, 160 + this.stations.length * 14);
    const minSeparation = 75; // minimum distance between any 2 stations

    let attempts = 0;
    while (attempts < 50) {
      attempts++;
      const angle = Math.random() * Math.PI * 2;
      const r = 60 + Math.random() * (maxRadius - 60);
      const x = Math.round(Math.cos(angle) * r);
      const y = Math.round(Math.sin(angle) * r);

      // Check distance from all existing stations
      let tooClose = false;
      for (const s of this.stations) {
        if (Geometry.dist({ x, y }, s) < minSeparation) {
          tooClose = true;
          break;
        }
      }
      if (tooClose) continue;

      // Choose shape type
      const shape = this.chooseNewStationShape();
      this.addStation(x, y, shape);
      break;
    }
  }

  chooseNewStationShape() {
    // Shape distribution: Circles (~55%), Triangles (~30%), Squares (~12%), Rare (~3%)
    const counts = { circle: 0, triangle: 0, square: 0, rare: 0 };
    this.stations.forEach(s => {
      if (counts[s.type] !== undefined) counts[s.type]++;
      else counts.rare++;
    });

    const rand = Math.random();
    if (rand < 0.55 && counts.circle < 14) return 'circle';
    if (rand < 0.85 && counts.triangle < 8) return 'triangle';
    if (rand < 0.96 && counts.square < 5) return 'square';

    // Rare shapes appear starting week 2 or when map has > 8 stations
    if (this.week >= 2 || this.stations.length > 8) {
      const rareShapes = ['star', 'diamond', 'pentagon', 'cross'];
      // Pick a rare shape not currently on map
      const existingRares = new Set(this.stations.map(s => s.type));
      for (const r of rareShapes) {
        if (!existingRares.has(r)) return r;
      }
    }

    return 'circle';
  }

  spawnRandomPeep() {
    if (this.stations.length < 2) return;
    // Pick random station with space
    const eligibleStations = this.stations.filter(s => s.peeps.length < 12);
    if (eligibleStations.length === 0) return;

    const sourceStation = eligibleStations[Math.floor(Math.random() * eligibleStations.length)];

    // Target shape MUST be different from source station's shape
    // Collect all other shapes present in the city
    const availableShapes = Array.from(new Set(
      this.stations.map(s => s.type).filter(t => t !== sourceStation.type)
    ));
    if (availableShapes.length === 0) return;

    // Weight squares and rare shapes higher if they exist
    let targetShape = availableShapes[Math.floor(Math.random() * availableShapes.length)];

    const peep = {
      id: `peep_${Date.now()}_${Math.random()}`,
      type: targetShape,
      originStationId: sourceStation.id,
      spawnTime: this.simTime
    };

    sourceStation.peeps.push(peep);
    if (this.audio) this.audio.playPeepSpawn(targetShape);
  }

  // Update clock & time
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

    // Check if new day
    if (currentTotalDays > this.daysSurvived) {
      this.daysSurvived = currentTotalDays;
    }

    // Check if week ended (Sunday 23:59 -> Monday 00:00)
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

    // Standard weekly award: +1 Locomotive
    this.availableLocomotives++;

    // Generate 2 bonus options for player to choose
    const choices = [];
    if (this.lines.length < this.maxLines) {
      choices.push({ id: 'line', name: 'New Metro Line', desc: '+1 new transit line', icon: '🚇' });
    }
    choices.push({ id: 'carriage', name: 'Carriage', desc: '+6 passenger train capacity', icon: '🚃' });
    choices.push({ id: 'bridge', name: '2 Tunnels / Bridges', desc: 'Cross rivers and bays', icon: '🌉' });
    choices.push({ id: 'interchange', name: 'Interchange Station', desc: 'Boost station capacity to 18', icon: '🏢' });

    // Pick 2 random distinct choices
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
      // Auto-attach carriage to first train with no carriage if possible
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

  // Update train positions and passenger embark/disembark
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

        // Move train along segment
        train.progress += train.speed * dt;
        if (train.progress >= 1.0) {
          train.progress = 0.0;
          // Arrived at next station!
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
          // Reached destination! Score!
          this.score++;
          this.totalPassengersDelivered++;
          if (this.onScoreChange) this.onScoreChange(this.score);
          if (this.audio) this.audio.playPeepDeliver();
        } else {
          // Transfer to this station
          station.peeps.push(peep);
          if (this.audio) this.audio.playPeepBoard();
        }
      } else {
        remainingPeeps.push(peep);
      }
    }
    train.peeps = remainingPeeps;

    // 2. Embarking from station
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

    // 3. Plan next station
    const numStations = line.stations.length;
    if (line.isLoop && numStations >= 3) {
      train.nextStationIndex = (train.currentStationIndex + train.direction + numStations) % numStations;
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

  // Check station capacity and overcrowding
  updateOvercrowding(dt) {
    let worstStation = null;
    let maxOvercrowd = 0;

    this.stations.forEach(station => {
      const cap = station.isInterchange ? 18 : 6;
      station.capacity = cap;

      if (station.peeps.length > cap) {
        station.isOvercrowded = true;
        // Overcrowd timer fills over 18 seconds
        station.overcrowdTimer += dt / 18.0;

        if (station.overcrowdTimer > maxOvercrowd) {
          maxOvercrowd = station.overcrowdTimer;
          worstStation = station;
        }

        // Game Over condition!
        if (station.overcrowdTimer >= 1.0) {
          this.triggerGameOver(station);
        }
      } else {
        // Cooldown when below capacity
        if (station.overcrowdTimer > 0) {
          station.overcrowdTimer = Math.max(0, station.overcrowdTimer - dt / 8.0);
          if (station.overcrowdTimer === 0) {
            station.isOvercrowded = false;
          }
        }
      }
    });

    this.worstOvercrowdStation = worstStation;

    // Periodic warning sound if any station is critically overcrowded (> 60%)
    if (maxOvercrowd > 0.6) {
      const now = Date.now();
      if (now - this.lastWarningAudioTime > 2500) {
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

  // Main tick
  update(rawDt) {
    if (this.isPaused || this.isGameOver) return;
    const dt = Math.min(0.1, rawDt) * this.timeScale;

    this.updateClock(dt);
    this.updateSpawns(dt);
    this.updateTrains(dt);
    this.updateOvercrowding(dt);
  }
}
