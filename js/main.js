/* ==========================================================================
   MINI METRO - Main Application & UI Orchestrator
   Game lifecycle, HUD data-binding, modal controllers, and animation loop
   ========================================================================== */

import { AudioManager } from './audio.js';
import { Geometry } from './geometry.js';
import { Levels } from './levels.js';
import { GameEngine } from './engine.js';
import { Renderer } from './renderer.js';
import { InputManager } from './input.js';
import { TelegramBridge } from './tg.js';

class App {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.audio = new AudioManager();
    this.tg = new TelegramBridge();
    this.currentLevelId = 'london';

    // UI elements
    this.cityNameEl = document.getElementById('city-name');
    this.clockDayEl = document.getElementById('clock-day');
    this.clockHandEl = document.getElementById('clock-hand');
    this.scoreValueEl = document.getElementById('score-value');
    this.lineTokensEl = document.getElementById('line-tokens');
    this.bridgesCountEl = document.getElementById('bridges-count');
    this.trainsCountEl = document.getElementById('trains-count');

    // Modals
    this.weeklyModal = document.getElementById('weekly-modal');
    this.weeklyTitleEl = document.getElementById('weekly-title');
    this.weeklySubtitleEl = document.getElementById('weekly-subtitle');
    this.upgradeGridEl = document.getElementById('upgrade-grid');

    this.gameOverModal = document.getElementById('game-over-modal');
    this.finalScoreEl = document.getElementById('final-score');
    this.finalDaysEl = document.getElementById('final-days');

    this.cityModal = document.getElementById('city-modal');
    this.cityGridEl = document.getElementById('city-grid');

    this.helpModal = document.getElementById('help-modal');

    // Day names
    this.daysOfWeek = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

