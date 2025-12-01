import express from 'express';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

const app = express();
const PORT = 3000;

app.use(express.static('public'));
app.use(express.json());

app.post('/generate', (req, res) => {
    const { url } = req.body;
    if (!url) {
        return res.status(400).json({ error: 'URL is required' });
    }

    console.log(`Received request for URL: ${url}`);

    // Spawn the bot process
    const botProcess = spawn('npx', ['ts-node', 'notebooklm_bot.ts', url], {
        cwd: __dirname,
        shell: true
    });

    let output = '';

    botProcess.stdout.on('data', (data) => {
        const chunk = data.toString();
        console.log(`[BOT]: ${chunk}`);
        output += chunk;
    });

    botProcess.stderr.on('data', (data) => {
        console.error(`[BOT ERROR]: ${data}`);
        output += data.toString();
    });

    botProcess.on('close', (code) => {
        console.log(`Bot process exited with code ${code}`);
        if (code === 0) {
            // Check if video file exists
            const videoPath = path.join(__dirname, 'video_overview.mp4');
            if (fs.existsSync(videoPath)) {
                res.json({ success: true, message: 'Video generated successfully', videoPath });
            } else {
                res.status(500).json({ success: false, message: 'Video file not found', output });
            }
        } else {
            res.status(500).json({ success: false, message: 'Bot failed', output });
        }
    });
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
