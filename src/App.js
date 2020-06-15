import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";

import Synthesizer from "./synthesizer";

export default props => {
    const mount = useRef();
    const [controls, setControls] = useState(null);
    const [scene, setScene] = useState(null);
    const [camera, setCamera] = useState(null);
    const [renderer, setRenderer] = useState(null);
    const [synthesizer, setSynthesizer] = useState(null);
    const [frame, setFrame] = useState(0);
    const [viewMode, setViewMode] = useState("ellipsoids");

    useEffect(() => {
        if (!mount.current) return;
        const width = 800;
        const height = 600;
        const sce = new THREE.Scene();
        const cam = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
        cam.position.set(2, 2, 2);
        cam.lookAt(0, 0, 0);
        const ren = new THREE.WebGLRenderer({ antialias: true });
        ren.setClearColor("#000000");
        ren.setSize(width, height);
        mount.current.appendChild(ren.domElement);
        sce.add(new THREE.AmbientLight(0xffffff, 0.4));
        const light = new THREE.DirectionalLight(0xffffff, 0.4);
        light.position.set(0, 1, 0);
        sce.add(light);
        const geometry = new THREE.SphereGeometry(1, 16, 16);
        const material = new THREE.MeshPhongMaterial({ color: "#ffffff" });
        const mesh = new THREE.Mesh(geometry, material);
        const synthesizer = new Synthesizer(sce, mesh);
        const ctrls = new OrbitControls(cam, ren.domElement);
        ctrls.enableDamping = true;
        ctrls.dampingFactor = 0.5;
        setControls(ctrls);
        setScene(sce);
        setCamera(cam);
        setRenderer(ren);
        setSynthesizer(synthesizer);
        window.setInterval(() => setFrame(frame => frame + 1), 1000 / 30);
    }, [mount]);

    useEffect(() => {
        if (controls) controls.update();
        if (renderer && scene && camera) renderer.render(scene, camera);
    }, [controls, renderer, scene, camera, frame]);

    return (
        <>
            <div ref={mount} />
            <button
                onClick={() => {
                    synthesizer.update();
                    setScene(synthesizer.draw(viewMode));
                }}>
                Grow
            </button>
            <button
                onClick={() => {
                    const vm = viewMode === "ellipsoids" ? "pipes" : "ellipsoids";
                    setViewMode(vm);
                    setScene(synthesizer.draw(vm));
                }}>
                View Mode: {viewMode}
            </button>
            <button
                onClick={() => {
                    try {
                        const link = document.createElement("a");
                        link.setAttribute("href", "data:text/obj;charset=utf-8," + synthesizer.exportFile());
                        link.setAttribute("download", "axons.obj");
                        window.document.body.appendChild(link);
                        link.click();
                        window.document.body.removeChild(link);
                    } catch (err) {
                        console.log(err);
                    }
                }}>
                Export
            </button>
        </>
    );
};
