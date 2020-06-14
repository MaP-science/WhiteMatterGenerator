import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { OBJExporter } from "three/examples/jsm/exporters/OBJExporter";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { MarchingCubes } from "three/examples/jsm/objects/MarchingCubes";

import Synthesizer from "./synthesizer";

const addEllipsoid = (mc, ballx, bally, ballz, strength, subtract, colors) => {
    var sign = Math.sign(strength);
    strength = Math.abs(strength);
    var userDefineColor = !(colors === undefined || colors === null);
    var ballColor = new THREE.Color(ballx, bally, ballz);
    if (userDefineColor) {
        try {
            ballColor =
                colors instanceof THREE.Color
                    ? colors
                    : Array.isArray(colors)
                    ? new THREE.Color(
                          Math.min(Math.abs(colors[0]), 1),
                          Math.min(Math.abs(colors[1]), 1),
                          Math.min(Math.abs(colors[2]), 1)
                      )
                    : new THREE.Color(colors);
        } catch (err) {
            ballColor = new THREE.Color(ballx, bally, ballz);
        }
    }

    var radius = mc.size * Math.sqrt(strength / subtract),
        zs = ballz * mc.size,
        ys = bally * mc.size,
        xs = ballx * mc.size;

    var min_z = Math.floor(zs - radius);
    if (min_z < 1) min_z = 1;
    var max_z = Math.floor(zs + radius);
    if (max_z > mc.size - 1) max_z = mc.size - 1;
    var min_y = Math.floor(ys - radius);
    if (min_y < 1) min_y = 1;
    var max_y = Math.floor(ys + radius);
    if (max_y > mc.size - 1) max_y = mc.size - 1;
    var min_x = Math.floor(xs - radius);
    if (min_x < 1) min_x = 1;
    var max_x = Math.floor(xs + radius);
    if (max_x > mc.size - 1) max_x = mc.size - 1;

    // Don't polygonize in the outer layer because normals aren't
    // well-defined there.

    var x, y, z, y_offset, z_offset, fx, fy, fz, fz2, fy2, val;
    for (z = min_z; z < max_z; z++) {
        z_offset = mc.size2 * z;
        fz = z / mc.size - ballz;
        fz2 = fz * fz;

        for (y = min_y; y < max_y; y++) {
            y_offset = z_offset + mc.size * y;
            fy = y / mc.size - bally;
            fy2 = fy * fy;

            for (x = min_x; x < max_x; x++) {
                fx = x / mc.size - ballx;
                val = strength / (0.000001 + fx * fx + fy2 + fz2) - subtract;
                if (val > 0.0) {
                    mc.field[y_offset + x] += val * sign;

                    // optimization
                    // http://www.geisswerks.com/ryan/BLOBS/blobs.html
                    const ratio = Math.sqrt((x - xs) * (x - xs) + (y - ys) * (y - ys) + (z - zs) * (z - zs)) / radius;
                    const contrib = 1 - ratio * ratio * ratio * (ratio * (ratio * 6 - 15) + 10);
                    mc.palette[(y_offset + x) * 3 + 0] += ballColor.r * contrib;
                    mc.palette[(y_offset + x) * 3 + 1] += ballColor.g * contrib;
                    mc.palette[(y_offset + x) * 3 + 2] += ballColor.b * contrib;
                }
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
    synthesizer.axons.forEach(axon => {
        const mc = new MarchingCubes(20, new THREE.MeshPhongMaterial({ color: "#ffffff" }), true, false);
        axon.joints.forEach(joint => {
            const pos = joint.pos.clone();
            const gridMin = synthesizer.gridSize.clone().multiplyScalar(-1 / 2);
            pos.sub(gridMin).divide(synthesizer.gridSize);
            addEllipsoid(mc, pos.x, pos.y, pos.z, joint.shape.elements[0] ** 2, 1);
        });
        scene.add(new THREE.Mesh(mc.generateBufferGeometry(), new THREE.MeshPhongMaterial({ color: "#ffffff" })));
    });
    const exporter = new OBJExporter();
    try {
        const data = exporter.parse(scene, {});
        console.log(data);
        return scene;
    } catch {}
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
        const geometry = new THREE.SphereGeometry(1, 5, 5);
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
            //renderer.render(scene, camera);
            const s = exportFile(synthesizer);
            try {
                renderer.render(s, camera);
            } catch {}
            const fps = 60;
            setTimeout(() => requestAnimationFrame(animate), 1000 / fps);
        };
        animate();
    }, [mount]);

    return <div ref={mount} />;
};
