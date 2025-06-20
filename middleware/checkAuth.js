import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

export const checkAuth = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).send("Not authorized");
        }
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({message: 'Unauthorized: Invalid token'});
    }
}