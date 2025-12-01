import ffmpeg from 'fluent-ffmpeg';
import * as path from 'path';
import * as fs from 'fs';

async function createVideo(audioPath: string, outputPath: string) {
    return new Promise((resolve, reject) => {
        console.log(`Generating video from ${audioPath}...`);

        // Check if audio exists
        if (!fs.existsSync(audioPath)) {
            reject(new Error(`Audio file not found: ${audioPath}`));
            return;
        }

        // Create a video with a solid blue background (or any color)
        // We loop the image (or color) for the duration of the audio
        ffmpeg()
            .input('color=c=blue:s=1280x720')
            .inputOptions('-f lavfi')
            .input(audioPath)
            .outputOptions([
                '-c:v libx264',
                '-tune stillimage',
                '-c:a aac',
                '-b:a 192k',
                '-pix_fmt yuv420p',
                '-shortest' // Stop when the shortest input (audio) ends
            ])
            .save(outputPath)
            .on('end', () => {
                console.log(`Video created successfully: ${outputPath}`);
                resolve(outputPath);
            })
            .on('error', (err) => {
                console.error('Error creating video:', err);
                reject(err);
            });
    });
}

// CLI usage
const audioFile = process.argv[2];
if (audioFile) {
    const output = 'output.mp4';
    createVideo(audioFile, output).catch(console.error);
} else {
    console.log('Usage: ts-node video_gen.ts <path_to_audio_file>');
}
