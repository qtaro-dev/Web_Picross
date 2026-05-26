import { state } from './state.js';
import { render } from './render.js';
import { initActions } from './actions.js';
state.root = document.getElementById('app');
state.screen = 'title';
state.game = null;
state.modal = null;
const actions = initActions(state);
window.addEventListener('keydown', event => {
  if(event.key !== 'F1' || state.screen !== 'game') return;
  event.preventDefault();
  event.stopPropagation();
  actions.debugInstantClear();
}, true);
actions.initializeAuthFlow();
