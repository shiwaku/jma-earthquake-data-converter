/**
 * get / set / subscribe だけの最小ストア。
 * この規模でフレームワークを入れる必要はないため自前で持つ。
 * set は浅いマージで、値が変わらなければ購読者を呼ばない。
 */
export interface Store<T> {
  get(): T
  set(patch: Partial<T>): void
  subscribe(fn: (state: T, prev: T) => void): () => void
}

export function createStore<T extends object>(initial: T): Store<T> {
  let state = initial
  const subscribers = new Set<(state: T, prev: T) => void>()

  return {
    get: () => state,

    set(patch) {
      const prev = state
      let changed = false
      for (const key of Object.keys(patch) as (keyof T)[]) {
        if (!Object.is(prev[key], patch[key])) {
          changed = true
          break
        }
      }
      if (!changed) return

      state = { ...prev, ...patch }
      for (const fn of subscribers) fn(state, prev)
    },

    subscribe(fn) {
      subscribers.add(fn)
      return () => subscribers.delete(fn)
    },
  }
}
