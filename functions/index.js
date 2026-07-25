const functions = require("firebase-functions");
const cloudinary = require("cloudinary").v2;
const cors = require("cors")({ origin: true });

// Configure Cloudinary using Firebase config
cloudinary.config({
  cloud_name: functions.config().cloudinary.cloud_name,
  api_key: functions.config().cloudinary.api_key,
  api_secret: functions.config().cloudinary.api_secret,
});

// HTTP function to upload image
exports.uploadImage = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      const { image } = req.body;

      if (!image) {
        return res.status(400).json({ error: "No image provided" });
      }

      const result = await cloudinary.uploader.upload(image, {
        folder: "whatscooking_uploads",
      });

      return res.status(200).json({
        message: "Upload successful",
        url: result.secure_url,
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: error.message });
    }
  });
});