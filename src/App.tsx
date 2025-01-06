import { useState, useRef, useEffect } from 'react'
import { Upload, FileDown, Loader2 } from 'lucide-react'
import { Button } from './components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card'
import { storePdfTemporarily, cleanupStorage } from './lib/supabase'
import { Document, Page, pdfjs } from 'react-pdf'
import * as XLSX from 'xlsx'
import { useToast } from './hooks/use-toast'
import { Toaster } from './components/ui/toaster'
import 'react-pdf/dist/esm/Page/AnnotationLayer.css'
import 'react-pdf/dist/esm/Page/TextLayer.css'

// Initialize PDF.js worker
console.log('Setting up PDF.js worker...');
try {
  // Use local worker file from node_modules
  const workerUrl = new URL('pdfjs-dist/build/pdf.worker.min.js', import.meta.url);
  console.log('Using PDF.js worker URL:', workerUrl.toString());
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl.toString();
  console.log('PDF.js worker configured successfully');
} catch (error) {
  console.error('Error configuring PDF.js worker:', error);
}

function App() {
  // Initialize cleanup on component mount
  useEffect(() => {
    // Clean up any existing temporary files
    cleanupStorage()
    
    // Set up cleanup on window close
    const handleBeforeUnload = () => {
      cleanupStorage()
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      cleanupStorage()
    }
  }, [])
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [numPages, setNumPages] = useState<number>(0)
  const [currentPage, setCurrentPage] = useState<number>(1)
  const scale = 1.0
  const [selection, setSelection] = useState<{ x: number; y: number; width: number; height: number } | null>(null)
  const [isSelecting, setIsSelecting] = useState(false)
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null)
  const [isExporting, setIsExporting] = useState(false)
  const canvasRef = useRef<HTMLDivElement>(null)
  const { toast } = useToast()

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    console.log('File upload triggered')
    const file = event.target.files?.[0]
    console.log('Selected file:', file)
    
    if (!file) {
      console.log('No file selected')
      return
    }
    
    if (file.type !== 'application/pdf') {
      console.log('Invalid file type:', file.type)
      toast({
        title: "Invalid file type",
        description: "Please select a PDF file.",
        variant: "destructive"
      })
      return
    }
    
    try {
      console.log('Loading PDF file:', file.name)
      await storePdfTemporarily(file)  // Store in temporary storage
      
      // Create object URL and attempt to load PDF
      const fileUrl = URL.createObjectURL(file)
      console.log('Created object URL:', fileUrl)
      
      const loadingTask = pdfjs.getDocument(fileUrl)
      console.log('PDF loading task created')
      
      try {
        const pdf = await loadingTask.promise
        console.log('PDF loaded successfully:', pdf.numPages, 'pages')
        setPdfFile(file)
        setSelection(null)
        toast({
          title: "Success",
          description: "PDF file loaded successfully.",
        })
      } catch (error: unknown) {
        const pdfError = error as { message?: string }
        console.error('PDF loading error:', error)
        toast({
          title: "Error",
          description: `Failed to load PDF: ${pdfError.message || 'Unknown error'}`,
          variant: "destructive"
        })
      }
    } catch (error) {
      console.error('Error handling file:', error)
      toast({
        title: "Error",
        description: "Failed to handle the PDF file. Please try again.",
        variant: "destructive"
      })
    }
  }

  const handleDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages)
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!canvasRef.current) return
    const rect = canvasRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    setStartPoint({ x, y })
    setIsSelecting(true)
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isSelecting || !startPoint || !canvasRef.current) return
    const rect = canvasRef.current.getBoundingClientRect()
    const currentX = e.clientX - rect.left
    const currentY = e.clientY - rect.top

    setSelection({
      x: Math.min(startPoint.x, currentX),
      y: Math.min(startPoint.y, currentY),
      width: Math.abs(currentX - startPoint.x),
      height: Math.abs(currentY - startPoint.y)
    })
  }

  const handleMouseUp = () => {
    setIsSelecting(false)
    setStartPoint(null)
  }

  const extractTextFromPdf = async () => {
    if (!pdfFile || !selection) return

    setIsExporting(true)
    try {
      // Load the PDF document using pdf.js
      const loadingTask = pdfjs.getDocument(URL.createObjectURL(pdfFile))
      const pdf = await loadingTask.promise
      const page = await pdf.getPage(currentPage)
      
      // Get the text content
      const textContent = await page.getTextContent()
      const pageRect = await page.getViewport({ scale: 1.0 })
      
      // Filter text items that fall within the selected area
      const selectedItems = textContent.items
        .filter((item: any) => {
          const { x, y, width, height } = selection
          const normalizedX = x / canvasRef.current!.clientWidth * pageRect.width
          const normalizedY = (canvasRef.current!.clientHeight - y) / canvasRef.current!.clientHeight * pageRect.height
          const normalizedWidth = width / canvasRef.current!.clientWidth * pageRect.width
          const normalizedHeight = height / canvasRef.current!.clientHeight * pageRect.height
          
          const itemX = item.transform[4]
          const itemY = pageRect.height - item.transform[5]
          
          return (
            itemX >= normalizedX &&
            itemX <= normalizedX + normalizedWidth &&
            itemY >= normalizedY &&
            itemY <= normalizedY + normalizedHeight
          )
        })
        .map((item: any) => item.str)
        .filter(Boolean)

      if (selectedItems.length === 0) {
        toast({
          title: "No text found",
          description: "No text was found in the selected area. Try selecting a different area.",
          variant: "destructive"
        })
        return
      }

      // Convert text to table format with improved structure
      const tableData: string[][] = selectedItems.reduce((acc: string[][], text: string) => {
        const words = text.trim().split(/\s+/)
        
        // If the text seems to be a header (all caps, contains specific keywords, etc.)
        const isHeader = text.toUpperCase() === text && text.length > 3
        
        // If it's a header or the last row was full, start a new row
        if (isHeader || (acc.length > 0 && acc[acc.length - 1].length >= 5)) {
          acc.push(words)
        } else if (acc.length > 0) {
          // Add to the current row if it's not full
          acc[acc.length - 1].push(...words)
        } else {
          // Start the first row
          acc.push(words)
        }
        
        return acc
      }, [])

      // Validate table structure
      if (tableData.length === 0) {
        toast({
          title: "Invalid table structure",
          description: "Could not create a valid table from the selected content. Please select a different area.",
          variant: "destructive"
        })
        return
      }

      // Normalize table structure (ensure all rows have the same number of columns)
      const maxColumns = Math.max(...tableData.map((row: string[]) => row.length))
      const normalizedData = tableData.map((row: string[]) => {
        const newRow = [...row]
        while (newRow.length < maxColumns) {
          newRow.push("") // Pad shorter rows with empty strings
        }
        return newRow
      })
      
      // Create Excel file with formatting
      const ws = XLSX.utils.aoa_to_sheet(normalizedData)
      const wb = XLSX.utils.book_new()
      
      // Add some basic styling
      const range = XLSX.utils.decode_range(ws['!ref'] || 'A1')
      for (let R = range.s.r; R <= range.e.r; ++R) {
        for (let C = range.s.c; C <= range.e.c; ++C) {
          const cell_address = XLSX.utils.encode_cell({ r: R, c: C })
          if (!ws[cell_address]) continue
          
          // Style headers (first row)
          if (R === 0) {
            ws[cell_address].s = {
              font: { bold: true },
              fill: { fgColor: { rgb: "EEEEEE" } }
            }
          }
        }
      }
      
      XLSX.utils.book_append_sheet(wb, ws, 'Extracted Data')
      
      // Generate and download Excel file
      XLSX.writeFile(wb, 'extracted_data.xlsx')
      
      toast({
        title: "Export successful",
        description: "The selected content has been exported to Excel.",
      })
    } catch (error) {
      console.error('Error extracting text:', error)
      toast({
        title: "Export failed",
        description: "An error occurred while exporting the content. Please try again.",
        variant: "destructive"
      })
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <>
      <div className="min-h-screen bg-gray-100 p-8">
        <div className="max-w-6xl mx-auto">
        <Card className="mb-4">
          <CardHeader>
            <CardTitle>PDF to Excel Converter</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-300 rounded-lg">
              <Upload className="w-12 h-12 text-gray-400 mb-4" />
              <label htmlFor="pdf-upload">
                <Button variant="outline">
                  Choose PDF File
                </Button>
              </label>
              <input
                id="pdf-upload"
                type="file"
                accept=".pdf"
                onChange={handleFileUpload}
                style={{ opacity: 1, position: 'static', marginTop: '10px' }}
              />
              {pdfFile && (
                <p className="mt-4 text-sm text-gray-600">
                  Selected file: {pdfFile.name}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {pdfFile && (
          <Card>
            <CardContent className="p-4">
              <div 
                ref={canvasRef}
                className="relative border border-gray-200 rounded-lg"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              >
                <Document
                  file={URL.createObjectURL(pdfFile)}
                  onLoadSuccess={handleDocumentLoadSuccess}
                  className="max-w-full"
                >
                  <Page
                    pageNumber={currentPage}
                    scale={scale}
                    className="max-w-full"
                    renderTextLayer={true}
                    renderAnnotationLayer={true}
                  />
                </Document>
                {selection && (
                  <div
                    className="absolute border-2 border-blue-500 bg-blue-200 bg-opacity-20"
                    style={{
                      left: selection.x,
                      top: selection.y,
                      width: selection.width,
                      height: selection.height,
                    }}
                  />
                )}
              </div>
              <div className="flex flex-col gap-4 mt-4">
                <div className="flex justify-between items-center">
                  <Button
                    variant="outline"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage <= 1}
                  >
                    Previous
                  </Button>
                  <span className="text-sm">
                    Page {currentPage} of {numPages}
                  </span>
                  <Button
                    variant="outline"
                    onClick={() => setCurrentPage(p => Math.min(numPages, p + 1))}
                    disabled={currentPage >= numPages}
                  >
                    Next
                  </Button>
                </div>
                {selection && (
                  <div className="flex justify-center">
                    <Button
                      onClick={extractTextFromPdf}
                      className="bg-green-500 hover:bg-green-600 text-white"
                      disabled={isExporting}
                    >
                      {isExporting ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <FileDown className="mr-2 h-4 w-4" />
                      )}
                      {isExporting ? 'Exporting...' : 'Export to Excel'}
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
      </div>
      <Toaster />
    </>
  )
}

export default App
