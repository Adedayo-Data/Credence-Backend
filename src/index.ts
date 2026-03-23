import app from './app.js'
import { createAdminRouter } from './routes/admin/index.js'

// Admin management endpoints
app.use('/api/admin', createAdminRouter())

export default app
