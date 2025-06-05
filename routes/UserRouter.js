import { response, Router } from "express";
import Users from "../db/userModel.js";
import { checkAuth } from "../middleware/checkAuth.js";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

const userRoute = Router();

userRoute.get("/list", async (request, response) => {
  try {
    const users = await Users.find({}, "_id first_name last_name");
    response.status(200).json(users);
  } catch (err) {
    response.status(500).json({ message: "Error fetching users", error: err.message });
  }
});

userRoute.get("/:id", async (req, res) => {
  try {
    // if (!require("mongoose").Types.ObjectId.isValid(req.params.id)) {
    //     return res.status(400).json({message: "Invalid userId format"});
    // }
    const user = await Users.findById(req.params.id).select("_id first_name last_name location description occupation");
    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    res.status(200).json(user);
  } catch (err) {
    res.status(500).json({ message: "Error fetching user", error: err.message });
  }
});
// api login
userRoute.post("/admin/login", async (req, res) => {
  try {
    const { login_name, password } = req.body;
    if (!login_name || !password) {
      return res.status(400).json({ message: "Login name and password are required." });
    }
    const user = await Users.findOne({ login_name });
    if (!user || user.password !== password) {
      return res.status(400).json({ message: "Invalid login name or password." });
    }
    const token = jwt.sign({ _id: user._id, first_name: user.first_name, last_name: user.last_name, login_name: login_name }, process.env.JWT_SECRET, { expiresIn: "1h" });
    console.log("login successfully");
    res.status(200).json({
      token,
      _id: user._id,
      first_name: user.first_name,
      last_name: user.last_name,
      login_name: login_name,
    });
  } catch (err) {
    console.error("Error during login", err);
    res.status(500).json({ message: "Internal server error during login." });
  }
});
// api register
userRoute.post("/", async (req, res) => {
  try {
    const { login_name, password, first_name, last_name, location, description, occupation } = req.body;
    if (!login_name || !password || !first_name || !last_name) {
      return res.status(400).send("Missing required fields: login_name, password, first_name, and last_name are required.");
    }
    const existingUser = await Users.findOne({ login_name });
    if (existingUser) {
      return res.status(400).send("Login name already exists");
    }

    const newUser = new Users({
      login_name: login_name,
      password: password,
      first_name: first_name,
      last_name: last_name,
      location: location || "",
      description: description || "",
      occupation: occupation || "",
    });
    await newUser.save();
    res.status(201).json({
      _id: newUser._id,
      login_name: newUser.login_name,
      first_name: newUser.first_name,
      last_name: newUser.last_name,
    });
  } catch (err) {
    console.error("Error register new user", err);
    res.status(500).send("Internal server error during registration.");
  }
});

export default userRoute;
