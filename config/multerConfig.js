const multer = require('multer');
const path = require('path');

// Configure storage for multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/'); // Change this to your desired upload directory
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname)); // Use timestamp to avoid duplicate file names
    }
});

// Create the multer instance
const upload = multer({ storage: storage });

// Export the multer instance
module.exports = upload;





