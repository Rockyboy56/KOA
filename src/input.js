const keys = {};
const mouse = { x: 0, y: 0, left: false, right: false, leftDown: false, rightDown: false };
let _canvas = null;

// Track single-frame presses
const justPressed = {};
let _shopClickHandler = null;

export function initInput(canvas) {
  _canvas = canvas;

  window.addEventListener('keydown', e => {
    if (!keys[e.code]) justPressed[e.code] = true;
    keys[e.code] = true;
  });
  window.addEventListener('keyup', e => { keys[e.code] = false; });

  canvas.addEventListener('mousemove', e => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    mouse.x = (e.clientX - rect.left) * scaleX;
    mouse.y = (e.clientY - rect.top) * scaleY;
  });

  canvas.addEventListener('mousedown', e => {
    e.preventDefault();
    if (e.button === 0) { mouse.left = true; mouse.leftDown = true; }
    if (e.button === 2) { mouse.right = true; mouse.rightDown = true; }
  });

  canvas.addEventListener('mouseup', e => {
    if (e.button === 0) mouse.left = false;
    if (e.button === 2) mouse.right = false;
  });

  canvas.addEventListener('contextmenu', e => e.preventDefault());
}

export function clearFrameInput() {
  mouse.leftDown = false;
  mouse.rightDown = false;
  for (const k in justPressed) delete justPressed[k];
}

export function isKeyDown(code) { return !!keys[code]; }
export function wasKeyPressed(code) { return !!justPressed[code]; }
export function getMouse() { return mouse; }

export function isMovingLeft()  { return keys['KeyA'] || keys['ArrowLeft']; }
export function isMovingRight() { return keys['KeyD'] || keys['ArrowRight']; }
export function isMovingUp()    { return keys['KeyW'] || keys['ArrowUp']; }
export function isMovingDown()  { return keys['KeyS'] || keys['ArrowDown']; }
export function isBlocking()    { return mouse.right || keys['ShiftLeft'] || keys['ShiftRight']; }
export function isAttacking()   { return mouse.leftDown || justPressed['Space']; }
export function isRepair()      { return keys['KeyF']; }
export function isRegroup()     { return !!justPressed['KeyG']; }
export function isPotion()      { return !!justPressed['Digit1']; }
