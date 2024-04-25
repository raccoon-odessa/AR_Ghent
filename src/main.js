import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { ARButton } from 'three/examples/jsm/webxr/ARButton.js';

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

const controls = new OrbitControls(camera, renderer.domElement); // Initialize OrbitControls
camera.position.set(0, 0.2, 0.2);

const light = new THREE.AmbientLight(0x404040, 100);
scene.add(light);

const loader = new GLTFLoader();
loader.load('./static/skull/skull.glb', function(gltf) {
    scene.add(gltf.scene);
    renderer.render(scene, camera);
}, undefined, function(error) {
    console.error(error);
});

// Add ARButton to the document
document.body.appendChild(ARButton.createButton(renderer, { requiredFeatures: ['hit-test'] }));

const sizes = {
    width: window.innerWidth,
    height: window.innerHeight
};

function animate() {
    requestAnimationFrame(animate);
    controls.update(); // Update controls every frame
    renderer.render(scene, camera);
}

animate();

// Event listener to handle the XR session start
document.addEventListener('click', async () => {
    try {
        await navigator.xr.requestSession('immersive-ar', { requiredFeatures: ['hit-test'] });
        // Start your XR session and integrate your Three.js scene with WebXR here...
    } catch (error) {
        console.error('Error starting XR session:', error);
    }
});

// Resize event handler
window.addEventListener('resize', () => {
    sizes.width = window.innerWidth;
    sizes.height = window.innerHeight;

    camera.aspect = sizes.width / sizes.height;
    camera.updateProjectionMatrix();

    renderer.setSize(sizes.width, sizes.height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.render(scene, camera);
});

// Double click event handler
window.addEventListener('dblclick', () => {
    if (!document.fullscreenElement) {
        renderer.domElement.requestFullscreen();
    } else {
        document.exitFullscreen();
    }
});