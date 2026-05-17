export const PLACEHOLDERS = {
  Beginner: './image/thumbs/_placeholders/beginner.png',
  Easy:     './image/thumbs/_placeholders/easy.png',
  Normal:   './image/thumbs/_placeholders/normal.png',
  Hard:     './image/thumbs/_placeholders/hard.png',
  Endless:  './image/thumbs/_placeholders/endless.png',
};
export function solvedThumbPath(mode, id){ return `./image/thumbs/${mode.toLowerCase()}/${id}.png`; }