    this.initGame();
    this.initUIControls();
    this.startLoop();
  }

  initGame() {
    const levelDef = Levels[this.currentLevelId] || Levels.london;
    this.cityNameEl.textContent = levelDef.name.toUpperCase();

    // Setup Engine & Renderer
    this.renderer = new Renderer(this.canvas);
    this.renderer.isNightMode = this.tg.getThemeMode() === 'dark';
    if (this.renderer.isNightMode) {
      document.body.classList.add('night-mode');
    }

    this.engine = new GameEngine(
      levelDef,
      this.audio,
      (week, score, choices) => this.showWeeklyModal(week, score, choices),
      (data) => this.showGameOverModal(data),
      (score) => this.updateScoreUI(score)
    );

    this.input = new InputManager(this.canvas, this.engine, this.renderer, this.audio, this.tg);

    this.updateHUD();
    window.addEventListener('resize', () => this.renderer.resize());
  }

  initUIControls() {
    // Speed buttons
    const btnPause = document.getElementById('btn-pause');
    const btn1x = document.getElementById('btn-1x');
    const btn2x = document.getElementById('btn-2x');

    const setSpeed = (spd, isPaused) => {
      this.engine.isPaused = isPaused;
      this.engine.timeScale = spd;
      btnPause.classList.toggle('active', isPaused);
      btn1x.classList.toggle('active', !isPaused && spd === 1.0);
      btn2x.classList.toggle('active', !isPaused && spd === 2.0);
      this.tg.hapticSelection();
    };

    btnPause.addEventListener('click', () => setSpeed(1.0, true));
    btn1x.addEventListener('click', () => setSpeed(1.0, false));
    btn2x.addEventListener('click', () => setSpeed(2.0, false));

    // Audio mute toggle
    const btnSound = document.getElementById('btn-sound');
    btnSound.addEventListener('click', () => {
      this.audio.init();
      const muted = this.audio.toggleMute();
      btnSound.textContent = muted ? '🔇' : '🔊';
      this.tg.hapticSelection();
    });

    // Theme toggle (Day / Night)
    const btnTheme = document.getElementById('btn-theme');
    btnTheme.addEventListener('click', () => {
      this.renderer.isNightMode = !this.renderer.isNightMode;
      document.body.classList.toggle('night-mode', this.renderer.isNightMode);
      btnTheme.textContent = this.renderer.isNightMode ? '🌙' : '☀️';
      this.tg.hapticSelection();
    });

    // Center camera button
    const btnCenter = document.getElementById('btn-center');
    btnCenter.addEventListener('click', () => {
      this.renderer.camX = 0;
      this.renderer.camY = 0;
      this.renderer.zoom = 1.0;
      this.tg.hapticSelection();
    });

    // City Selector open button
    this.cityNameEl.parentElement.addEventListener('click', () => {
      this.showCitySelectModal();
    });

    // Help open button
    document.getElementById('btn-help').addEventListener('click', () => {
      this.helpModal.classList.add('visible');
      this.engine.isPaused = true;
      this.tg.hapticSelection();
    });

    document.getElementById('btn-close-help').addEventListener('click', () => {
      this.helpModal.classList.remove('visible');
      this.engine.isPaused = false;
      this.tg.hapticSelection();
    });

    // Game Over Restart & Share buttons
    document.getElementById('btn-restart').addEventListener('click', () => {
      this.gameOverModal.classList.remove('visible');
      this.initGame();
      this.tg.hapticNotification('success');
    });

    document.getElementById('btn-share').addEventListener('click', () => {
      const level = Levels[this.currentLevelId];
      this.tg.shareScore(level.name, this.engine.score, this.engine.daysSurvived);
    });

    // Remove empty / clear line button
    document.getElementById('btn-clear-lines').addEventListener('click', () => {
      // Clear line with least stations or prompt
      for (let i = this.engine.lines.length - 1; i >= 0; i--) {
        if (this.engine.lines[i].stations.length > 0) {
          this.engine.lines[i].stations = [];
          this.engine.lines[i].isLoop = false;
          if (this.audio) this.audio.playLineConnect();
          this.tg.hapticNotification('warning');
          break;
        }
      }
    });

    // Dismiss first-time instructions overlay on tap
    const tipOverlay = document.getElementById('instructions-tip');
    if (tipOverlay) {
      setTimeout(() => {
        tipOverlay.style.opacity = '0';
        setTimeout(() => tipOverlay.remove(), 600);
      }, 5000);
    }
  }

  showWeeklyModal(week, score, choices) {
    this.weeklyTitleEl.textContent = `Week ${week} Complete!`;
    this.weeklySubtitleEl.textContent = `${score} passengers delivered. Choose your upgrade:`;

    this.upgradeGridEl.innerHTML = '';
    choices.forEach(ch => {
      const card = document.createElement('div');
      card.className = 'upgrade-choice-card';
      card.innerHTML = `
        <div class="upgrade-choice-icon">${ch.icon}</div>
        <div class="upgrade-choice-name">${ch.name}</div>
        <div class="upgrade-choice-desc">${ch.desc}</div>
      `;
      card.addEventListener('click', () => {
        this.engine.applyUpgradeChoice(ch.id);
        this.weeklyModal.classList.remove('visible');
        this.tg.hapticNotification('success');
      });
      this.upgradeGridEl.appendChild(card);
    });

    this.weeklyModal.classList.add('visible');
  }

  showGameOverModal(data) {
    this.finalScoreEl.textContent = data.score;
    this.finalDaysEl.textContent = data.daysSurvived;
    this.gameOverModal.classList.add('visible');
    this.tg.hapticNotification('error');
  }

  showCitySelectModal() {
    this.engine.isPaused = true;
    this.cityGridEl.innerHTML = '';

    Object.values(Levels).forEach(lvl => {
      const card = document.createElement('div');
      card.className = `city-card ${lvl.id === this.currentLevelId ? 'selected' : ''}`;
      card.innerHTML = `
        <div class="city-name">${lvl.name}</div>
        <div class="city-desc">${lvl.desc}</div>
      `;
      card.addEventListener('click', () => {
        this.currentLevelId = lvl.id;
        this.cityModal.classList.remove('visible');
        this.initGame();
        this.tg.hapticNotification('success');
      });
      this.cityGridEl.appendChild(card);
    });

    this.cityModal.classList.add('visible');
    document.getElementById('btn-close-city').onclick = () => {
      this.cityModal.classList.remove('visible');
      this.engine.isPaused = false;
    };
  }

  updateScoreUI(score) {
    this.scoreValueEl.textContent = score;
  }

  updateHUD() {
    // Clock text & hand
    const dayStr = this.daysOfWeek[this.engine.dayOfWeek];
    const hourStr = String(this.engine.hour).padStart(2, '0') + ':00';
    this.clockDayEl.textContent = `${dayStr} ${hourStr}`;

    const angle = (this.engine.hour / 24) * 360;
    this.clockHandEl.style.transform = `rotate(${angle}deg)`;

    // Bridges & Trains count
    this.bridgesCountEl.textContent = `🌉 ${this.engine.getAvailableBridges()}`;
    const totalTrains = this.engine.lines.reduce((sum, l) => sum + l.trains.length, 0);
    this.trainsCountEl.textContent = `🚂 ${totalTrains}`;

    // Line Tokens
    this.lineTokensEl.innerHTML = '';
    this.engine.lines.forEach((line, idx) => {
      const token = document.createElement('div');
      token.className = `line-token ${line.stations.length > 0 ? 'active' : 'unused'}`;
      token.style.backgroundColor = line.color;
      token.title = `Line ${idx + 1} (${line.stations.length} stations)`;

      // Clicking token resets this line if clicked
      token.addEventListener('click', () => {
        if (line.stations.length > 0) {
          line.stations = [];
          line.isLoop = false;
          if (this.audio) this.audio.playLineConnect();
          this.tg.hapticNotification('warning');
        }
      });
      this.lineTokensEl.appendChild(token);
    });
  }

  startLoop() {
    let lastTime = performance.now();

    const loop = (now) => {
      const dt = (now - lastTime) / 1000;
      lastTime = now;

      this.engine.update(dt);
      this.renderer.render(this.engine);
      this.updateHUD();

      requestAnimationFrame(loop);
    };

    requestAnimationFrame(loop);
  }
}

// Start game when page loads
window.addEventListener('DOMContentLoaded', () => {
  window.app = new App();
});
