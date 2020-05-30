import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import ThreeOrbitControls from "three-orbit-controls";
const OrbitControls = ThreeOrbitControls(THREE);

export default props => {
    const mount = useRef();

    useEffect(() => {
        if (!mount.current) return;
        const width = 800;
        const height = 600;
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
        camera.position.set(20, 20, 20);
        camera.lookAt(0, 0, 0);
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setClearColor("#000000");
        renderer.setSize(width, height);
        mount.current.appendChild(renderer.domElement);
        scene.add(new THREE.AmbientLight(0xffffff, 0.4));
        const light = new THREE.DirectionalLight(0xffffff, 0.4);
        light.position.set(0, 1, 0);
        scene.add(light);
        const geometry = new THREE.SphereGeometry(0.2, 20, 20);
        const material = new THREE.MeshPhongMaterial({ color: "#ffffff" });
        new Array(10000).fill(true).forEach(() => {
            const sphere = new THREE.Mesh(geometry, material);
            sphere.position.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5);
            sphere.position.multiplyScalar(20);
            scene.add(sphere);
        });
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.5;
        const animate = () => {
            controls.update();
            renderer.render(scene, camera);
            requestAnimationFrame(animate);
        };
        animate();
    }, [mount]);

    return <div ref={mount} />;
};
