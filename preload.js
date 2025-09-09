const { contextBridge, ipcRenderer } = require('electron')

console.log('Preload script loaded')

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('llmApi', {
  // OAuth
  oauthRequest: (request) => ipcRenderer.invoke('oauth-request', request),
  
  // LLM
  llmRequest: (request) => ipcRenderer.invoke('llm-request', request),
  
  // HTTP
  httpRequest: (request) => ipcRenderer.invoke('http-request', request),
  
  // Keychain
  storeToken: (data) => ipcRenderer.invoke('store-token', data),
  getToken: (data) => ipcRenderer.invoke('get-token', data),
  deleteToken: (data) => ipcRenderer.invoke('delete-token', data),
  
  // Config
  loadConfig: () => ipcRenderer.invoke('load-config')
})

console.log('llmApi exposed to window')
