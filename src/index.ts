import express from 'express'
import { loadConfig } from './config/index.js'
import { createHealthRouter } from './routes/health.js'
import { createDefaultProbes } from './services/health/probes.js'
import bulkRouter from './routes/bulk.js'

const config = loadConfig()
const app = express()

app.use(express.json())

const healthProbes = createDefaultProbes()
app.use('/api/health', createHealthRouter(healthProbes))

// Bulk verification endpoint (Enterprise)
app.use('/api/bulk', bulkRouter)

app.get('/api/trust/:address', (req, res) => {
  const { address } = req.params
  // Placeholder: in production, fetch from DB / reputation engine
  res.json({
    address,
    score: 0,
    bondedAmount: '0',
    bondStart: null,
    attestationCount: 0,
  })
})

app.get('/api/bond/:address', (req, res) => {
  const { address } = req.params
  res.json({
    address,
    bondedAmount: '0',
    bondStart: null,
    bondDuration: null,
    active: false,
  })
})

// Only start server if not in test environment
if (process.env.NODE_ENV !== 'test') {
  app.listen(config.port, () => {
    console.log(`Credence API listening on http://localhost:${config.port}`)
  })
}

export default app
