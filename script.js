let audioInitialized = false;
let synth, hitSynth, launchSynth;

function suspense() {
	const sound = new Audio("suspense.mp3");
	sound.play();
}

function initAudio() {
	if (audioInitialized) return;
	
	// Background rhythm
	// synth = new Tone.MembraneSynth().toDestination();
	// synth.volume.value = -10;
	
	// Hit sound
	// hitSynth = new Tone.PolySynth(Tone.Synth).toDestination();
	// hitSynth.set({ oscillator: { type: "sine" }, envelope: { attack: 0.01, decay: 0.1, sustain: 0 } });
	
	// Launch sound
	// launchSynth = new Tone.Synth({ oscillator: { type: "triangle" } }).toDestination();
	
	// Simple loop
	// new Tone.Loop((time) => {
	//     synth.triggerAttackRelease("C1", "8n", time);
	// }, "4n").start(0);
	async function initAudioBack() {
		const player = new Tone.Player({
			url: "clock.wav",
			loop: true,
			autostart: false // Change this to false
		}).toDestination();
	
		await Tone.loaded();
	
		// Start the player at the current audio context time
		player.start(Tone.now()); 
	}

	initAudioBack();
	audioInitialized = true;
}

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const fpsEl = document.getElementById('fps');

let width, height;
let score = 0;
let timeScale = 1.0;
let isDragging = false;
let mouse = { x: 0, y: 0 };

const player = { x: 0, y: 0, vx: 0, vy: 0, v: 0, radius: 12, isLaunching: true, color: '#38bdf8' };
let started = 0;
let enemies = [];
let lastTime = Date.now();
let lastFrame = performance.now();
let nextFrame = performance.now() + 1000/60;
let trueDelta = 0;
let timePassed;
let blackAlerted = 0;
let alertedAt;
let flashesEnabled = 0;
let difficulty = 1;

//function shot() {
//	if(blackAlerted != 1) {
//	    const sound = new Audio("shot.wav");
//	    sound.preservesPitch = false; 
//	    sound.playbackRate = Math.exp((Math.random() - 0.5) * 0.2);
//	    sound.play();
//	}
//}
//
//function redOrb() {
//	if(blackAlerted != 1) {
//		const sound = new Audio("redOrb.wav");
//	    sound.preservesPitch = false; 
//	    sound.playbackRate = Math.exp((Math.random() - 0.5) * 0.2);
//		sound.play();
//	}
//}
//function blackOrb() {
//	if(blackAlerted != 1) {
//		const sound = new Audio("blackOrb.wav");
//	    sound.preservesPitch = false; 
//	    sound.playbackRate = Math.exp((Math.random() - 0.5) * 0.2);
//		sound.play();
//	}
//}

// 1. Initialize the audio context
const shotCtx = new AudioContext();
const redOrbCtx = new AudioContext();
const blackOrbCtx = new AudioContext();
const wallStuckCtx = new AudioContext();
let shotBuffer = null;
let redOrbBuffer = null;
let blackOrbBuffer = null;
let wallStuckBuffer = null;

// 2. Preload and decode the audio file once
async function shotLoad() {
  const response = await fetch("shot.wav");
  const arrayBuffer = await response.arrayBuffer();
  shotBuffer = await shotCtx.decodeAudioData(arrayBuffer);
}
shotLoad();

// 2. Preload and decode the audio file once
async function redOrbLoad() {
  const response = await fetch("redOrb.wav");
  const arrayBuffer = await response.arrayBuffer();
  redOrbBuffer = await redOrbCtx.decodeAudioData(arrayBuffer);
}
redOrbLoad();

// 2. Preload and decode the audio file once
async function blackOrbLoad() {
  const response = await fetch("blackOrb.wav");
  const arrayBuffer = await response.arrayBuffer();
  blackOrbBuffer = await blackOrbCtx.decodeAudioData(arrayBuffer);
}
blackOrbLoad();

// 2. Preload and decode the audio file once
async function wallStuckLoad() {
  const response = await fetch("wallStuck.mp3");
  const arrayBuffer = await response.arrayBuffer();
  wallStuckBuffer = await wallStuckCtx.decodeAudioData(arrayBuffer);
}
wallStuckLoad();

// 3. High-performance, zero-latency playback loop
function shot() {
	if(blackAlerted != 1) {
		if (!shotBuffer) return; 

		// Create a lightweight node (highly optimized by browsers)
		const source = shotCtx.createBufferSource();
		source.buffer = shotBuffer;
		source.playbackRate.value = Math.exp((Math.random() - 0.5) * 0.2);
		source.connect(shotCtx.destination);

		// Play immediately with sub-millisecond precision
		source.start(0);
	}
}

