export function loadConfig(env) {
  const port = Number(env.PORT || 8080)
  if (!Number.isInteger(port) || port <= 0) throw new Error('PORT must be a positive integer')
  return { port, gatewayUrl: env.GATEWAY_URL || 'https://gateway.example', batchSize: Number(env.BATCH_SIZE || 25) }
}
