document.open("text/html", "replace");
document.write('<!DOCTYPE html><html lang="en"><head>    <meta charset="UTF-8">    <meta name="viewport" content="width=device-width, initial-scale=1.0">    <title>Neon Slingshot</title>    <script src="https://cdn.tailwindcss.com"></script>    <script src="https://cdnjs.cloudflare.com/ajax/libs/tone/14.8.49/Tone.js"></script>    <style>        body, html { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background-color: #1a1a1a; font-family: 'Inter', sans-serif; }        canvas { display: block; }        .ui-overlay { position: absolute; top: 20px; left: 0; width: 100%; text-align: center; color: #fde047; pointer-events: none; }        #start-screen { position: absolute; inset: 0; display: flex; flex-direction: column; justify-content: center; align-items: center; background: rgba(0,0,0,0.8); z-index: 10; color: white; }    </style></head><body>    <div id="start-screen">        <h1 class="text-6xl font-black mb-8 tracking-tighter text-blue-400">NEON SLINGSHOT</h1>        <button id="start-btn" class="px-8 py-4 bg-blue-600 hover:bg-blue-500 rounded-full font-bold text-xl pointer-events-auto transition">START GAME</button>    </div>    <div class="ui-overlay">        <h1 class="text-4xl font-bold tracking-widest drop-shadow-lg">SCORE: <span id="score">0</span></h1>        <h1 class="text-4xl font-bold tracking-widest drop-shadow-lg">FPS ≈ <span id="fps">0</span></h1>        <div class="mt-4 w-64 h-4 bg-gray-700 rounded-full mx-auto overflow-hidden">            <div id="combo-bar" class="h-full bg-green-500 w-0 transition-all duration-300"></div>        </div>    </div>    <canvas id="gameCanvas"></canvas>    <script src="script.js">    </script></body></html>');
document.close();
let audioInitialized = false;
let synth, hitSynth, launchSynth;
function shot() {
	const sound = new Audio("shot.wav");
	sound.play();
}
function redOrb() {
	const sound = new Audio("redOrb.wav");
	sound.play();
}
function blackOrb() {
	const sound = new Audio("blackOrb.wav");
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

const player = { x: 0, y: 0, vx: 0, vy: 0, radius: 12, isLaunching: false, color: '#38bdf8' };
let enemies = [];
let lastTime = Date.now();
let lastFrame = performance.now();
let nextFrame = performance.now();

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
		this.deadly = Math.random() < 0.9 || score < 1000 ? 0 : 1;
		this.color = this.deadly == 0 ? '#ef4444' : '#000000';
		this.clicks = 0;
	}
	update() {
		this.x += this.vx * timeScale * 2;
		this.y += this.vy * timeScale * 2;
		this.vx += (this.x - player.x) * (this.deadly == 0 ? 0.06 : 0) * this.clicks / width;
		this.vy += (this.y - player.y) * (this.deadly == 0 ? 0.06 : 0) * this.clicks / height;
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
	await Tone.start();
	initAudio();
	document.getElementById('start-screen').style.display = 'none';
});

window.addEventListener('pointerdown', (e) => {
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
});
// window.addEventListener('mousemove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; });

function animate() {
	timeScale = isDragging ? 0.2 : 1.0;
	ctx.fillStyle = 'rgba(26, 26, 26, 0.3)';
	ctx.fillRect(0, 0, width, height);

	if(player.isLaunching) {
		player.x += player.vx * timeScale;
		player.y += player.vy * timeScale;
		player.vx *= 0.99;
		player.vy *= 0.99;
		if(player.x < 0) {
			player.vx = Math.abs(player.vx);
		}
		if(player.x > width) {
			player.vx = -Math.abs(player.vx);
		}
		if(player.y < 0) {
			player.vy = Math.abs(player.vy);
		}
		if(player.y > height) {
			player.vy = -Math.abs(player.vy);
		}
	}

	enemies.forEach((en, i) => {
		en.update();
		en.draw();
		const dx = player.x - en.x;
		const dy = player.y - en.y;
		if(Math.sqrt(dx*dx + dy*dy) < en.radius + player.radius) {
			if(en.deadly == 1) {
				score = Math.max(0, score - 1000);
			} else if(en.clicks > 0) {
				score += 100;
			}
			scoreEl.innerText = score;
			if(audioInitialized) en.deadly == 0 ? redOrb() : blackOrb();
			const dvx = player.vx - en.vx;
			const dvy = player.vy - en.vy;
			const nvx = dx / Math.sqrt(dx*dx + dy*dy);
			const nvy = dy / Math.sqrt(dx*dx + dy*dy);
			const dot = dvx * nvx + dvy * nvy;
			player.vx -= 2 * dot * nvx;
			player.vy -= 2 * dot * nvy;
			enemies[i] = new Enemy();
		}
	});

	if(Date.now() - lastTime > 1000) {
		enemies.push(new Enemy());
		lastTime = Date.now();
	}
	
	for(let i = enemies.length - 1; i >= 0; i--) {
		if(enemies[i].x < -100 || enemies[i].x > width + 100 || enemies[i].y < -100 || enemies[i].y > height + 100) {
			enemies.splice(i, 1);
		}
	}

	ctx.beginPath();
	ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
	ctx.fillStyle = player.color;
	ctx.shadowBlur = 20;
	ctx.shadowColor = player.color;
	ctx.fill();

	nextFrame = performance.now();
	if(nextFrame - lastFrame > 0) {
		fpsEl.innerText = (1000 / (nextFrame - lastFrame)).toFixed(1);
		lastFrame = nextFrame;
	}
    requestAnimationFrame(animate);
}

function resize() {
	width = canvas.width = window.innerWidth;
	height = canvas.height = window.innerHeight;
	player.x = width / 2;
	player.y = height / 2;
}
window.addEventListener('resize', resize);
resize();
animate();
