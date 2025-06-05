import { Router } from "express";
import Photos from "../db/photoModel.js";
import Users from "../db/userModel.js";
import { checkAuth } from "../middleware/checkAuth.js";

import path from "path";
import fs from "fs/promises";
import { fileURLToPath } from 'url';

const photoRoute = Router();
// Hàm trợ giúp để lấy __dirname trong ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const imagesDir = path.join(__dirname, '..', 'images');


photoRoute.get("/", async (request, response) => {
    const photos = await Photos.find({})
        .select("_id user_id comments file_name date_time");
    return response.status(200).json(photos);
});

photoRoute.get("/:id", async (req, res) => {
    try {
        const userId = req.params.id;
        // Check userId hop le
        // if (!require("mongoose").Types.ObjectId.isValid(userId)) {
        //     return response.status(400).json({message: "Invalid userId format"});
        // }
        const userExists = await Users.findById(userId);
        if (!userExists) {
            return res.status(404).json({ message: "User not found." });
        }
        const photos = await Photos.find({ user_id: userId })
            .select("_id user_id comments file_name date_time")
            .populate({
                path: "comments.user_id",
                select: "_id first_name last_name",
            });

        // Format lai dinh dang mang comments de chi chua cacc truong _id first_name last_name
        const photosFormatted = photos.map((photo) => {
            const photoObj = photo.toObject();

            // Dinh dang lai mang comment chua user chu khong phai userId
            photoObj.comments = photoObj.comments.map((comment) => {
                const userInfo = {
                    _id: comment.user_id._id,
                    first_name: comment.user_id.first_name,
                    last_name: comment.user_id.last_name,
                };
                return {
                    _id: comment._id,
                    comment: comment.comment,
                    date_time: comment.date_time,
                    user: userInfo, // tra ve thong tin truong user voi thong tin da format
                };
            });
            return photoObj;
        });
        res.status(200).json(photosFormatted);
    } catch (err) {
        res.status(500).json({ message: "Error fetching photos of user", error: err.message });
    }
});

photoRoute.post("/commentsOfPhoto/:photo_id", checkAuth, async (req, res) => {
    try {
        const photoId = req.params.photo_id;
        const { comment } = req.body;
        const userId = req.user._id; // lay tu checkAuth
        if (!comment) {
            return res.status(400).json({ message: "Comment cannot be empty" });
        }
        const photo = await Photos.findById(photoId);
        if (!photo) {
            return res.status(404).json({ message: "Photo not found" });
        }
        photo.comments.push({
            comment: comment,
            user_id: userId,
            date_time: new Date()
        })
        await photo.save();
        // tim comment vua them vao
        const resPhoto = await Photos.findById(photoId).select('comments')
            .populate({
                path: "comments.user_id",
                select: "_id first_name last_name",
            });
        const newComment = resPhoto.comments.find(
            c => c.comment === comment && c.user_id._id.toString() === userId.toString()
        );
        res.status(200).json({
            message: "Comment added successfully",
            newComment: newComment
        });

    } catch (err) {
        console.error("Error adding comment:", err);
        res.status(500).json({ message: "Error adding comment", error: err.message });
    }
})

photoRoute.post("/new", checkAuth, async (req, res) => {
    try {

        if (!req.files || Object.keys(req.files).length === 0) {
            return res.status(400).json({ message: "No file uploaded" });
        }
        const photoFile = req.files.photo;

        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (!allowedTypes.includes(photoFile.mimetype)) {
            return res.status(400).json({ message: "Invalid file type. Only JPEG, PNG, GIF and WebP are allowed." });
        }
        // Tao ten file duy nhat cho anh moi
        const ogirinalFileName = photoFile.name;
        const fileExtension = path.extname(ogirinalFileName);
        const uniqueFileName = `${Date.now()}-${Math.random() * 1E9}${fileExtension}`;
        // Duong dan de luu file tren server (da khai bao o tren)
        // const __filename = fileURLToPath(import.meta.url);
        // const __dirname = path.dirname(__filename);
        // const imagesDir = path.join(__dirname, '..', 'images');
        await fs.mkdir(imagesDir, { recursive: true });

        const uploadPath = path.join(imagesDir, uniqueFileName);
        // Chuyen file da upload vao thu muc images
        await photoFile.mv(uploadPath);

        const userId = req.user._id; // tu checkAuth

        const newPhoto = new Photos({
            file_name: uniqueFileName,
            date_time: new Date(),
            user_id: userId,
            comments: []
        })
        await newPhoto.save();

        res.status(201).json({ message: "Photo uploaded successfully" });

    } catch (err) {
        console.error("Error uploading photo:", err);
        if (err.code === 'ENOENT') { // Lỗi thư mục không tồn tại
            res.status(500).json({ message: "Server error: Image upload directory not found or created.", error: err.message });
        } else {
            res.status(500).json({ message: "Error uploading photo", error: err.message });
        }
    }
})

photoRoute.delete("/:photoId", checkAuth, async (req, res) => {
    try {
        const photoId = req.params.photoId;
        const userId = req.user._id; // tu middleware
        const photo = await Photos.findById(photoId);
        if (!photo) {
            return res.status(404).json({ message: "Photo not found" });
        }
        if (photo.user_id.toString() !== userId) {
            return res.status(403).json({ message: "You can only delete your own photo" });
        }
        await Photos.deleteOne({ _id: photoId });
        // Xoa anh that tren server
        const filePath = path.join(imagesDir, photo.file_name);
        await fs.unlink(filePath);
        console.log(`Deleted: ${filePath}`);
        res.status(200).json({ message: "Deleted (DB and server)" });
    } catch (err) {
        if (err.name === 'CastError' && err.kind === 'ObjectId') {
            return res.status(400).json({ message: "Invalid Photo ID format." });
        } else if (err === 'ENOENT') {
            console.log(`File not found on disk, but removed from DB`);
        }
        res.status(500).json({ message: "Error while deleting photo", error: err.message });
    }
});
photoRoute.delete("/comments/:photoId/:commentId", checkAuth, async (req, res) => {
    try {
        const { photoId, commentId } = req.params;
        const userId = req.user._id; // Lấy từ middleware checkAuth

        const photo = await Photos.findById(photoId);

        if (!photo) {
            return res.status(404).json({ message: "Photo not found." });
        }

        // Tìm comment trong mảng comments của ảnh
        const commentToDelete = photo.comments.id(commentId);

        if (!commentToDelete) {
            return res.status(404).json({ message: "Comment not found." });
        }

        // Kiểm tra xem người dùng hiện tại có phải là chủ của comment không
        if (commentToDelete.user_id.toString() !== userId.toString()) {
            return res.status(403).json({ message: "You are not authorized to delete this comment." });
        }

        // Xóa comment khỏi mảng
        commentToDelete.remove(); // Phương thức remove() của subdocument trong Mongoose
        await photo.save(); // Lưu lại thay đổi vào database

        res.status(200).json({ message: "Comment deleted successfully." });
    } catch (err) {
        res.status(500).json({ message: "Error deleting comment", error: err.message });
    }
});

export default photoRoute;
