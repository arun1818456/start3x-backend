import cron from "node-cron";
import Notification from "../modules/notifications/model.js";

// Runs every day at 12:00 AM (midnight) IST
cron.schedule("0 0 * * *", async () => {
    try {
        console.log("🗑 Start deleting old notifications...");
        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

        const result = await Notification.deleteMany({
            createdAt: { $lte: oneMonthAgo },
        });

        console.log(`✔ Old notifications removed: ${result.deletedCount}`);
    } catch (err) {
        console.error("🔥 Error while deleting notifications:", err);
    }
}, {
    timezone: "Asia/Kolkata",
});
