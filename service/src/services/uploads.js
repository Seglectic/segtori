// ╭──────────────────────────────╮
// │  Upload Middleware           │
// │  Configures image upload     │
// │  parsing for the firmware    │
// │  scan endpoint scaffold.     │
// ╰──────────────────────────────╯

const multer = require("multer");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

module.exports = {
  uploadImage: upload.single("image"),
};

