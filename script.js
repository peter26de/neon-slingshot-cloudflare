let audioInitialized = false;
let synth, hitSynth, launchSynth;

let tonePlayer;
let heartBeat;
let currentAmbient = "none";

function initAudio() {
	currentAmbient = "tone";
	if (audioInitialized) {
		heartBeat.stop();
		tonePlayer.stop();
		tonePlayer.start(Tone.now());
		return;
	}
	
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
		tonePlayer = new Tone.Player({
			url: "clock.wav",
			loop: true,
			autostart: false
		}).toDestination();
	
		// await Tone.loaded();
		
		heartBeat = new Tone.Player({
			url: "heartBeat.mp3",
			loop: true,
			autostart: false
		}).toDestination();
	
		await Tone.loaded();
	
		// Start the player at the current audio context time
		tonePlayer.start(Tone.now()); 
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
const frameTimeEl = document.getElementById('frameTime');
const lowHealth = document.getElementById('lowHealth');
const levelEl = document.getElementById('level');
const levelBar = document.getElementById('level-bar');
const healthBar = document.getElementById('health-bar');

const offscreen = new OffscreenCanvas(0, 0);

let width, height;
let timeScale = 1.0;
let isDragging = false;
let mouse = { x: 0, y: 0 };
const player = { x: 0, y: 0, oldX: 0, oldY: 0, vx: 0, vy: 0, v: 0, radius: 12, isLaunching: true, color: '#38bdf8' };
let enemies = [];
let gravityGrid;
let tempList;
let tempX;
let tempY;
let imageData;
let lastLost = performance.now() - 10000;

let score = 0;
let longestStreak = 0;
let started = 0;
let lastTime = Date.now();
let lastFrame = performance.now();
let nextFrame = performance.now() + 1000/60;
let trueDelta = 0;
let physicalDelta = 0;
let lastPhysics = performance.now();
let blackAlerted = 0;
let alertedAt;
let flashesEnabled = 0;
let flashNow = performance.now() - 1000;
let currentCanvas;
let difficulty = 1;
let levelProgress = 0;
let levelTotal = 0;
let healthProgress = 100;
// let averageFrameTime = 0;

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
  if (!buffer || started == 0) return;

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
		this.oldX = this.x;
		this.oldY = this.y;
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
		this.x += this.vx * trueDelta * 2;
		this.y += this.vy * trueDelta * 2;
		this.vx += (this.x - player.x) * (this.deadly == 0 ? 0.06 : 0) * this.clicks / width * trueDelta;
		this.vy += (this.y - player.y) * (this.deadly == 0 ? 0.06 : 0) * this.clicks / height * trueDelta;
		this.v = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
	}
	draw() {
		if(this.deadly == 0) {
			// ctx.beginPath();
			// ctx.shadowBlur = 5;
			// ctx.moveTo(this.oldX, this.oldY);
			// ctx.lineTo(this.x, this.y);
			// ctx.lineWidth = 2 * this.radius;
			// ctx.lineCap = "round";
			// ctx.strokeStyle = this.color;
			// ctx.stroke();

			this.oldX = this.x;
			this.oldY = this.y;
			
			ctx.beginPath();
			ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
			ctx.fillStyle = this.color;
			ctx.shadowBlur = 15;
			ctx.shadowColor = this.color;
			ctx.fill();
		}
		
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
			// ctx.strokeStyle = "rgba(0, 0, 0," +  * Math.sin((performance.now() - this.createdAt) / 1000 * Math.PI) + ")";
			// ctx.stroke();
			ctx.fillStyle = "rgba(0, 0, 0," + 1 * Math.sin((performance.now() - this.createdAt) / 1000 * Math.PI) + ")";
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
	lowHealth.style.display = 'none';
	document.getElementById('start-btn').innerText = "PLAY AGAIN";
	scoreEl.innerText = score;
	levelBar.style.width = levelProgress + '%';
	levelEl.innerText = 0;
	healthBar.style.width = healthProgress + '%';
	lastFrame = performance.now();
	nextFrame = performance.now() + 1000/60;
	for(let i = enemies.length - 1; i >= 0; i--) {
		if(enemies[i].deadly == 1) {
			enemies.splice(i, 1);
		}
	}
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

window.addEventListener('pointermove', (e) => {
	mouse.x = e.clientX;
	mouse.y = e.clientY;
});

// window.addEventListener('pointermove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; });

function animate() {
	if(started == 0) {
		ctx.fillStyle = "black";
		ctx.fillRect(0, 0, width, height);
		if(performance.now() - lastLost < 1000) {
			// ctx.putImageData(imageData, 0, height/2 * (performance.now() - lastLost)/1000, 0, 0, width, height * (1000 - performance.now() + lastLost)/1000);
			if(performance.now() - lastLost < 300) {
				ctx.drawImage(offscreen, 0, 0, width, height, 0, height/2 * (performance.now() - lastLost)/300 * 0.95, width, height - height * (performance.now() - lastLost)/300 * 0.9);
			} else {
				ctx.drawImage(offscreen, 0, 0, width, height, width/2 * (performance.now() - lastLost - 300)/700, height/2 * 0.95, width - width * (performance.now() - lastLost - 300)/700, height * 0.05);
			}
		}
	} else {
		ctx.shadowBlur = 20;
		timeScale = isDragging ? 0.2 : 1.0;
		if(blackAlerted == 0 && score >= 10) {
			alertedAt = Date.now();
			blackAlerted = 1;
			suspense();
		}
		if(blackAlerted == 1) {
			if(Date.now() - alertedAt > 7000) {
				ctx.fillStyle = 'rgba(39, 92, 118, 1)';
				blackAlerted = 2;
			} else {
				const ctxFillColor = 10 * Math.sin(Date.now() / 30) * Math.sin((Date.now() - alertedAt) / 7000 * Math.PI) * flashesEnabled;
				ctx.fillStyle = 'rgba(' + (39 + ctxFillColor) + ', ' + (92 + ctxFillColor) + ', ' + (118 + ctxFillColor) + ', 1)';
			}
		} else {
			ctx.fillStyle = 'rgba(39, 92, 118, 1)';
		}
		
		ctx.fillRect(0, 0, width, height);
		
		for(let i = enemies.length - 1; i >= 0; i--) {
			if(enemies[i].x < -100 || enemies[i].x > width + 100 || enemies[i].y < -100 || enemies[i].y > height + 100) {
				enemies.splice(i, 1);
			}
		}
		ctx.beginPath();
		ctx.shadowBlur = 0;
		ctx.lineWidth = 1;
		ctx.lineCap = "butt";
		ctx.strokeStyle = "black";
		for(let i = 0; i < gravityGrid.length - 1; i++) {
			for(let j = 0; j < gravityGrid[0].length - 1; j++) {
				tempX = gravityGrid[i][j][0];
				tempY = gravityGrid[i][j][1];
				enemies.forEach((en, k) => {
					if(en.deadly == 0) return;
					if((en.x - gravityGrid[i][j][0])**2 + (en.y - gravityGrid[i][j][1])**2 > 0) {
						tempX += (en.x - gravityGrid[i][j][0]) * Math.min(0.5, 200 * en.radius / ((en.x - gravityGrid[i][j][0])**2 + (en.y - gravityGrid[i][j][1])**2)**1.5);
						tempY += (en.y - gravityGrid[i][j][1]) * Math.min(0.5, 200 * en.radius / ((en.x - gravityGrid[i][j][0])**2 + (en.y - gravityGrid[i][j][1])**2)**1.5);
					}
				});
				gravityGrid[i][j][0] = tempX;
				gravityGrid[i][j][1] = tempY;
			}
		}
		for(let i = 0; i < gravityGrid.length - 1; i++) {
			for(let j = 0; j < gravityGrid[0].length - 1; j++) {
				enemies.forEach((en, k) => {
					if(en.deadly == 0) return;
					gravityGrid[i][j][2] = Math.max(gravityGrid[i][j][2], 1 - Math.sqrt((gravityGrid[i][j][0] - en.x)**2 + (gravityGrid[i][j][1] - en.y)**2)/en.radius/4);
				});
			}
		}
		for(let i = 0; i < gravityGrid.length - 1; i++) {
			for(let j = 0; j < gravityGrid[0].length - 1; j++) {
				ctx.strokeStyle = "rgba(20, 20, 20, " + gravityGrid[i][j][2] + ")";
				ctx.moveTo(gravityGrid[i][j][0], gravityGrid[i][j][1]);
				ctx.lineTo(gravityGrid[i][j + 1][0], gravityGrid[i][j + 1][1]);
				ctx.moveTo(gravityGrid[i][j][0], gravityGrid[i][j][1]);
				ctx.lineTo(gravityGrid[i + 1][j][0], gravityGrid[i + 1][j][1]);
				ctx.stroke();
				ctx.beginPath();
				gravityGrid[i][j][2] = 0;
			}
		}
		for(let i = 0; i < gravityGrid.length - 1; i++) {
			ctx.strokeStyle = "rgba(20, 20, 20, " + gravityGrid[i][gravityGrid[0].length - 1][2] + ")";
			ctx.moveTo(gravityGrid[i][gravityGrid[0].length - 1][0], gravityGrid[i][gravityGrid[0].length - 1][1]);
			ctx.lineTo(gravityGrid[i + 1][gravityGrid[0].length - 1][0], gravityGrid[i + 1][gravityGrid[0].length - 1][1]);
			ctx.stroke();
			ctx.beginPath();
		}
		for(let i = 0; i < gravityGrid[0].length - 1; i++) {
			ctx.strokeStyle = "rgba(20, 20, 20, " + gravityGrid[gravityGrid.length - 1][i][2] + ")";
			ctx.moveTo(gravityGrid[gravityGrid.length - 1][i][0], gravityGrid[gravityGrid.length - 1][i][1]);
			ctx.lineTo(gravityGrid[gravityGrid.length - 1][i + 1][0], gravityGrid[gravityGrid.length - 1][i + 1][1]);
			ctx.stroke();
			ctx.beginPath();
		}
		ctx.stroke();
		for(let i = 0; i < gravityGrid.length - 1; i++) {
			for(let j = 0; j < gravityGrid[0].length - 1; j++) {
				gravityGrid[i][j][0] = width / Math.ceil(width/36) * i;
				gravityGrid[i][j][1] = height / Math.ceil(height/36) * j;
			}
		}
		
		player.oldX = player.x;
		player.oldY = player.y;
		if(performance.now() <= lastPhysics) {
			lastPhysics = performance.now();
		} else {
			physicalDelta = performance.now() - lastPhysics;
			lastPhysics = performance.now();
			trueDelta = physicalDelta * timeScale * difficulty * 0.06;
			if(player.isLaunching) {
				player.x += player.vx * trueDelta;
				player.y += player.vy * trueDelta;
				player.vx *= 0.99**( trueDelta);
				player.vy *= 0.99**( trueDelta);
				if(player.x < 0 || player.x > width || player.y < 0 || player.y > height) {

					if(Math.random() < 0.05) {
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
			}

			enemies.forEach((en, i) => {
				en.update();
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
								currentAmbient = "none";
								document.getElementById('title-text').innerText = "FINAL STATS:\nLONGEST STREAK: " + longestStreak + "\nLEVEL: " + levelTotal;
								heartBeat.stop();
								tonePlayer.stop();
							}
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
					lowHealth.style.display = healthProgress <= 25 ? "inline" : "none";
					if (currentAmbient == "tone" && healthProgress <= 25) {
						heartBeat.stop();
						tonePlayer.stop();
						heartBeat.start(Tone.now());
						currentAmbient = "heart";
					}
					if (currentAmbient == "heart" && healthProgress > 25) {
						heartBeat.stop();
						tonePlayer.stop();
						tonePlayer.start(Tone.now());
						currentAmbient = "tone";
					}
					scoreEl.innerText = score;
					if(audioInitialized) en.deadly == 0 ? redOrb() : blackOrb();
					enemies[i].reset();
				} else if(en.deadly == 1 && dx*dx + dy*dy > 0) {
					player.vx -= dx * width * width / 10000 / (dx*dx + dy*dy)**1.5 * en.radius * trueDelta;
					player.vy -= dy * height * height / 10000 / (dx*dx + dy*dy)**1.5 * en.radius * trueDelta;
				}
			});
		}
		
		if(nextFrame - lastFrame > 0) {
			frameTimeEl.innerText = (nextFrame - lastFrame).toFixed(1);
			lastFrame = nextFrame;
		}
		nextFrame = performance.now();
		
		enemies.forEach((en, i) => {
			en.draw();
		});
		ctx.beginPath();
		ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
		ctx.fillStyle = player.color;
		ctx.shadowBlur = 20;
		ctx.shadowColor = player.color;
		ctx.fill();
		
		ctx.beginPath();
		ctx.shadowBlur = 10;
		ctx.moveTo(player.oldX, player.oldY);
		ctx.lineTo(player.x, player.y);
		ctx.lineWidth = 2 * player.radius;
		ctx.lineCap = "round";
		ctx.strokeStyle = player.color;
		ctx.stroke();
		
		if(Date.now() - lastTime > 1000 / difficulty) {
			enemies.push(new Enemy());
			lastTime = Date.now();
		}

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
		
		if(started == 0) {
			imageData = ctx.getImageData(0, 0, width, height);
			offscreen.getContext('2d').putImageData(imageData, 0, 0);
			lastLost = performance.now();
			setTimeout(() => { startEl.style.display = 'flex'; }, 1000);
		}
	}
		
    requestAnimationFrame(animate);
}

function resize() {
	width = canvas.width = window.innerWidth;
	height = canvas.height = window.innerHeight;
	offscreen.width = width;
	offscreen.height = height;
	gravityGrid = [];
	for(let i = 0; i <= Math.ceil(width/36); i++) {
		tempList = [];
		for(let j = 0; j <= Math.ceil(height/36); j++) {
			tempList.push([width / Math.ceil(width/36) * i, height / Math.ceil(height/36) * j, 0]);
		}
		gravityGrid.push(tempList);
	}
}
window.addEventListener('resize', resize);
resize();
player.x = width / 2;
player.y = height / 2;
animate();
