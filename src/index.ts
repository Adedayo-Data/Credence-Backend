import app from './app.js'
import { createAdminRouter } from './routes/admin/index.js'
import governanceRouter from './routes/governance.js'
import disputesRouter from './routes/disputes.js'
import evidenceRouter from './routes/evidence.js'

app.use('/api/admin', createAdminRouter())
app.use('/api/governance', governanceRouter)
app.use('/api/disputes', disputesRouter)
app.use('/api/evidence', evidenceRouter)

export { app }
export default app
