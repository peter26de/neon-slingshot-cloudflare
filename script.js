let audioInitialized = false;
let synth, hitSynth, launchSynth;

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

const startEl = document.getElementById('start-screen');
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const rivalEl = document.getElementById('rival');
const webrtcEl = document.getElementById('webrtc-btn');
const webrtcDialog = document.getElementById('webrtc-dialog');
const fpsEl = document.getElementById('fps');
const levelEl = document.getElementById('level');
const levelBar = document.getElementById('level-bar');
const healthBar = document.getElementById('health-bar');

let width, height;
let timeScale = 1.0;
let isDragging = false;
let mouse = { x: 0, y: 0 };
const player = { x: 0, y: 0, vx: 0, vy: 0, v: 0, radius: 12, isLaunching: true, color: '#38bdf8' };
let enemies = [];

let score = 0;
let longestStreak = 0;
let started = 0;
let lastTime = Date.now();
let lastFrame = performance.now();
let nextFrame = performance.now() + 1000/60;
let trueDelta = 0;
let timePassed;
let blackAlerted = 0;
let alertedAt;
let flashesEnabled = 0;
let flashNow = performance.now() - 1000;
let currentCanvas;
let difficulty = 1;
let levelProgress = 0;
let levelTotal = 0;
let healthProgress = 100;

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

// 1. Force a low latency hint and match hardware sample rate
const audioCtx = new (window.AudioContext || window.webkitAudioContext)({
  latencyHint: 'interactive', // Tells browser to use the smallest possible buffer
  sampleRate: 44100            // Optional: Or match standard mobile DAC rates
});

// Audio buffers
let shotBuffer = null;
let redOrbBuffer = null;
let blackOrbBuffer = null;
let wallStuckBuffer = null;
let levelUpBuffer = null;
let deathBuffer = null;
let suspenseBuffer = null;
let blackWarningBuffer = null;

// Generic loader
async function loadSound(url) {
  const responseSound = await fetch(url);
  const arrayBuffer = await responseSound.arrayBuffer();
  return audioCtx.decodeAudioData(arrayBuffer);
}

// Preload all sounds
async function loadSounds() {
  [
    shotBuffer,
    redOrbBuffer,
    blackOrbBuffer,
    wallStuckBuffer,
	levelUpBuffer,
	deathBuffer,
	suspenseBuffer,
	blackWarningBuffer
  ] = await Promise.all([
    loadSound("shot.wav"),
    loadSound("redOrb.wav"),
    loadSound("blackOrb.wav"),
    loadSound("wallStuck.mp3"),
	loadSound("levelUp.mp3"),
	loadSound("death.mp3"),
	loadSound("suspense.mp3"),
	loadSound("blackWarning.mp3")
  ]);
}

loadSounds();

// Generic playback helper
function playSound(buffer, changeShift) {
  if (!buffer) return;

  const source = audioCtx.createBufferSource();
  source.buffer = buffer;
  if(changeShift) source.playbackRate.value = Math.exp((Math.random() - 0.5) * 0.2);
  source.connect(audioCtx.destination);
  source.start();
}

// Sound-specific wrappers
function shot() {
  playSound(shotBuffer, true);
}

function redOrb() {
  playSound(redOrbBuffer, true);
}

function blackOrb() {
  playSound(blackOrbBuffer, true);
}

function wallStuck() {
  playSound(wallStuckBuffer, true);
}

function levelUp() {
  playSound(levelUpBuffer, true);
}

function death() {
  playSound(deathBuffer, false);
}

function suspense() {
	playSound(suspenseBuffer, false);
}

