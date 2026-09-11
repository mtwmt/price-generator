const dependencies = new Map<unknown, unknown>();

jest.mock('@angular/core', () => ({
  computed: <T>(compute: () => T) => compute,
  inject: (token: unknown) => dependencies.get(token),
}));

jest.mock('@ngrx/signals', () => {
  const withState = (state: Record<string, unknown>) => ({ type: 'state', state });
  const withComputed = (factory: unknown) => ({ type: 'computed', factory });
  const withMethods = (factory: unknown) => ({ type: 'methods', factory });

  const signalStore = (...features: Array<Record<string, unknown>>) =>
    class FakeCommentsStore {
      constructor() {
        const stateFeature = features.find((feature) => feature['type'] === 'state')!;
        const state = stateFeature['state'] as Record<string, unknown>;
        Object.entries(state).forEach(([key, initialValue]) => {
          let value = initialValue;
          const stateSignal = (() => value) as (() => unknown) & {
            set(next: unknown): void;
          };
          stateSignal.set = (next) => {
            value = next;
          };
          Object.assign(this, { [key]: stateSignal });
        });

        const methodsFeature = features.find(
          (feature) => feature['type'] === 'methods'
        )!;
        Object.assign(
          this,
          (methodsFeature['factory'] as (store: unknown) => unknown)(this)
        );
      }
    };

  const patchState = (
    store: Record<string, { set(value: unknown): void }>,
    patch: Record<string, unknown>
  ) => {
    Object.entries(patch).forEach(([key, value]) => store[key].set(value));
  };

  return { patchState, signalStore, withComputed, withMethods, withState };
});

jest.mock('@ngrx/signals/rxjs-interop', () => {
  const { Subject } = jest.requireActual<typeof import('rxjs')>('rxjs');
  return {
    rxMethod: (operator: (source: import('rxjs').Observable<unknown>) => import('rxjs').Observable<unknown>) => {
      const input = new Subject<unknown>();
      input.pipe(operator).subscribe();
      return (value: unknown) => input.next(value);
    },
  };
});

jest.mock('@ngrx/operators', () => {
  const { EMPTY, catchError, tap } = jest.requireActual<typeof import('rxjs')>('rxjs');
  return {
    tapResponse: ({ next, error }: { next: (value: unknown) => void; error: (reason: unknown) => void }) =>
      (source: import('rxjs').Observable<unknown>) =>
        source.pipe(tap({ next, error }), catchError(() => EMPTY)),
  };
});

jest.mock('@app/core/services/auth.service', () => ({
  AuthService: class AuthService {},
}), { virtual: true });

jest.mock('./comments.service', () => ({
  CommentsService: class CommentsService {},
}));

import { AuthService } from '@app/core/services/auth.service';
import { throwError } from 'rxjs';
import { CommentsStore } from './comments.store';
import { CommentsService } from './comments.service';

type StoreUnderTest = {
  error: () => string | null;
  loading: () => boolean;
  loadComments(pagePath: string): void;
};

function createStore(fetchComments: jest.Mock): StoreUnderTest {
  dependencies.clear();
  dependencies.set(CommentsService, { fetchComments });
  dependencies.set(AuthService, { currentUser: () => null });
  return new (CommentsStore as unknown as new () => StoreUnderTest)();
}

describe('CommentsStore 留言載入', () => {
  it('逾時錯誤時解除 loading 並保留可顯示的錯誤訊息', () => {
    const store = createStore(
      jest.fn(() => throwError(() => new Error('留言載入逾時，請檢查網路後再重試')))
    );

    store.loadComments('/price-generator/');

    expect(store.loading()).toBe(false);
    expect(store.error()).toBe('留言載入逾時，請檢查網路後再重試');
  });
});
