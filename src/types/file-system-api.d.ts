// Type definitions for File System Access API
// These are browser APIs that may not be available in all environments

interface FileSystemEntry {
  readonly isFile: boolean
  readonly isDirectory: boolean
  readonly name: string
  readonly fullPath: string
  readonly filesystem: FileSystem
  getParent(successCallback?: (entry: FileSystemEntry) => void, errorCallback?: (error: Error) => void): void
}

interface FileSystemFileEntry extends FileSystemEntry {
  readonly isFile: true
  readonly isDirectory: false
  file(successCallback: (file: File) => void, errorCallback?: (error: Error) => void): void
}

interface FileSystemDirectoryEntry extends FileSystemEntry {
  readonly isFile: false
  readonly isDirectory: true
  createReader(): FileSystemDirectoryReader
}

interface FileSystemDirectoryReader {
  readEntries(successCallback: (entries: FileSystemEntry[]) => void, errorCallback?: (error: Error) => void): void
}

interface FileSystem {
  readonly name: string
  readonly root: FileSystemDirectoryEntry
}
