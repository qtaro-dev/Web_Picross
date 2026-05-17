export const state = {
  root: null,
  screen: 'title',
  mode: 'Beginner',
  page: 1,
  filled: new Set(),
  cellColors: new Map(),
  selectedColor: '1',
  crossed: new Set(),
  drag: { active:false, mode:null, start:null, moved:false },
  timer: { limit:null, remaining:null, running:false, intervalId:null, expired:false },
  modal: null,
  game: null,
  solved: { Beginner:new Set(), Easy:new Set(), Normal:new Set(), Hard:new Set(), Endless:new Set() },
  error: ''
};
