import { api } from './client'

export interface ChatMessage {
  id: number
  body: string
  /** ISO 8601 timestamp. */
  created_at: string
  user: { id: number; name: string; avatar_url: string | null }
}

export interface MessagePage {
  data: ChatMessage[]
  meta: { has_more: boolean }
}

/** Latest page, or the page just before the message with id `before`. */
export const listMessages = (before?: number) =>
  api<MessagePage>(before === undefined ? '/messages' : `/messages?before=${before}`)

export const sendMessage = (body: string) =>
  api<{ data: ChatMessage }>('/messages', { method: 'POST', json: { body } }).then((response) => response.data)
