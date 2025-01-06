# PDF to Excel Converter

A web application for extracting selected areas from PDF documents and converting them to Excel format. Built with React and integrated with a Python backend.

## Features

- Upload and view PDF documents
- Interactive area selection for text extraction
- Export selected content to Excel format
- Temporary file storage with automatic cleanup
- Modern UI with responsive design

## Project Structure

This project combines a React frontend with a Python backend:

### Frontend (React + TypeScript + Vite)

The frontend provides a modern web interface for PDF processing:

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run development server:
   ```bash
   npm run dev
   ```

### Backend (Python)

The backend handles data processing and storage:

1. Install requirements:
   ```bash
   pip install -r requirements.txt
   ```

2. Run the app:
   ```bash
   streamlit run streamlit_app.py
   ```

## Development

For frontend development, see the [Vite documentation](https://vitejs.dev/guide/) for more information about the build setup.

### ESLint Configuration

The project uses ESLint with TypeScript support. To enable type-aware lint rules:

```js
export default tseslint.config({
  languageOptions: {
    parserOptions: {
      project: ['./tsconfig.node.json', './tsconfig.app.json'],
      tsconfigRootDir: import.meta.dirname,
    },
  },
})
```

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request
