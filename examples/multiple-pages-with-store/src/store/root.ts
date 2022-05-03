import { defineStore } from 'pinia'

interface RootState {
  user: Record<string, any> | null
}

export const useRootStore = defineStore({
  id: 'root',
  state: (): RootState => ({
    user: null,
  }),
  getters: {
    isReady(state) {
      return !!state.user
    },
  },
  actions: {
    initialize() {
      if (this.isReady)
        return

      // eslint-disable-next-line no-console
      console.log('Initialize user ...')
      this.user = {
        id: 1,
        firstName: 'Jane',
        lastName: 'Doe',
      }
    },
  },
})