// 3. High-performance, zero-latency playback loop
function redOrb() {
	if(blackAlerted != 1) {
		if (!redOrbBuffer) return; 

		// Create a lightweight node (highly optimized by browsers)
		const source = redOrbCtx.createBufferSource();
		source.buffer = redOrbBuffer;
		source.playbackRate.value = Math.exp((Math.random() - 0.5) * 0.2);
		source.connect(redOrbCtx.destination);

		// Play immediately with sub-millisecond precision
		source.start(0);
	}
}

// 3. High-performance, zero-latency playback loop
function blackOrb() {
	if(blackAlerted != 1) {
		if (!blackOrbBuffer) return; 

		// Create a lightweight node (highly optimized by browsers)
		const source = blackOrbCtx.createBufferSource();
		source.buffer = blackOrbBuffer;
		source.playbackRate.value = Math.exp((Math.random() - 0.5) * 0.2);
		source.connect(blackOrbCtx.destination);

		// Play immediately with sub-millisecond precision
		source.start(0);
	}
}

// 3. High-performance, zero-latency playback loop
function wallStuck() {
	if(blackAlerted != 1) {
		if (!wallStuckBuffer) return; 

		// Create a lightweight node (highly optimized by browsers)
		const source = wallStuckCtx.createBufferSource();
		source.buffer = wallStuckBuffer;
		source.playbackRate.value = Math.exp((Math.random() - 0.5) * 0.2);
		source.connect(wallStuckCtx.destination);

		// Play immediately with sub-millisecond precision
		source.start(0);
	}
}

class Enemy {
	constructor() { this.reset(); }
	reset() {
		this.radius = 15 + Math.random() * 20;
		const side = Math.floor(Math.random() * 4);
		if(side === 0) { this.x = Math.random() * width; this.y = -50; }
		else if(side === 1) { this.x = width + 50; this.y = Math.random() * height; }
		else if(side === 2) { this.x = Math.random() * width; this.y = height + 50; }
		else { this.x = -50; this.y = Math.random() * height; }
		const angle = Math.atan2(height/2 - this.y, width/2 - this.x);
		this.vx = Math.cos(angle) * (Math.random() * 2 + 0.5);
		this.vy = Math.sin(angle) * (Math.random() * 2 + 0.5);
		this.deadly = Math.random() < 0.9 || score < 1000 || blackAlerted != 2 || Date.now() - alertedAt < 7000 ? 0 : 1;
		if(Date.now() - alertedAt > 7000 && Date.now() - alertedAt < 11000) this.deadly = 1;
		this.color = this.deadly == 0 ? '#ef4444' : '#000000';
		this.clicks = 0;
	}
	update() {
		this.x += this.vx * timeScale * 2 * trueDelta * difficulty * 0.06;
		this.y += this.vy * timeScale * 2 * trueDelta * difficulty * 0.06;
		this.vx += (this.x - player.x) * (this.deadly == 0 ? 0.06 : 0) * this.clicks / width * trueDelta * difficulty * 0.06;
		this.vy += (this.y - player.y) * (this.deadly == 0 ? 0.06 : 0) * this.clicks / height * trueDelta * difficulty * 0.06;
		this.v = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
	}
	draw() {
		ctx.beginPath();
		ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
		ctx.fillStyle = this.color;
		ctx.shadowBlur = 15;
		ctx.shadowColor = this.color;
		ctx.fill();
	}
}

document.getElementById('start-btn').addEventListener('click', async () => {
	started = 1;
	await Tone.start();
	initAudio();
	document.getElementById('start-screen').style.display = 'none';
});
document.getElementById('flashes-btn').addEventListener('click', function() {
	flashesEnabled = 1 - flashesEnabled;
	document.getElementById('flashes-btn').innerHTML = flashesEnabled == 1 ? "DISABLE FLASHES" : "ENABLE FLASHES";
});

window.addEventListener('pointerdown', (e) => {
	if(started == 1) {
		mouse.x = e.clientX; mouse.y = e.clientY;
		isDragging = true;
		if(isDragging) {
			player.vx = (mouse.x - player.x) * 0.05;
			player.vy = (mouse.y - player.y) * 0.05;
			player.isLaunching = true;
			if(audioInitialized) shot();
		}
		isDragging = false;
		for(let i in enemies) enemies[i].clicks++;
	}
});
// window.addEventListener('mousemove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; });

