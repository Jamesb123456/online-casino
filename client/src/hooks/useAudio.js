// Re-export the useAudio hook from the AudioContext so callers can `import
// { useAudio } from '@/hooks/useAudio'` if they prefer hook-style imports.
export { useAudio } from '../contexts/AudioContext';
export { SFX } from '../lib/audio';
