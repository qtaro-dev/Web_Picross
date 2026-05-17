import { state } from './state.js';
import { render } from './render.js';
import { initActions } from './actions.js';
state.root = document.getElementById('app'); const actions = initActions(state); actions.goto('title');