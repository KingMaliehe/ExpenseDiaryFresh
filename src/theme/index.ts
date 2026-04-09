// src/theme/index.ts
// Central design system for Expense Diary SA

export const Colors = {
  // Backgrounds
  bg: '#0d1117',
  surface: '#161b22',
  surface2: '#1c2333',
  surface3: '#21262d',

  // Text
  text: '#e6edf3',
  muted: '#8b949e',
  subtle: '#484f58',

  // Brand
  accent: '#d4a843',
  accentDark: '#b8892a',

  // Semantic
  green: '#3fb950',
  red: '#f85149',
  blue: '#58a6ff',
  purple: '#bc8cff',
  orange: '#f0883e',

  // Borders
  border: 'rgba(255,255,255,0.08)',
  border2: 'rgba(255,255,255,0.14)',

  // Category colours
  categories: {
    Housing:          '#58a6ff',
    'Food & Groceries': '#bc8cff',
    Transport:        '#d4a843',
    Utilities:        '#3fb950',
    Entertainment:    '#f0883e',
    Health:           '#ff7b72',
    Education:        '#58a6ff',
    Clothing:         '#bc8cff',
    Savings:          '#3fb950',
    Income:           '#3fb950',
    Other:            '#8b949e',
  } as Record<string, string>,
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 9999,
};

export const Typography = {
  // Font sizes
  xs: 11,
  sm: 12,
  base: 14,
  md: 15,
  lg: 17,
  xl: 20,
  xxl: 24,
  xxxl: 30,

  // Weights
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
};

export const Shadow = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 5,
  },
};
