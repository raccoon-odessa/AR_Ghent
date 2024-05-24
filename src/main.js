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

let modelCount = 3;
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
    camera.position.set(0, 1, -4);
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
    createUploadButton();
    addModelRotationControls();
}

function loadModels() {
    const loader = new GLTFLoader().setPath('3d/');
    let modelsLoaded = 0;

    for (let i = 0; i < modelCount; i++) {
        loader.load(`${i + 1}.glb`, function (glb) {
            let object = glb.scene;
            scaleModelToFitCube(object, 2);
            loadedModels[i] = object;
            scene.add(object);
            modelsLoaded++;
            if (modelsLoaded === modelCount) {
                initializeArray();
                updateCurrentModelIndex(true);
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
        let theta = index * angleStep;
        object.position.set(Math.cos(theta) * radius, 0, Math.sin(theta) * radius);
        object.lookAt(0, 0, 0);
        object.rotateY(Math.PI);
        console.log(`Initial Index: ${index}, Theta: ${theta}, Position: (${object.position.x}, ${object.position.y}, ${object.position.z})`);
    });
    updateCurrentModelIndex(true);
}

function rotateArray(direction) {
    if (isAnimating) return;

    isAnimating = true;
    console.log(`rotateArray called with direction: ${direction}, currentModelIndex: ${currentModelIndex}`);

    const angleStep = (Math.PI * 2) / modelCount;
    const targetRotation = direction * angleStep;

    loadedModels.forEach((object, index) => {
        const currentTheta = Math.atan2(object.position.z, object.position.x);
        const newTheta = currentTheta + targetRotation;
        const newPosition = {
            x: Math.cos(newTheta) * radius,
            z: Math.sin(newTheta) * radius
        };

        gsap.to(object.position, {
            duration: 1,
            x: newPosition.x,
            z: newPosition.z,
            onComplete: () => {
                if (index === modelCount - 1) {
                    isAnimating = false;
                    updateCurrentModelIndex();
                }
            }
        });

        console.log(`Rotating Model - Index: ${index}, New Theta: ${newTheta}, New Position: (${newPosition.x}, 0, ${newPosition.z})`);
    });
}

function updateCurrentModelIndex(resetCamera = false) {
    let minDistance = Infinity;
    let closestIndex = 0;

    loadedModels.forEach((object, index) => {
        const distance = camera.position.distanceTo(object.position);
        console.log(`Model Index: ${index}, Position: (${object.position.x}, ${object.position.y}, ${object.position.z}), Distance: ${distance}`);
        if (distance < minDistance) {
            minDistance = distance;
            closestIndex = index;
        }
    });

    currentModelIndex = closestIndex;
    current_object = loadedModels[currentModelIndex];

    console.log(`current_object updated: Model Index ${currentModelIndex}`);

    const leftModelIndex = (currentModelIndex - 1 + modelCount) % modelCount;
    const rightModelIndex = (currentModelIndex + 1) % modelCount;

    console.log(`Closest Model Index: ${currentModelIndex}`);
    console.log(`Rotating Model Index: ${currentModelIndex}`);
    console.log(`Left Model Index: ${leftModelIndex}`);
    console.log(`Right Model Index: ${rightModelIndex}`);

    if (resetCamera) {
        focusCameraOnModel(current_object);
    }
}

function focusCameraOnModel(model) {
    const box = new THREE.Box3().setFromObject(model);
    const center = new THREE.Vector3();
    box.getCenter(center);
    camera.position.set(center.x, center.y + 1, center.z - 5);
    camera.lookAt(center);
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

function createUploadButton() {
    const uploadButton = document.getElementById('uploadButton');
    const fileInput = document.getElementById('fileInput');

    uploadButton.onclick = () => {
        fileInput.click();
    };

    fileInput.onchange = (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const arrayBuffer = e.target.result;
                const newModelIndex = modelCount + 1;
                const fileName = `3d/${newModelIndex}.glb`;

                // Save file to server-side storage (not implemented in this example)
                // You need a backend to handle file uploads and saving to the "3d" folder

                // For this example, we assume the model is saved successfully
                loadNewModel(arrayBuffer, newModelIndex);
            };
            reader.readAsArrayBuffer(file);
        }
    };
}

function loadNewModel(arrayBuffer, index) {
    const loader = new GLTFLoader();
    loader.parse(arrayBuffer, '', (glb) => {
        let object = glb.scene;
        scaleModelToFitCube(object, 1);
        loadedModels.push(object);
        scene.add(object);
        modelCount++;
        initializeArray();
        updateCurrentModelIndex(true);
    });
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

            current_object.quaternion.multiplyQuaternions(deltaRotationQuaternion, current_object.quaternion);

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
