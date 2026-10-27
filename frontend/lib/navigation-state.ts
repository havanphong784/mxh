export interface NavigationState {
  paths: string[];
  index: number;
}

export function createNavigationState(path: string): NavigationState {
  return { paths: [path], index: 0 };
}

export function transitionNavigation(state: NavigationState, path: string, kind: 'push' | 'pop'): NavigationState {
  if (state.paths[state.index] === path) return state;
  if (kind === 'push') return { paths: [...state.paths.slice(0, state.index + 1), path], index: state.index + 1 };

  for (let index = state.index - 1; index >= 0; index--) {
    if (state.paths[index] === path) return { ...state, index };
  }
  for (let index = state.index + 1; index < state.paths.length; index++) {
    if (state.paths[index] === path) return { ...state, index };
  }
  return createNavigationState(path);
}

export function getBackDestination(state: NavigationState): string | null {
  return state.index > 0 ? state.paths[state.index - 1] : null;
}