function blackWarning() {
	playSound(blackWarningBuffer, false);
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
		this.deadly = Math.random() < 0.9 || blackAlerted != 2 || started == 0 ? 0 : 1;
		this.vx = Math.cos(angle) * (Math.random() * 2 + 0.5) * 0.01**this.deadly;
		this.vy = Math.sin(angle) * (Math.random() * 2 + 0.5) * 0.01**this.deadly;
		this.color = this.deadly == 0 ? '#ef4444' : '#000000';
		if(this.deadly == 1) blackWarning();
		this.clicks = 0;
		this.warning = this.deadly;
		this.createdAt = performance.now();
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
		
		if(performance.now() - this.createdAt > 1000 && this.warning == 1) {
			this.warning = 0;
			this.vx *= 100;
			this.vy *= 100;
		}
		if(this.warning == 1) {
			// ctx.beginPath();
			// ctx.moveTo(this.x, this.y);
			// ctx.lineTo(width/2, height/2);
			// ctx.lineWidth = 2 * this.radius;
			// ctx.lineCap = "round";
			// ctx.strokeStyle = "rgba(0, 0, 0," + 0.3 * Math.sin((performance.now() - this.createdAt) / 1000 * Math.PI) + ")";
			// ctx.stroke();
			ctx.fillStyle = "rgba(0, 0, 0," + 0.3 * Math.sin((performance.now() - this.createdAt) / 1000 * Math.PI) + ")";
			ctx.font = "100px Arial";
			ctx.shadowBlur = 0;
			ctx.fillText("!", this.x/2 + width/4, this.y/2 + height/4);
		}
	}
}

