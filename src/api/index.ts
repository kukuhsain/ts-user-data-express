import express from "express";

import type MessageResponse from "../interfaces/message-response.js";

import users from "./users.js";

const router = express.Router();

router.get<object, MessageResponse>("/", (req, res) => {
  res.json({
    message: "API - 👋🌎🌍🌏",
  });
});

router.use("/users", users);

export default router;
