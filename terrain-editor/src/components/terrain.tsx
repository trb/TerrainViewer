import * as React from 'react';
import * as THREE from 'three';
import {HeightMap} from '../lib/heightmap';
import {Vector3} from "three";

const UINT16_MAX_VALUE = 65535;

enum Keys {
    W = 87,
    A = 65,
    S = 83,
    D = 68,
    R = 82,
    LEFTSHIFT = 16,
    LEFTCONTROL = 17,
    LEFTALT = 18,
    SPACE = 32
}

interface MousePosition {
    x: number,
    y: number
}

interface MouseDelta {
    x: number,
    y: number
}

interface Mouse {
    position?: MousePosition,
    delta?: MouseDelta,
    sensitivity: number
}

interface TerrainProps {
    heightMap: HeightMap
}

export class Terrain extends React.Component<TerrainProps> {
    mount: HTMLDivElement;

    scene: THREE.Scene;
    camera: THREE.Camera;
    renderer: THREE.WebGLRenderer;
    mesh: THREE.Mesh;
    geometry: THREE.Geometry;
    light: THREE.DirectionalLight;

    mouse: Mouse;

    frameId: number;

    keysPressed: Keys[];

    movement: THREE.Vector3;
    movementScale: number;

    constructor(props: TerrainProps) {
        super(props);
    }

    componentDidMount() {
        this.movement = new THREE.Vector3();
        this.movementScale = 1;

        this.keysPressed = [];
        this.mouse = {position: undefined, delta: undefined, sensitivity: 3};

        const renderWidth = this.mount.clientWidth;
        const renderHeight = this.mount.clientHeight;

        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, renderWidth / renderHeight, 0.1, 10000);
        this.renderer = new THREE.WebGLRenderer({antialias: true});

        const segments = 1024;
        this.geometry = new THREE.PlaneGeometry(segments, segments, segments, segments);
        const material = new THREE.MeshPhongMaterial({
            color: 0xdddddd,
            side: THREE.DoubleSide,
            shininess: 0
        });

        this.props.heightMap.imageData.subscribe(([imageData, metaData]) => {
            const pixels = metaData.width;
            const ratio = Math.floor(pixels / segments);
            this.geometry.scale(metaData.width / segments, metaData.width / segments, 1);

            for (let y = 0; y < segments; ++y) {
                for (let x = 0; x < segments; ++x) {
                    const vertIndex = y * segments + x;
                    const pixelY = y * segments * (ratio ** 2);
                    const pixelX = x * ratio;

                    const pixelIndex = pixelY + pixelX;
                    this.geometry.vertices[vertIndex].z = (imageData[pixelIndex * 4] / UINT16_MAX_VALUE) * 280;
                }
            }

            this.geometry.computeFaceNormals();
            this.geometry.computeVertexNormals();

            this.geometry.verticesNeedUpdate = true;
            this.geometry.normalsNeedUpdate = true;
        });

        this.mesh = new THREE.Mesh(this.geometry, material);
        this.mesh.receiveShadow = true;
        this.mesh.castShadow = true;

        this.light = new THREE.DirectionalLight(0xffffff, 1);
        this.light.position.set(500, -500, 100);
        this.light.target.position.copy(new THREE.Vector3(200, 200, -100));
        this.light.castShadow = true;
        this.scene.add(this.light.target);
        this.scene.add(this.light);

        const globalLight = new THREE.HemisphereLight(0xeeeeff, 0x222222, 0.3);
        this.scene.add(globalLight);

        this.scene.add(this.mesh);
        this.camera.position.z = 1000;
        this.camera.position.y = -1000;

        this.camera.rotation.x = 0.6;

        this.renderer.setSize(renderWidth, renderHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        const helper = new THREE.CameraHelper(this.light.shadow.camera);
        this.scene.add(helper);

        this.mount.appendChild(this.renderer.domElement);
        this.animate();

        window.document.addEventListener('keydown', this.handleKeyDown);
        window.document.addEventListener('keyup', this.handleKeyUp);
        this.mount.addEventListener('mousemove', this.handleMouseMove);
    }

