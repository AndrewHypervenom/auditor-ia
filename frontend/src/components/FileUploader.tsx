// frontend/src/components/FileUploader.tsx

import { useState, useRef } from 'react';
import { Upload, X, FileAudio, Image, Check, AlertCircle } from 'lucide-react';

interface FileUploaderProps {
  type: 'audio' | 'images';
  onFileSelect?: (file: File | null) => void;
  onFilesSelect?: (files: File[]) => void;
  accept: string;
  maxSize: number; // en MB
  multiple?: boolean;
  maxFiles?: number;
}

export default function FileUploader({
  type,
  onFileSelect,
  onFilesSelect,
  accept,
  maxSize,
  multiple = false,
  maxFiles = 1
}: FileUploaderProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const maxSizeBytes = maxSize * 1024 * 1024;

  const validateFile = (file: File): boolean => {
    setError(null);

    // Validar tamaño
    if (file.size > maxSizeBytes) {
      setError(`El archivo es demasiado grande. Máximo: ${maxSize}MB`);
      return false;
    }

    // Validar tipo
    const acceptedTypes = accept.split(',').map(t => t.trim());
    const fileType = file.type;
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    
    const isValidType = acceptedTypes.some(acceptType => {
      if (acceptType.startsWith('.')) {
        return fileExtension === acceptType.toLowerCase();
      }
      return fileType.match(new RegExp(acceptType.replace('*', '.*')));
    });

    if (!isValidType) {
      setError(`Tipo de archivo no válido. Tipos aceptados: ${accept}`);
      return false;
    }

    return true;
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (type === 'audio' && e.dataTransfer.files?.[0]) {
      handleSingleFile(e.dataTransfer.files[0]);
    } else if (type === 'images' && e.dataTransfer.files) {
      handleMultipleFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleSingleFile = (file: File) => {
    if (validateFile(file)) {
      setSelectedFile(file);
      onFileSelect?.(file);
    }
  };

  const handleMultipleFiles = (files: File[]) => {
    setError(null);

    // Validar cantidad de archivos
    const totalFiles = selectedFiles.length + files.length;
    if (totalFiles > maxFiles) {
      setError(`Máximo ${maxFiles} archivos permitidos`);
      return;
    }

    // Validar cada archivo
    const validFiles: File[] = [];
    for (const file of files) {
      if (validateFile(file)) {
        validFiles.push(file);
      } else {
        return; // Si algún archivo es inválido, no agregar ninguno
      }
    }

    const newFiles = [...selectedFiles, ...validFiles];
    setSelectedFiles(newFiles);
    onFilesSelect?.(newFiles);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;

    if (type === 'audio' && e.target.files[0]) {
      handleSingleFile(e.target.files[0]);
    } else if (type === 'images') {
      handleMultipleFiles(Array.from(e.target.files));
    }

    // Reset input
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  const removeFile = () => {
    setSelectedFile(null);
    setError(null);
    onFileSelect?.(null);
  };

  const removeFileFromList = (index: number) => {
    const newFiles = selectedFiles.filter((_, i) => i !== index);
    setSelectedFiles(newFiles);
    onFilesSelect?.(newFiles);
  };

  const removeAllFiles = () => {
    setSelectedFiles([]);
    setError(null);
    onFilesSelect?.([]);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getIcon = () => {
    return type === 'audio' ? FileAudio : Image;
  };

  const getColor = () => {
    return type === 'audio' ? 'blue' : 'purple';
  };

  const Icon = getIcon();
  const color = getColor();

  return (
    <div className="space-y-4">
      <div
        className={`border-2 border-dashed rounded-2xl p-10 text-center transition-all duration-300 cursor-pointer
          ${dragActive 
            ? `border-${color}-500 bg-${color}-500/10 scale-[1.01]` 
            : `border-slate-700 hover:border-${color}-500/50 hover:bg-slate-900/30`
          }
          ${error ? 'border-red-500/50 bg-red-500/5' : ''}
        `}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        {type === 'audio' && selectedFile ? (
          // Vista de archivo de audio seleccionado
          <div className="flex items-center justify-between bg-gradient-to-r from-slate-800 to-slate-900 rounded-xl p-5 border border-green-500/30">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-500/10 rounded-xl border border-green-500/30">
                <FileAudio className="w-8 h-8 text-green-400" />
              </div>
              <div className="text-left">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-white">{selectedFile.name}</p>
                  <span className="badge badge-success">
                    <Check className="w-3 h-3 mr-1" />
                    Listo
                  </span>
                </div>
                <p className="text-sm text-slate-400 mt-1">
                  {formatFileSize(selectedFile.size)}
                </p>
              </div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                removeFile();
              }}
              type="button"
              className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-all duration-200"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        ) : (
          // Vista de zona de drop
          <div className="py-4">
            <div className={`mx-auto w-16 h-16 mb-4 rounded-full bg-${color}-500/10 flex items-center justify-center border-2 border-${color}-500/30`}>
              <Icon className={`w-8 h-8 text-${color}-400`} />
            </div>
            <p className="text-slate-300 mb-2 font-medium">
              {type === 'audio' ? 'Arrastra tu archivo de audio aquí' : 'Arrastra tus imágenes aquí'}
            </p>
            <p className="text-sm text-slate-500 mb-4">
              o haz clic para seleccionar
              {type === 'images' && maxFiles > 1 && ` (máximo ${maxFiles} archivos)`}
            </p>
            <div className={`btn-primary cursor-pointer inline-flex items-center gap-2`}>
              <Upload className="w-4 h-4" />
              {type === 'audio' ? 'Seleccionar Audio' : 'Seleccionar Imágenes'}
            </div>
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleFileInput}
          className="hidden"
        />
      </div>

      {/* Error message */}
      {error && (
        <div className="p-4 bg-red-500/5 border border-red-500/20 rounded-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-400">Error</p>
            <p className="text-xs text-slate-400 mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Vista de imágenes seleccionadas */}
      {type === 'images' && selectedFiles.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="badge badge-success">
                <Check className="w-3 h-3 mr-1" />
                {selectedFiles.length} {selectedFiles.length === 1 ? 'imagen' : 'imágenes'}
              </span>
              <span className="text-sm text-slate-400">
                {formatFileSize(selectedFiles.reduce((acc, file) => acc + file.size, 0))} total
              </span>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeAllFiles();
              }}
              className="text-sm text-red-400 hover:text-red-300 transition-colors flex items-center gap-1"
            >
              <X className="w-4 h-4" />
              Eliminar todas
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {selectedFiles.map((file, index) => (
              <div 
                key={index} 
                className="relative group"
              >
                <div className="relative rounded-xl overflow-hidden border-2 border-slate-700 hover:border-purple-500/50 transition-all duration-300">
                  <img
                    src={URL.createObjectURL(file)}
                    alt={`Preview ${index + 1}`}
                    className="w-full h-40 object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <div className="absolute bottom-0 left-0 right-0 p-3">
                      <p className="text-xs text-white font-medium truncate">
                        {file.name}
                      </p>
                      <p className="text-xs text-slate-300 mt-1">
                        {formatFileSize(file.size)}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFileFromList(index);
                    }}
                    className="absolute top-2 right-2 p-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-200 shadow-lg z-10"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="mt-2 px-1">
                  <p className="text-xs text-slate-400 truncate">
                    Imagen {index + 1}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Warning si no hay imágenes */}
      {type === 'images' && selectedFiles.length === 0 && (
        <div className="p-4 bg-yellow-500/5 border border-yellow-500/20 rounded-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-yellow-400">
              Imágenes requeridas
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Debes subir al menos una captura de pantalla para continuar con la auditoría
            </p>
          </div>
        </div>
      )}
    </div>
  );
}