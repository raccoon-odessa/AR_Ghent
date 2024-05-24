import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { ARButton } from 'three/examples/jsm/webxr/ARButton.js';
import gsap from 'gsap';

let container;
let camera, scene, renderer;
let controller;
let reticle, current_object;
let hitTestSource = null;
let hitTestSourceRequested = false;

const modelCount = 6;
let loadedModels = [];
let currentModelIndex = 0;
const radius = 3;
let isAnimating = false;

init();
animate();

function init() {
    container = document.createElement('div');
    document.body.appendChild(container);

    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 20);
    camera.position.set(0, 1, -5);
    camera.lookAt(0, 0, 0);

    const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 3);
    scene.add(light);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.xr.enabled = true;
    container.appendChild(renderer.domElement);

    const arButton = ARButton.createButton(renderer, { requiredFeatures: ['hit-test'] });
    arButton.classList.add('ar-button');
    document.body.appendChild(arButton);

    controller = renderer.xr.getController(0);
    controller.addEventListener('select', onSelect);
    scene.add(controller);

    reticle = new THREE.Mesh(
        new THREE.RingGeometry(0.15, 0.2, 32).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial()
    );
    reticle.matrixAutoUpdate = false;
    reticle.visible = false;
    scene.add(reticle);

    loadModels();
    window.addEventListener('resize', onWindowResize);

    document.addEventListener('keydown', function (event) {
        if (!isAnimating) {
            if (event.key === "ArrowRight") {
                console.log('Right button pressed');
                rotateArray(1);
            } else if (event.key === "ArrowLeft") {
                console.log('Left button pressed');
                rotateArray(-1);
            }
        }
    });

    createNavigationButtons();
    addModelRotationControls();
}

function loadModels() {
    const loader = new GLTFLoader().setPath('3d/');
    let modelsLoaded = 0;

    for (let i = 0; i < modelCount; i++) {
        loader.load(`${i + 1}.glb`, function (glb) {
            let object = glb.scene;
            scaleModelToFitCube(object, 1);
            loadedModels[i] = object;
            modelsLoaded++;
            if (modelsLoaded === modelCount) {
                initializeArray();
                updateCurrentModelIndex();
            }
        });
    }
}

function scaleModelToFitCube(model, size) {
    const box = new THREE.Box3().setFromObject(model);
    const boxSize = new THREE.Vector3();
    box.getSize(boxSize);
    const maxDim = Math.max(boxSize.x, boxSize.y, boxSize.z);
    const scale = size / maxDim;
    model.scale.set(scale, scale, scale);
}

function initializeArray() {
    const angleStep = (Math.PI * 2) / modelCount;
    loadedModels.forEach((object, index) => {
        let theta = (index * angleStep) + (angleStep / 2);
        object.position.set(Math.cos(theta) * radius, 0, Math.sin(theta) * radius);
        object.lookAt(0, 0, 0);
        object.rotateY(Math.PI);
        scene.add(object);
    });
    updateCurrentModelIndex();
}

function rotateArray(direction) {
    if (isAnimating) return;

    isAnimating = true;

    if (direction === 1) {
        rotateArrayClockwise().then(() => {
            isAnimating = false;
            updateCurrentModelIndex();
        });
    } else if (direction === -1) {
        rotateArrayCounterClockwise().then(() => {
            isAnimating = false;
            updateCurrentModelIndex();
        });
    }
}

function rotateArrayClockwise() {
    currentModelIndex = (currentModelIndex + 1) % modelCount;

    const angleStep = (Math.PI * 2) / modelCount;
    const animations = loadedModels.map((object, index) => {
        let theta = ((index - currentModelIndex + modelCount) % modelCount) * angleStep + (angleStep / 2);
        return gsap.to(object.position, {
            duration: 1,
            x: Math.cos(theta) * radius,
            z: Math.sin(theta) * radius,
        });
    });

    console.log(`Rotate Clockwise: New Index ${currentModelIndex}`);
    return Promise.all(animations.map(anim => anim.then()));
}

