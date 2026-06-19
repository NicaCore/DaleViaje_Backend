const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Crear directorios si no existen
const createDirectories = () => {
  const dirs = [
    'uploads/profiles',
    'uploads/vehicles',
    'uploads/licenses',
    'uploads/ids',
    'uploads/businesses',
    'uploads/receipts',
    'uploads/chat'
  ];

  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
};

createDirectories();

// Configuración de almacenamiento
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let folder = 'uploads/';
    if (file.fieldname === 'profilePhoto') folder = 'uploads/profiles/';
    else if (file.fieldname === 'vehiclePhoto') folder = 'uploads/vehicles/';
    else if (file.fieldname === 'licensePhoto') folder = 'uploads/licenses/';
    else if (file.fieldname === 'cedulaPhoto') folder = 'uploads/ids/';
    else if (file.fieldname === 'businessPhoto') folder = 'uploads/businesses/';
    else if (file.fieldname === 'paymentReceipt') folder = 'uploads/receipts/';
    else if (file.fieldname === 'chatImage') folder = 'uploads/chat/';
    else if (file.fieldname === 'catalogImage') folder = 'uploads/businesses/';
    cb(null, folder);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

// Filtro de archivos
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Tipo de archivo no permitido. Solo imágenes JPG, PNG, GIF y WEBP'), false);
  }
};

// Configuración de multer
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  },
  fileFilter: fileFilter
});

// Middlewares específicos
const uploadProfile = upload.single('profilePhoto');
const uploadVehicle = upload.single('vehiclePhoto');
const uploadLicense = upload.single('licensePhoto');
const uploadCedula = upload.single('cedulaPhoto');
const uploadBusinessPhoto = upload.single('businessPhoto');
const uploadReceipt = upload.single('paymentReceipt');
const uploadChatImage = upload.array('chatImage', 2);
const uploadCatalogImages = upload.array('catalogImages', 4);

// Middleware para manejar errores de subida
const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'FILE_TOO_LARGE') {
      return res.status(400).json({
        success: false,
        message: 'El archivo es demasiado grande. Máximo 5MB'
      });
    }
    return res.status(400).json({
      success: false,
      message: `Error de subida: ${err.message}`
    });
  } else if (err) {
    return res.status(400).json({
      success: false,
      message: err.message
    });
  }
  next();
};

// Función para obtener URL de imagen
const getImageUrl = (filename, folder = '') => {
  if (!filename) return null;
  const baseUrl = process.env.BASE_URL || 'http://localhost:5000';
  return `${baseUrl}/uploads/${folder}/${filename}`;
};

module.exports = {
  upload,
  uploadProfile,
  uploadVehicle,
  uploadLicense,
  uploadCedula,
  uploadBusinessPhoto,
  uploadReceipt,
  uploadChatImage,
  uploadCatalogImages,
  handleUploadError,
  getImageUrl
};