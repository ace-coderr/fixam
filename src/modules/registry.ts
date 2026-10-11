import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

/**
 * Every Fixam module is a route. Adding one means adding an entry here and a
 * folder under `src/modules/`; the shell needs no changes.
 *
 * Planned: Fit (/fit), Frame (/frame), Houseboy (/houseboy), Owambe (/owambe).
 */

export interface FixamModule {
  id: string;
  path: string;
  title: string;
  screen: LazyExoticComponent<ComponentType>;
}

export const modules: FixamModule[] = [
  {
    id: 'arrange',
    path: '/arrange',
    title: 'Arrange',
    screen: lazy(() => import('./arrange/ArrangeScreen')),
  },
];

export const defaultModule = modules[0] as FixamModule;

export function moduleFor(path: string): FixamModule | undefined {
  return modules.find((m) => path === m.path || path.startsWith(`${m.path}/`));
}