document.getElementById('start-btn').addEventListener('click', async () => {
	score = 0;
	longestStreak = 0;
	blackAlerted = 0;
	difficulty = 1;
	levelProgress = 0;
	levelTotal = 0;
	healthProgress = 100;
	started = 1;
	await Tone.start();
	initAudio();
	startEl.style.display = 'none';
	document.getElementById('start-btn').innerText = "PLAY AGAIN";
	scoreEl.innerText = score;
	levelBar.style.width = levelProgress + '%';
	levelEl.innerText = 0;
	healthBar.style.width = healthProgress + '%';
});
document.getElementById('flashes-btn').addEventListener('click', function() {
	flashesEnabled = 1 - flashesEnabled;
	document.getElementById('flashes-btn').innerHTML = flashesEnabled == 1 ? "DISABLE FLASHES" : "ENABLE FLASHES";
});
const webrtcid = new URLSearchParams(window.location.search).get("webrtc");
let setUp = 0;
let response;
webrtcEl.addEventListener('click', function() {
	if(webrtcid == null) {
		if(setUp == 0) {
			startAsInitiator();
		} else {
			pasteRemoteString(prompt("PASTE RESPONSE HERE"));
		}
	} else {
		pasteRemoteString(webrtcid);
	}
});
if(webrtcid != null) {
	webrtcEl.innerHTML = "COPY RESPONSE";
	webrtcDialog.innerHTML = "Click \"Copy response\" to establish connection";
	alert("1. Click \"Copy response\"\n2. Send the text to your rival");
}
const config = {
  iceServers: [
    { urls: 'stun:stun.cloudflare.com:3478' },
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
}; const pc = new RTCPeerConnection(config); let dataChannel;

function setupDataChannel(channel) {
  dataChannel = channel;
  dataChannel.onopen = () => {rivalEl.innerText = 0;};
  dataChannel.onmessage = (event) => {
    const receivedInteger = parseInt(event.data, 10);
    rivalEl.innerText = receivedInteger;
  };
  dataChannel.onclose = (event) => {
    rivalEl.innerText = "-";
  };
}

pc.ondatachannel = (event) => {
  setupDataChannel(event.channel);
};

pc.onicecandidate = (event) => {
  if ((!event.candidate || true) && setUp == 0) {
	response = btoa(JSON.stringify(pc.localDescription));
	webrtcDialog.innerHTML = "Send this to your rival: " + (webrtcid == null ? "https://neon-slingshot.pages.dev/?webrtc=" : "") + response;
	setUp = 1;
	if(webrtcid == null) webrtcEl.innerHTML = "PASTE RESPONSE";
  }
};

function startAsInitiator() {
  setupDataChannel(pc.createDataChannel('integerExchange'));
  pc.createOffer()
    .then(offer => pc.setLocalDescription(offer))
    .catch(err => webrtcDialog.innerHTML = 'Offer error:' + err);
}

function pasteRemoteString(base64String) {
  try {
    const parsedDesc = JSON.parse(atob(base64String.trim()));
    pc.setRemoteDescription(new RTCSessionDescription(parsedDesc))
      .then(() => {
        // If we are the receiver handling an offer, automatically generate the answer
        if (parsedDesc.type === 'offer') {
          pc.createAnswer()
            .then(answer => pc.setLocalDescription(answer))
            .catch(err => webrtcDialog.innerHTML = 'Answer error:', err);
        }
      });
  } catch (err) {
    webrtcDialog.innerHTML = 'Invalid string provided. Ensure you copied the entire block.' + err;
  }
}

function sendInteger(value) {
  if (!dataChannel || dataChannel.readyState !== 'open') {
    console.error('❌ Cannot send data. Channel is closed or not established yet.');
    return;
  }
  
  //if (!Number.isInteger(value)) {
  //  console.warn('⚠️ Provided value is not an integer. Converting...');
  //  value = Math.floor(value);
  //}

  dataChannel.send(value.toString());
  console.log('📤 Sent integer:', value);
}


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
	if(blackAlerted == 0 && score >= 10) {
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
		
		if(player.vx * player.vx + player.vy * player.vy > 0 && performance.now() < nextFrame + (nextFrame - lastFrame) * 1) trueDelta = Math.min(trueDelta, 1 / Math.sqrt(player.vx * player.vx + player.vy * player.vy));
	
		// for(let i = 0; i < enemies.length; i++) {
		// 	if(enemies[i].v > 0) trueDelta = Math.min(trueDelta, 1 / enemies[i].v);
		// }
		
		if(player.isLaunching) {
			player.x += player.vx * timeScale * trueDelta * difficulty * 0.06;
			player.y += player.vy * timeScale * trueDelta * difficulty * 0.06;
			player.vx *= 0.99**( trueDelta * difficulty * 0.06);
			player.vy *= 0.99**( trueDelta * difficulty * 0.06);
			if((player.x < 0 || player.x > width || player.y < 0 || player.y > height) && Math.random() < 0.05) {
				player.vx /= 20;
				player.vy /= 20;
				wallStuck();
			}
			if(player.x < 0) {
				player.vx = Math.abs(player.vx);
				player.x = 0;
			}
			if(player.x > width) {
				player.vx = -Math.abs(player.vx);
				player.x = width;
			}
			if(player.y < 0) {
				player.vy = Math.abs(player.vy);
				player.y = 0;
			}
			if(player.y > height) {
				player.vy = -Math.abs(player.vy);
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
					score = 0;
					sendInteger(score);
					difficulty = Math.max(difficulty / 1.5, 1);
					healthProgress = Math.max(healthProgress - 25, 0);
					if(healthProgress <= 0) {
						if(started == 1) {
							death();
							document.getElementById('title-text').innerText = "FINAL STATS:\nLONGEST STREAK: " + longestStreak + "\nLEVEL: " + levelTotal;
						}
						startEl.style.display = 'flex';
						started = 0;
					}
					if(flashesEnabled == 1) {
						flashNow = performance.now();
					}
				} else {
					if(en.clicks > 0) {
						score += 1;
						longestStreak = Math.max(score, longestStreak);
						sendInteger(score);
						difficulty *= 1.5**0.05;
						if(levelProgress < 90) {
							levelProgress += 10;
						} else {
							levelUp();
							levelProgress = 0;
							levelTotal++;
							levelEl.innerText = levelTotal;
						}
						healthProgress = Math.min(healthProgress + 2, 100);
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
				levelBar.style.width = levelProgress + '%';
				healthBar.style.width = healthProgress + '%';
				scoreEl.innerText = score;
				if(audioInitialized) en.deadly == 0 ? redOrb() : blackOrb();
				enemies[i].reset();
			} else if(en.deadly == 1 && dx*dx + dy*dy > 0) {
				player.vx -= dx * width * width / 10000 / (dx*dx + dy*dy)**1.5 * en.radius * trueDelta * difficulty * 0.06;
				player.vy -= dy * height * height / 10000 / (dx*dx + dy*dy)**1.5 * en.radius * trueDelta * difficulty * 0.06;
			}
		});
		
		timePassed += trueDelta;
	}

	ctx.beginPath();
	ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
	ctx.fillStyle = player.color;
	ctx.shadowBlur = 20 * 0.06;
	ctx.shadowColor = player.color;
	ctx.fill();

	if(performance.now() - flashNow < 100) {
		currentCanvas = ctx.getImageData(0, 0, width, height);
		const data32 = new Int32Array(currentCanvas.data.buffer);
		//for(let i = 0; i < currentCanvas.data.length; i = (i % 4 != 2 ? i + 1 : i + 2)) {
		//	currentCanvas.data[i] = 255 - currentCanvas[i];
		//}
		for (let i = 0; i < data32.length; i++) {
			data32[i] ^= 0x00FFFFFF; 
		}
		ctx.putImageData(currentCanvas, 0, 0);
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
