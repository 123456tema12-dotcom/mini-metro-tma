/* ==========================================================================
   MINI METRO - City Maps & Level Configurations
   Theme palettes, river water bodies, initial resources, spawn balance
   ========================================================================== */

export const Levels = {
  london: {
    id: 'london',
    name: 'London',
    country: 'United Kingdom',
    desc: 'The classic Underground. Navigate the meandering River Thames.',
    theme: {
      bgDay: '#f4f1ea',
      bgNight: '#202124',
      waterDay: '#bfe3f7',
      waterNight: '#34495e',
      waterOutlineDay: '#87ceeb',
      waterOutlineNight: '#2c3e50',
      stationFill: '#ffffff',
      stationStroke: '#363636',
      lineColors: [
        '#f59e0b', // Yellow (Circle)
        '#ef4444', // Red (Central)
        '#1d4ed8', // Dark Blue (Piccadilly)
        '#06b6d4', // Cyan (Victoria)
        '#10b981', // Green (District)
        '#ec4899', // Pink (Hammersmith)
        '#8b5cf6'  // Purple (Metropolitan)
      ]
    },
    initialLines: 3,
    maxLines: 7,
    initialLocomotives: 3,
    initialCarriages: 0,
    initialBridges: 1,
    initialInterchanges: 0,
    spawnCooldown: 14, // seconds between station spawns
    peepSpawnRate: 1.0,
    rivers: [
      // River Thames meandering from west to east
      [
        { x: -500, y: -40 },
        { x: -320, y: -30 },
        { x: -200, y: 30 },
        { x: -100, y: 70 },
        { x: 0, y: 20 },
        { x: 100, y: -50 },
        { x: 220, y: -30 },
        { x: 300, y: 60 },
        { x: 380, y: 30 },
        { x: 500, y: 50 },
        { x: 500, y: 120 },
        { x: 380, y: 100 },
        { x: 300, y: 130 },
        { x: 210, y: 40 },
        { x: 90, y: 20 },
        { x: 0, y: 90 },
        { x: -100, y: 140 },
        { x: -200, y: 100 },
        { x: -320, y: 40 },
        { x: -500, y: 30 }
      ]
    ],
    initialStations: [
      { x: -140, y: -70, type: 'circle' },
      { x: 60, y: -100, type: 'triangle' },
      { x: -40, y: 160, type: 'square' }
    ]
  },

  paris: {
    id: 'paris',
    name: 'Paris',
    country: 'France',
    desc: 'Dense historic metro hub along the Seine with central river islands.',
    theme: {
      bgDay: '#f7f5ef',
      bgNight: '#1e2022',
      waterDay: '#c8e6f5',
      waterNight: '#2a4358',
      waterOutlineDay: '#7ec0e4',
      waterOutlineNight: '#1f3445',
      stationFill: '#ffffff',
      stationStroke: '#333333',
      lineColors: [
        '#eab308', // Gold
        '#2563eb', // Royal Blue
        '#84cc16', // Lime
        '#d946ef', // Fuchsia
        '#f97316', // Orange
        '#14b8a6', // Teal
        '#6366f1'  // Indigo
      ]
    },
    initialLines: 3,
    maxLines: 7,
    initialLocomotives: 3,
    initialCarriages: 0,
    initialBridges: 2,
    initialInterchanges: 0,
    spawnCooldown: 13,
    peepSpawnRate: 1.15,
    rivers: [
      // River Seine flowing diagonally
      [
        { x: -500, y: -220 },
        { x: -280, y: -160 },
        { x: -120, y: -70 },
        { x: -10, y: 0 },
        { x: 120, y: 60 },
        { x: 280, y: 180 },
        { x: 500, y: 260 },
        { x: 500, y: 330 },
        { x: 270, y: 250 },
        { x: 110, y: 130 },
        { x: -20, y: 70 },
        { x: -130, y: 0 },
        { x: -290, y: -90 },
        { x: -500, y: -150 }
      ]
    ],
    initialStations: [
      { x: -120, y: -140, type: 'circle' },
      { x: 130, y: -60, type: 'triangle' },
      { x: 10, y: 150, type: 'square' }
    ]
  },

  nyc: {
    id: 'nyc',
    name: 'New York City',
    country: 'United States',
    desc: 'Bustling Manhattan peninsula between the Hudson and East rivers.',
    theme: {
      bgDay: '#f2f0e8',
      bgNight: '#1a1d20',
      waterDay: '#aed9f4',
      waterNight: '#21374a',
      waterOutlineDay: '#6cb6e4',
      waterOutlineNight: '#182b3a',
      stationFill: '#ffffff',
      stationStroke: '#222222',
      lineColors: [
        '#dc2626', // Red (1/2/3)
        '#16a34a', // Green (4/5/6)
        '#ea580c', // Orange (B/D/F/M)
        '#2563eb', // Blue (A/C/E)
        '#eab308', // Yellow (N/Q/R/W)
        '#9333ea', // Purple (7)
        '#64748b'  // Grey (L)
      ]
    },
    initialLines: 3,
    maxLines: 7,
    initialLocomotives: 3,
    initialCarriages: 0,
    initialBridges: 2,
    initialInterchanges: 0,
    spawnCooldown: 12,
    peepSpawnRate: 1.25,
    rivers: [
      // Hudson River (West side)
      [
        { x: -500, y: -500 },
        { x: -180, y: -500 },
        { x: -140, y: -100 },
        { x: -120, y: 200 },
        { x: -160, y: 500 },
        { x: -500, y: 500 }
      ],
      // East River (East side)
      [
        { x: 160, y: -500 },
        { x: 500, y: -500 },
        { x: 500, y: 500 },
        { x: 180, y: 500 },
        { x: 130, y: 150 },
        { x: 120, y: -150 }
      ]
    ],
    initialStations: [
      { x: -10, y: -180, type: 'circle' },
      { x: 20, y: 30, type: 'triangle' },
      { x: -20, y: 220, type: 'square' }
    ]
  },

  tokyo: {
    id: 'tokyo',
    name: 'Tokyo',
    country: 'Japan',
    desc: 'High passenger frequency along Tokyo Bay. Fast bullet trains available.',
    theme: {
      bgDay: '#f5f5f0',
      bgNight: '#1f2024',
      waterDay: '#b5e2fa',
      waterNight: '#2a445b',
      waterOutlineDay: '#70bfe6',
      waterOutlineNight: '#1e3243',
      stationFill: '#ffffff',
      stationStroke: '#2d3748',
      lineColors: [
        '#ec4899', // Pink (Asakusa)
        '#0284c7', // Sky Blue (Tozai)
        '#10b981', // Green (Chiyoda)
        '#f59e0b', // Orange (Ginza)
        '#8b5cf6', // Purple (Hanzomon)
        '#ef4444', // Red (Marunouchi)
        '#06b6d4'  // Cyan (Namboku)
      ]
    },
    initialLines: 3,
    maxLines: 7,
    initialLocomotives: 3,
    initialCarriages: 1,
    initialBridges: 1,
    initialInterchanges: 0,
    spawnCooldown: 11,
    peepSpawnRate: 1.35,
    trainSpeedMultiplier: 1.25,
    rivers: [
      // Tokyo Bay coast in the South/East
      [
        { x: 60, y: 500 },
        { x: 100, y: 240 },
        { x: 220, y: 140 },
        { x: 380, y: 80 },
        { x: 500, y: 60 },
        { x: 500, y: 500 }
      ]
    ],
    initialStations: [
      { x: -150, y: -80, type: 'circle' },
      { x: 20, y: -40, type: 'triangle' },
      { x: -60, y: 140, type: 'square' }
    ]
  },

  stpetersburg: {
    id: 'stpetersburg',
    name: 'Saint Petersburg',
    country: 'Russia',
    desc: 'The Venice of the North. Many canals and islands across the River Neva.',
    theme: {
      bgDay: '#f4f2eb',
      bgNight: '#1b1d20',
      waterDay: '#bcdcf0',
      waterNight: '#263d50',
      waterOutlineDay: '#75b5dc',
      waterOutlineNight: '#1a2c3a',
      stationFill: '#ffffff',
      stationStroke: '#262626',
      lineColors: [
        '#dc2626', // Red (Kirovsko-Vyborgskaya)
        '#2563eb', // Blue (Moskovsko-Petrogradskaya)
        '#16a34a', // Green (Nevsko-Vasileostrovskaya)
        '#ea580c', // Orange (Pravoberezhnaya)
        '#9333ea', // Violet (Frunzensko-Primorskaya)
        '#eab308', // Yellow
        '#06b6d4'  // Cyan
      ]
    },
    initialLines: 3,
    maxLines: 7,
    initialLocomotives: 3,
    initialCarriages: 0,
    initialBridges: 3,
    initialInterchanges: 0,
    spawnCooldown: 13,
    peepSpawnRate: 1.1,
    rivers: [
      // Main Neva split
      [
        { x: -500, y: 100 },
        { x: -180, y: 80 },
        { x: -40, y: 20 },
        { x: 100, y: -60 },
        { x: 300, y: -180 },
        { x: 500, y: -220 },
        { x: 500, y: -150 },
        { x: 310, y: -110 },
        { x: 120, y: 10 },
        { x: -20, y: 90 },
        { x: -170, y: 150 },
        { x: -500, y: 170 }
      ],
      // Malaya Neva branch
      [
        { x: -500, y: -160 },
        { x: -260, y: -120 },
        { x: -100, y: -80 },
        { x: -40, y: 20 },
        { x: -90, y: 0 },
        { x: -240, y: -50 },
        { x: -500, y: -90 }
      ]
    ],
    initialStations: [
      { x: -160, y: -30, type: 'circle' },
      { x: 120, y: -140, type: 'triangle' },
      { x: 20, y: 160, type: 'square' }
    ]
  }
};