function animate() {
	timeScale = isDragging ? 0.2 : 1.0;
	if(blackAlerted == 0 && score >= 1000) {
		alertedAt = Date.now();
		blackAlerted = 1;
		suspense();
	}
	if(blackAlerted == 1) {
		if(Date.now() - alertedAt > 7000) {
			ctx.fillStyle = 'rgba(26, 26, 26, 0.3)';
			blackAlerted = 2;
		} else {
			const ctxFillColor = 26 + 20 * Math.sin(Date.now() / 30) * Math.sin((Date.now() - alertedAt) / 7000 * Math.PI) * flashesEnabled;
			ctx.fillStyle = 'rgba(' + ctxFillColor + ', ' + ctxFillColor + ', ' + ctxFillColor + ', 0.3)';
		}
	} else {
		ctx.fillStyle = 'rgba(26, 26, 26, 0.3)';
	}
	
	ctx.fillRect(0, 0, width, height);
	
	for(let i = enemies.length - 1; i >= 0; i--) {
		if(enemies[i].x < -100 || enemies[i].x > width + 100 || enemies[i].y < -100 || enemies[i].y > height + 100) {
			enemies.splice(i, 1);
		}
	}
	
	timePassed = 0;
	
	while(timePassed < nextFrame - lastFrame) {
		trueDelta = nextFrame - lastFrame - timePassed;
		
		if(Math.sqrt(player.vx * player.vx + player.vy * player.vy) > 0) trueDelta = Math.min(trueDelta, 1 / Math.sqrt(player.vx * player.vx + player.vy * player.vy));
	
		// for(let i = 0; i < enemies.length; i++) {
		// 	if(enemies[i].v > 0) trueDelta = Math.min(trueDelta, 1 / enemies[i].v);
		// }
		
		if(player.isLaunching) {
			player.x += player.vx * timeScale * trueDelta * difficulty * 0.06;
			player.y += player.vy * timeScale * trueDelta * difficulty * 0.06;
			player.vx *= 0.99**( trueDelta * difficulty * 0.06);
			player.vy *= 0.99**( trueDelta * difficulty * 0.06);
			if(player.x < 0) {
				if(Math.random() < 0.1) {
					wallStuck();
					player.vx = 0;
					player.vy = 0;
				} else {
					player.vx = Math.abs(player.vx);
				}
				player.x = 0;
			}
			if(player.x > width) {
				if(Math.random() < 0.1) {
					wallStuck();
					player.vx = 0;
					player.vy = 0;
				} else {
					player.vx = -Math.abs(player.vx);
				}
				player.x = width;
			}
			if(player.y < 0) {
				if(Math.random() < 0.1) {
					wallStuck();
					player.vx = 0;
					player.vy = 0;
				} else {
					player.vy = Math.abs(player.vy);
				}
				player.y = 0;
			}
			if(player.y > height) {
				if(Math.random() < 0.1) {
					wallStuck();
					player.vx = 0;
					player.vy = 0;
				} else {
					player.vy = -Math.abs(player.vy);
				}
				player.y = height;
			}
		}

		enemies.forEach((en, i) => {
			en.update();
			if(timePassed == 0) en.draw();
			const dx = player.x - en.x;
			const dy = player.y - en.y;
			if(Math.sqrt(dx*dx + dy*dy) < en.radius + player.radius) {
				if(en.deadly == 1) {
					score = Math.max(0, score - 1000);
					difficulty = Math.max(difficulty / 1.5, 1);
					if(flashesEnabled == 1) {
						ctx.fillStyle = 'rgba(-14, -14, -14, 0.3)';
						ctx.fillRect(0, 0, width, height);
					}
				} else {
					if(en.clicks > 0) {
						score += 100;
						difficulty *= 1.5**(1/15);
					}
					if(dx*dx + dy*dy > 0) {
						const dvx = player.vx - en.vx;
						const dvy = player.vy - en.vy;
						const nvx = dx / Math.sqrt(dx*dx + dy*dy);
						const nvy = dy / Math.sqrt(dx*dx + dy*dy);
						const dot = dvx * nvx + dvy * nvy;
						player.vx -= 2 * dot * nvx;
						player.vy -= 2 * dot * nvy;
					}
				}
				scoreEl.innerText = score;
				if(audioInitialized) en.deadly == 0 ? redOrb() : blackOrb();
				enemies[i].reset();
			} else if(en.deadly == 1 && dx*dx + dy*dy > 0) {
				player.vx -= dx * width * width / 10000 / (dx*dx + dy*dy)**1.5 * en.radius * trueDelta * difficulty * 0.06;
				player.vy -= dy * height * height / 10000 / (dx*dx + dy*dy)**1.5 * en.radius * trueDelta * difficulty * 0.06;
			}
		});
		
		timePassed += trueDelta;

		ctx.beginPath();
		ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
		ctx.fillStyle = player.color;
		ctx.shadowBlur = 20 * trueDelta * 0.06;
		ctx.shadowColor = player.color;
		ctx.fill();
	}
	
	if(Date.now() - lastTime > 1000 / difficulty) {
		enemies.push(new Enemy());
		lastTime = Date.now();
	}

	if(nextFrame - lastFrame > 0) {
		fpsEl.innerText = (1000 / (nextFrame - lastFrame)).toFixed(1);
		lastFrame = nextFrame;
	}
	nextFrame = performance.now();
	
    requestAnimationFrame(animate);
}

function resize() {
	width = canvas.width = window.innerWidth;
	height = canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();
player.x = width / 2;
player.y = height / 2;
animate();
