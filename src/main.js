import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { ARButton } from 'three/examples/jsm/webxr/ARButton.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

let container;
let camera, scene, renderer;
let controller;

let reticle, current_object, controls;

let hitTestSource = null;
let hitTestSourceRequested = false;

init();

$(".ar-object").click(function(){
    if(current_object !=null){
        scene.remove(current_object);
    }
    loadmodel($(this).attr("id"));
});

$("#ARButton").click(function(){
    current_object.visible = false;
});

function loadmodel(model){
    var loader = new GLTFLoader().setPath('3d/');
    loader.load(model + ".glb", function(glb){
        current_object = glb.scene;
        scene.add(current_object);

        var box = new THREE.Box3();
        box.setFromObject(current_object);
        box.getCenter(controls.target);
        controls.update();

        render();
    });
}

function init() {
    container = document.createElement('div');
    document.getElementById("container").appendChild(container);

    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 20);

    const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 3);
    light.position.set(0.5, 1, 0.25);
    scene.add(light);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.xr.enabled = true;
    container.appendChild(renderer.domElement);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.addEventListener('change', render);
    controls.minDistance = 0.5;
    controls.maxDistance = 3;
    controls.target.set(0, 0, -0.2);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;

    document.body.appendChild(ARButton.createButton(renderer, { requiredFeatures: ['hit-test'] }));

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

    window.addEventListener('resize', onWindowResize);
}

function onWindowResize() {
    if (!renderer.xr.isPresenting) { // Check if the VR device is not presenting
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }
}

function onSelect() {
    console.log("Selection event triggered.");
    if ( reticle.visible ) {
        current_object.position.setFromMatrixPosition(reticle.matrix);
        current_object.visible = true;
    }
}

function animate() {
    renderer.setAnimationLoop(render);
    requestAnimationFrame(animate);
    controls.update();
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
                var box = new THREE.Box3();
                box.setFromObject(current_object);
                box.center(controls.target);
            });

            hitTestSourceRequested = true;
        }

        if (hitTestSource) {
            const hitTestResults = frame.getHitTestResults(hitTestSource);
            console.log("Hit test results:", hitTestResults);
            if (hitTestResults.length) {
                const hit = hitTestResults[0];
                reticle.visible = true;
                reticle.matrix.fromArray(hit.getPose(referenceSpace).transform.matrix);
                console.log("Reticle matrix:", reticle.matrix);
            } else {
                reticle.visible = false;
            }
        }
    }
    renderer.render(scene, camera);
}

animate();