    handleMouseMove = (event: MouseEvent) => {
        // do this: https://github.com/mrdoob/three.js/blob/master/examples/js/controls/TrackballControls.js#L158
        // if (this.keysPressed.indexOf(Keys.LEFTALT) > -1) {
        console.log('e', event.buttons);
        if (event.buttons == 2) {
            if (this.mouse.position) {
                this.mouse.delta = {
                    // invert x for easier delta processing
                    x: (this.mouse.position.x - event.clientX) * -1,
                    y: this.mouse.position.y - event.clientY
                }
            }
        } else {
            this.mouse.delta = undefined;
        }

        this.mouse.position = {
            x: event.clientX,
            y: event.clientY
        };

        // only update camera when mouse was moved. make mouse delta available
        // for other uses though
        if (this.mouse.delta) {
            const rotationX = this.mouse.delta.y / (1000 / this.mouse.sensitivity);
            const rotationY = this.mouse.delta.x / (1000 / this.mouse.sensitivity);

            console.log('x, y', rotationX, rotationY);

            const rotation = new THREE.Quaternion();

            this.camera.quaternion.multiply(rotation.normalize());
        }
    };

    handleKeyDown = (event: KeyboardEvent) => {
        switch (event.which) {
            case Keys.W:
                // Ctrl + W is a shortcut to close electron
                event.preventDefault();
            case Keys.A:
            case Keys.S:
            case Keys.D:
            case Keys.LEFTSHIFT:
            case Keys.LEFTCONTROL:
            case Keys.LEFTALT:
            case Keys.SPACE:
            case Keys.R:
                if (this.keysPressed.indexOf(event.which) < 0) {
                    this.keysPressed.push(event.which);
                }
                break;

        }
    };

    handleKeyUp = (event: KeyboardEvent) => {
        event.preventDefault();
        const index = this.keysPressed.indexOf(event.which);
        if (index > -1) {
            this.keysPressed.splice(index, 1);
        }
    };

    animate = () => {
        this.renderScene();
        this.frameId = window.requestAnimationFrame(this.animate);

        if (this.keysPressed.length > 0) {
            this.movement.set(0, 0, 0);
            this.movementScale = 1;


            let movementKeysPressed = false;
            for (let i = 0; i < this.keysPressed.length; ++i) {
                switch (this.keysPressed[i]) {
                    case Keys.W:
                        this.movement.add(this.camera.getWorldDirection(new Vector3()).setZ(0));
                        movementKeysPressed = true;
                        break;
                    case Keys.S:
                        this.movement.add(this.camera.getWorldDirection(new Vector3()).setZ(0).negate());
                        movementKeysPressed = true;
                        break;
                    case Keys.A:
                        this.movement.add(this.camera.getWorldDirection(new Vector3()).setZ(0).applyAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2));
                        movementKeysPressed = true;
                        break;
                    case Keys.D:
                        this.movement.add(this.camera.getWorldDirection(new Vector3()).setZ(0).applyAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2).negate());
                        movementKeysPressed = true;
                        break;
                    case Keys.LEFTSHIFT:
                        this.movement.setZ(1);
                        movementKeysPressed = true;
                        break;
                    case Keys.LEFTCONTROL:
                        this.movement.setZ(-1);
                        movementKeysPressed = true;
                        break;
                    case Keys.SPACE:
                        this.movementScale = 3;
                        break;
                }
            }

            if (movementKeysPressed) {
                this.camera.position.add(this.movement.normalize().multiplyScalar(this.movementScale * 3));
            }

        }

        if (this.keysPressed.indexOf(Keys.R) > -1) {
            this.camera.rotation.x = 0.6;
            this.camera.rotation.y = 0.6;
            this.camera.rotation.z = 0.6;
        }
    };

    renderScene() {
        this.renderer.render(this.scene, this.camera);
    }

    render() {
        return (
            <div
                style={{width: '1200px', height: '1200px'}}
                ref={(mount) => this.mount = mount!}>
            </div>
        );
    }
}