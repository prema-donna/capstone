const spawn = require('child_process').spawn;

const parent = process.argv[2];

let videos = [];

if(process.argv[2]){

    // Parent Path

    const start = parseInt(process.argv[3]);

    const end = parseInt(process.argv[4]);

    for (let i = start; i <= end; i++) {
        videos.push(i);
    }
    videos.reverse();
    processVideos();
}
else{

    // Parent Path is required

    console.log('Parent Folder is required');

}

function resizeVideo(video, quality) {

    const p = new Promise((resolve, reject) => {

        const ffmpeg = spawn('ffmpeg', ['-i', `${parent}/${video}.avi`, '-codec:v', 'libx264', '-profile:v', 'main', '-preset', 'slow', '-b:v', '50000k', '-maxrate', '50000k', '-bufsize', '5000k', '-vf', `scale=-2:${quality}`, '-threads', '0', '-b:a', '128k', '-y', `${parent}/transcoded/${video}_${quality}.avi`]);

        ffmpeg.stderr.on('data', (data) => {
            console.log(`${data}`);
        });
		
        ffmpeg.on('close', (code) => {
            resolve();
        });
    });
    return p;
}



function processVideos() {

    let video = videos.pop();

    if (video) {
	resizeVideo(video, 1080).then(() => {

        resizeVideo(video, 720).then(() => {

            // 720p video all done

            resizeVideo(video, 480).then(() => {

                // 480p video all done

                resizeVideo(video, 360).then(() => {

                    // 360p video all done

                    console.log(`Completed Video Number - ${video}`);

                    processVideos();
                });
            });
        });
	});
  }
}