/* ==========================================================================
   MINI METRO - City Maps & Level Configurations
   Authentic river geometries, city palettes, crossing styles, initial resources
   ========================================================================== */

export const Levels = {
  london: {
    id: 'london',
    name: 'London',
    country: 'United Kingdom',
    desc: 'The birthplace of underground transit. Navigate the winding River Thames with limited tunnels.',
    crossingStyle: 'tunnel', // 'tunnel' = dashed lines, 'bridge' = bridge tracks
    theme: {
      bgDay: '#f4f1ea',
      bgNight: '#212226',
      waterDay: '#b8e2f8',
      waterNight: '#2c4558',
      waterOutlineDay: '#7ec4e8',
      waterOutlineNight: '#203444',
      stationFill: '#ffffff',
      stationStroke: '#383838',
      lineColors: [
        '#f59e0b', // Yellow (Circle)
        '#ef4444', // Red (Central)
        '#1d4ed8', // Dark Blue (Piccadilly)
        '#06b6d4', // Light Cyan (Victoria)
        '#10b981', // Green (District)
        '#ec4899', // Pink (Hammersmith)
        '#8b5cf6'  // Purple (Metropolitan)
      ]
    },
    initialLines: 3,
    maxLines: 7,
    initialLocomotives: 3,
    initialCarriages: 0,
    initialBridges: 1, // Tunnels in London
    initialInterchanges: 0,
    spawnCooldown: 14.0,
    peepSpawnRate: 1.0,
    rivers: [
      // River Thames meandering from west to east with iconic loops
      [
        { x: -500, y: -40 },
        { x: -360, y: -35 },
        { x: -240, y: 15 },
        { x: -160, y: 55 },
        { x: -70, y: 35 },
        { x: 30, y: -45 },
        { x: 140, y: -50 },
        { x: 230, y: 10 },
        { x: 290, y: 70 },
        { x: 370, y: 30 },
        { x: 500, y: 45 },
        { x: 500, y: 115 },
        { x: 370, y: 95 },
        { x: 280, y: 135 },
        { x: 215, y: 75 },
        { x: 135, y: 15 },
        { x: 35, y: 20 },
        { x: -65, y: 100 },
        { x: -160, y: 120 },
        { x: -245, y: 75 },
        { x: -360, y: 30 },
        { x: -500, y: 25 }
      ]
    ],
    initialStations: [
      { x: -130, y: -80, type: 'circle' },
      { x: 70, y: -90, type: 'triangle' },
      { x: -30, y: 160, type: 'square' }
    ]
  },

  paris: {
    id: 'paris',
    name: 'Paris',
    country: 'France',
    desc: 'Dense historic subway network along the Seine with central river islands.',
    crossingStyle: 'bridge',
    theme: {
      bgDay: '#f7f5ee',
      bgNight: '#1f2124',
      waterDay: '#c2e7f8',
      waterNight: '#2a445a',
      waterOutlineDay: '#78c2e6',
      waterOutlineNight: '#1f3344',
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
    spawnCooldown: 13.0,
    peepSpawnRate: 1.15,
    rivers: [
      // River Seine flowing diagonally through Paris
      [
        { x: -500, y: -240 },
        { x: -300, y: -180 },
        { x: -150, y: -90 },
        { x: -30, y: -20 },
        { x: 100, y: 40 },
        { x: 260, y: 160 },
        { x: 500, y: 260 },
        { x: 500, y: 335 },
        { x: 250, y: 235 },
        { x: 90, y: 110 },
        { x: -40, y: 50 },
        { x: -160, y: -20 },
        { x: -310, y: -110 },
        { x: -500, y: -170 }
      ]
    ],
    initialStations: [
      { x: -120, y: -140, type: 'circle' },
      { x: 130, y: -70, type: 'triangle' },
      { x: 0, y: 140, type: 'square' }
    ]
  },

  nyc: {
    id: 'nyc',
    name: 'New York City',
    country: 'United States',
    desc: 'The iconic Manhattan spine surrounded by the Hudson and East rivers.',
    crossingStyle: 'bridge',
    theme: {
      bgDay: '#f2f0e8',
      bgNight: '#1c1e22',
      waterDay: '#afd7f2',
      waterNight: '#243a4e',
      waterOutlineDay: '#6ab8e6',
      waterOutlineNight: '#1a2c3d',
      stationFill: '#ffffff',
      stationStroke: '#262626',
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
    spawnCooldown: 12.0,
    peepSpawnRate: 1.25,
    rivers: [
      // Hudson River on the West
      [
        { x: -500, y: -500 },
        { x: -190, y: -500 },
        { x: -150, y: -150 },
        { x: -130, y: 180 },
        { x: -170, y: 500 },
        { x: -500, y: 500 }
      ],
      // East River on the East
      [
        { x: 170, y: -500 },
        { x: 500, y: -500 },
        { x: 500, y: 500 },
        { x: 190, y: 500 },
        { x: 140, y: 160 },
        { x: 130, y: -160 }
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
    desc: 'Rapid transit on Tokyo Bay. High passenger density with Shinkansen bullet train speed.',
    crossingStyle: 'bridge',
    theme: {
      bgDay: '#f5f5f0',
      bgNight: '#202125',
      waterDay: '#b2e0f8',
      waterNight: '#2a4258',
      waterOutlineDay: '#6ebdE2',
      waterOutlineNight: '#1e3142',
      stationFill: '#ffffff',
      stationStroke: '#333333',
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
    spawnCooldown: 11.0,
    peepSpawnRate: 1.35,
    trainSpeedMultiplier: 1.3, // Shinkansen high speed
    rivers: [
      // Tokyo Bay coast in South/East
      [
        { x: 50, y: 500 },
        { x: 90, y: 260 },
        { x: 200, y: 160 },
        { x: 360, y: 90 },
        { x: 500, y: 70 },
        { x: 500, y: 500 }
      ]
    ],
    initialStations: [
      { x: -140, y: -80, type: 'circle' },
      { x: 20, y: -40, type: 'triangle' },
      { x: -50, y: 140, type: 'square' }
    ]
  },

  stpetersburg: {
    id: 'stpetersburg',
    name: 'Saint Petersburg',
    country: 'Russia',
    desc: 'The Venice of the North. Multiple river branches and islands across the Neva delta.',
    crossingStyle: 'bridge',
    theme: {
      bgDay: '#f4f2eb',
      bgNight: '#1c1e22',
      waterDay: '#b5dcf4',
      waterNight: '#263d50',
      waterOutlineDay: '#72b6de',
      waterOutlineNight: '#1a2c3a',
      stationFill: '#ffffff',
      stationStroke: '#2d2d2d',
      lineColors: [
        '#dc2626', // Red (Line 1)
        '#2563eb', // Blue (Line 2)
        '#16a34a', // Green (Line 3)
        '#ea580c', // Orange (Line 4)
        '#9333ea', // Violet (Line 5)
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
    spawnCooldown: 13.0,
    peepSpawnRate: 1.1,
    rivers: [
      // Bolshaya Neva
      [
        { x: -500, y: 110 },
        { x: -200, y: 90 },
        { x: -50, y: 30 },
        { x: 90, y: -50 },
        { x: 300, y: -170 },
        { x: 500, y: -210 },
        { x: 500, y: -140 },
        { x: 310, y: -100 },
        { x: 110, y: 15 },
        { x: -30, y: 95 },
        { x: -180, y: 155 },
        { x: -500, y: 175 }
      ],
      // Malaya Neva
      [
        { x: -500, y: -170 },
        { x: -270, y: -130 },
        { x: -110, y: -90 },
        { x: -50, y: 30 },
        { x: -100, y: 0 },
        { x: -250, y: -60 },
        { x: -500, y: -100 }
      ]
    ],
    initialStations: [
      { x: -160, y: -30, type: 'circle' },
      { x: 120, y: -130, type: 'triangle' },
      { x: 20, y: 160, type: 'square' }
    ]
  }
};
