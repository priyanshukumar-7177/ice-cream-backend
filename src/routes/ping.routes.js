// ping.routes.js
import { Router } from "express";

const router = Router();

// Change "/ping" to "/"
router.route("/").get((req, res) => {
    console.log("hit hua");
    return res.status(200).send('Server is awake');
});

export default router;