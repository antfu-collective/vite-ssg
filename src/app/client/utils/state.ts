export function deserializeState(state: string) {
  try {
    return JSON.parse(state || '{}')
  }
  catch (error) {
    console.error('[SSG] On state deserialization -', error, state)
    return {}
  }
}