function rotateArrayCounterClockwise() {
    currentModelIndex = (currentModelIndex - 1 + modelCount) % modelCount;

    const angleStep = (Math.PI * 2) / modelCount;
    const animations = loadedModels.map((object, index) => {
        let theta = ((index - currentModelIndex + modelCount) % modelCount) * angleStep + (angleStep / 2);
        return gsap.to(object.position, {
            duration: 1,
            x: Math.cos(theta) * radius,
            z: Math.sin(theta) * radius,
        });
    });

    console.log(`Rotate Counter-Clockwise: New Index ${currentModelIndex}`);
    return Promise.all(animations.map(anim => anim.then()));
}

function updateCurrentModelIndex() {
    let minDistance = Infinity;
    let closestIndex = 0;

    loadedModels.forEach((object, index) => {
        const distance = camera.position.distanceTo(object.position);
        if (distance < minDistance) {
            minDistance = distance;
            closestIndex = index;
        }
    });

    currentModelIndex = closestIndex;

    const leftModelIndex = (currentModelIndex - 1 + modelCount) % modelCount;
    const rightModelIndex = (currentModelIndex + 1) % modelCount;

    console.log(`Closest Model Index: ${currentModelIndex}`);
    console.log(`Rotating Model Index: ${currentModelIndex}`);
    console.log(`Left Model Index: ${leftModelIndex}`);
    console.log(`Right Model Index: ${rightModelIndex}`);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function onSelect() {
    if (reticle.visible && current_object) {
        current_object.position.setFromMatrixPosition(reticle.matrix);
        current_object.visible = true;
    }
}

function animate() {
    renderer.setAnimationLoop(render);
}

function render(timestamp, frame) {
    if (frame) {
        const referenceSpace = renderer.xr.getReferenceSpace();
        const session = renderer.xr.getSession();

        if (!hitTestSourceRequested) {
            session.requestReferenceSpace('viewer').then(function (referenceSpace) {
                session.requestHitTestSource({ space: referenceSpace }).then(function (source) {
                    hitTestSource = source;
                });
            });

            session.addEventListener('end', function () {
                hitTestSourceRequested = false;
                hitTestSource = null;
                reticle.visible = false;
            });

            hitTestSourceRequested = true;
        }

        if (hitTestSource) {
            const hitTestResults = frame.getHitTestResults(hitTestSource);
            if (hitTestResults.length) {
                const hit = hitTestResults[0];
                reticle.visible = true;
                reticle.matrix.fromArray(hit.getPose(referenceSpace).transform.matrix);
            } else {
                reticle.visible = false;
            }
        }
    }
    renderer.render(scene, camera);
}

function createNavigationButtons() {
    const leftButton = document.getElementById('leftButton');
    const rightButton = document.getElementById('rightButton');

    leftButton.onclick = () => {
        if (!isAnimating) {
            console.log('Left button pressed');
            rotateArray(-1);
        }
    };
    rightButton.onclick = () => {
        if (!isAnimating) {
            console.log('Right button pressed');
            rotateArray(1);
        }
    };
}

function addModelRotationControls() {
    let isDragging = false;
    let previousMousePosition = {
        x: 0,
        y: 0
    };

    renderer.domElement.addEventListener('mousedown', function (e) {
        isDragging = true;
        previousMousePosition = {
            x: e.offsetX,
            y: e.offsetY
        };
    });

    renderer.domElement.addEventListener('mousemove', function (e) {
        if (isDragging) {
            const deltaMove = {
                x: e.offsetX - previousMousePosition.x,
                y: e.offsetY - previousMousePosition.y
            };

            const deltaRotationQuaternion = new THREE.Quaternion()
                .setFromEuler(new THREE.Euler(
                    THREE.MathUtils.degToRad(deltaMove.y * 0.1),
                    THREE.MathUtils.degToRad(deltaMove.x * 0.1),
                    0,
                    'XYZ'
                ));

            loadedModels[currentModelIndex].quaternion.multiplyQuaternions(deltaRotationQuaternion, loadedModels[currentModelIndex].quaternion);

            previousMousePosition = {
                x: e.offsetX,
                y: e.offsetY
            };
        }
    });

    renderer.domElement.addEventListener('mouseup', function (e) {
        isDragging = false;
    });

    renderer.domElement.addEventListener('mouseleave', function (e) {
        isDragging = false;
    });
}
