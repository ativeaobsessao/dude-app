export type MoodKey = 'animado' | 'tranquilo' | 'neutro' | 'ansioso' | 'prabaixo';

export interface MoodMetadata {
  key: MoodKey;
  color: string;
  label: string;
  emoji: string;
  glow: string;
}

export const MOODS: Record<MoodKey, MoodMetadata> = {
  'animado': {
    key: 'animado',
    color: '#FBBF24', // âmbar dourado
    label: 'Animado',
    emoji: '😊',
    glow: 'rgba(251, 191, 36, 0.4)'
  },
  'tranquilo': {
    key: 'tranquilo',
    color: '#6EE7B7', // verde-menta
    label: 'Tranquilo',
    emoji: '😌',
    glow: 'rgba(110, 231, 183, 0.4)'
  },
  'neutro': {
    key: 'neutro',
    color: '#60A5FA', // azul sereno
    label: 'Neutro',
    emoji: '😐',
    glow: 'rgba(96, 165, 250, 0.4)'
  },
  'ansioso': {
    key: 'ansioso',
    color: '#A78BFA', // violeta
    label: 'Ansioso',
    emoji: '😟',
    glow: 'rgba(167, 139, 250, 0.4)'
  },
  'prabaixo': {
    key: 'prabaixo',
    color: '#FB7185', // coral acolhedor
    label: 'Pra baixo',
    emoji: '😔',
    glow: 'rgba(251, 113, 133, 0.4)'
  }
};

export const MOOD_LIST = Object.values(MOODS);
