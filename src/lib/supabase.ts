// Temporary in-memory storage implementation
const tempStorage: { [key: string]: File } = {}

export const storePdfTemporarily = async (file: File): Promise<string> => {
  const path = `temp_${Date.now()}_${file.name}`
  tempStorage[path] = file
  return path
}

export const cleanupStorage = async () => {
  Object.keys(tempStorage).forEach(key => {
    delete tempStorage[key]
  })
  console.log('Temporary storage cleared')
}
