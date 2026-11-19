import { api } from './client'

export interface HealthResponse {
  status: 'ok'
  app: string
  database: string
  time: string
}

export const getHealth = () => api<HealthResponse>('/health')
