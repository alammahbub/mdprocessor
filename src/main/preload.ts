import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  openFile: () => ipcRenderer.invoke('file:open'),
  saveFile: (payload: { filePath: string | null; content: string }) => 
    ipcRenderer.invoke('file:save', payload),
  autoSave: (payload: { content: string; fileName: string | null }) => 
    ipcRenderer.invoke('file:autosave', payload),
  checkRecovery: (payload: { fileName: string | null }) => 
    ipcRenderer.invoke('file:check-recovery', payload),
  clearRecovery: (payload: { fileName: string | null }) => 
    ipcRenderer.invoke('file:clear-recovery', payload),
  exportPDF: (payload: { htmlContent: string; filePath?: string | null }) => 
    ipcRenderer.invoke('file:export-pdf', payload),
  exportDOCX: (payload: { htmlContent: string; filePath?: string | null }) => 
    ipcRenderer.invoke('file:export-docx', payload),
  onSpellingSuggestions: (callback: (data: { suggestions: string[]; misspelledWord: string; x: number; y: number }) => void) => {
    const handler = (_event: any, data: any) => callback(data)
    ipcRenderer.on('show-spelling-suggestions', handler)
    return () => {
      ipcRenderer.removeListener('show-spelling-suggestions', handler)
    }
  }
})
