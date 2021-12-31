export function documentReady(_passThrough?: any) {
  if (document.readyState === 'loading') {
    return new Promise((resolve) => {
      document.addEventListener('DOMContentLoaded', () => resolve(_passThrough))
    })
  }

  return Promise.resolve(_passThrough)
}
