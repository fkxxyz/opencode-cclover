export { ApiClient } from "./api"
export { WebSocketClient } from "./websocket"

import { ApiClient } from "./api"
import { WebSocketClient } from "./websocket"

export const apiClient = new ApiClient()
export const wsClient = new WebSocketClient()
