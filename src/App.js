import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { OBJExporter } from "three/examples/jsm/exporters/OBJExporter";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { MarchingCubes } from "three/examples/jsm/objects/MarchingCubes";

import Synthesizer from "./synthesizer";

const addEllipsoid = (mc, pos, shape, min, max) => {
    const metaballSize = Math.sqrt(2); // Between sqrt(2) and 2
    for (let x = min.x; x < max.x; x++) {
        for (let y = min.y; y < max.y; y++) {
            for (let z = min.z; z < max.z; z++) {
                if (x < 0 || x >= mc.size) continue;
                if (y < 0 || y >= mc.size) continue;
                if (z < 0 || z >= mc.size) continue;
                const p = new THREE.Vector3(x, y, z).divideScalar(mc.size).sub(pos);
                p.applyMatrix3(new THREE.Matrix3().getInverse(shape));
                const val = metaballSize / (0.000001 + p.dot(p)) - 1;
                if (val > 0) mc.field[mc.size2 * z + mc.size * y + x] += val;
            }
        }
    }
};

const exportFile = synthesizer => {
    const scene = new THREE.Scene();
    scene.add(new THREE.AmbientLight(0xffffff, 0.4));
    const light = new THREE.DirectionalLight(0xffffff, 0.4);
    light.position.set(0, 1, 0);
    scene.add(light);
    synthesizer.axons.forEach((axon, i) => {
        console.log("Adding axon " + i);
        const mc = new MarchingCubes(64, new THREE.MeshPhongMaterial({ color: "#ffffff" }), true, false);
        mc.isolation = 1;
        axon.joints.forEach(joint => {
            const bb = joint.boundingBox();
            addEllipsoid(
                mc,
                joint.pos.clone().divide(synthesizer.voxelSize).add(new THREE.Vector3(0.5, 0.5, 0.5)),
                joint.shape.clone().multiplyScalar(1 / synthesizer.voxelSize.x),
                bb.min
                    .divide(synthesizer.voxelSize)
                    .add(new THREE.Vector3(0.5, 0.5, 0.5))
                    .multiplyScalar(mc.size)
                    .floor()
                    .max(new THREE.Vector3(0, 0, 0)),
                bb.max
                    .divide(synthesizer.voxelSize)
                    .add(new THREE.Vector3(0.5, 0.5, 0.5))
                    .multiplyScalar(mc.size)
                    .ceil()
                    .min(new THREE.Vector3(mc.size, mc.size, mc.size))
            );
        });
        scene.add(
            new THREE.Mesh(
                mc
                    .generateBufferGeometry()
                    .scale(synthesizer.voxelSize.x / 2, synthesizer.voxelSize.y / 2, synthesizer.voxelSize.z / 2),
                new THREE.MeshPhongMaterial({ color: "#ffffff" })
            )
        );
    });
    const exporter = new OBJExporter();
    try {
        console.log("Parsing");
        const data = exporter.parse(scene, {});
        console.log("Done");
        console.log(data);
    } catch (err) {
        console.log(err);
    }
    return scene;
};

export default props => {
    const mount = useRef();

    useEffect(() => {
        if (!mount.current) return;
        const width = 800;
        const height = 600;
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
        camera.position.set(2, 2, 2);
        camera.lookAt(0, 0, 0);
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setClearColor("#000000");
        renderer.setSize(width, height);
        mount.current.appendChild(renderer.domElement);
        scene.add(new THREE.AmbientLight(0xffffff, 0.4));
        const light = new THREE.DirectionalLight(0xffffff, 0.4);
        light.position.set(0, 1, 0);
        scene.add(light);
        const geometry = new THREE.SphereGeometry(1, 16, 16);
        const material = new THREE.MeshPhongMaterial({ color: "#ffffff" });
        const mesh = new THREE.Mesh(geometry, material);
        const synthesizer = new Synthesizer(scene, mesh);
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.5;
        renderer.render(scene, camera);
        const animate = () => {
            controls.update();
            synthesizer.update();
            synthesizer.draw();
            if (Date.now() % 8000 < 7000) renderer.render(scene, camera);
            else {
                const s = exportFile(synthesizer);
                /*try {
                    renderer.render(s, camera);
                } catch (err) {
                    console.log(err);
                }*/
            }
            const fps = 60;
            setTimeout(() => requestAnimationFrame(animate), 1000 / fps);
        };
        animate();
    }, [mount]);

    return <div ref={mount} />;
};
