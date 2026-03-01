export class DiscordService {
    private webhookUrl: string | undefined;

    constructor() {
        this.webhookUrl = process.env.DISCORD_WEBHOOK_URL;
    }

    async sendDiscordNotification(message: string): Promise<void> {
        if (!this.webhookUrl) {
            console.warn("DISCORD_WEBHOOK_URL is not set, skipping Discord notification.");
            return;
        }

        try {
            const response = await fetch(this.webhookUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    content: message,
                }),
            });

            if (!response.ok) {
                console.error(`Failed to send Discord notification: ${response.status} ${response.statusText}`);
            }
        } catch (error) {
            console.error("Error sending Discord notification:", error);
        }
    }
}

export const discordService = new DiscordService();
