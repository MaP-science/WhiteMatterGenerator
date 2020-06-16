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
    const [volumeFraction, setVolumeFraction] = useState(0);
    const [axonCount, setAxonCount] = useState(20);
    const [jointCount, setJointCount] = useState(20);
    const [growSpeed, setGrowSpeed] = useState(0.01);
    const [growRepeat, setGrowRepeat] = useState(10);
    const [contractSpeed, setContractSpeed] = useState(0.01);

    useEffect(() => {
        if (!mount.current) return;
        const width = 640;
        const height = 480;
        // Camera
        const cam = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
        cam.position.set(2, 2, 2);
        cam.lookAt(0, 0, 0);
        setCamera(cam);
        // Renderer
        const ren = new THREE.WebGLRenderer({ antialias: true });
        ren.setClearColor("#000000");
        ren.setSize(width, height);
        mount.current.appendChild(ren.domElement);
        setRenderer(ren);
        // Controls
        const ctrls = new OrbitControls(cam, ren.domElement);
        ctrls.enableDamping = true;
        ctrls.dampingFactor = 0.5;
        setControls(ctrls);
        // Animate
        window.setInterval(() => setFrame(frame => frame + 1), 1000 / 30);
    }, [mount]);

    useEffect(() => {
        if (controls) controls.update();
        if (renderer && scene && camera) renderer.render(scene, camera);
    }, [controls, renderer, scene, camera, frame]);

    return (
        <>
            <div ref={mount} />
            <p>Setup:</p>
            <label>Number of axons: </label>
            <input type="number" value={axonCount} onChange={e => setAxonCount(Number(e.target.value))} />
            <br />
            <label>Number of joints per axon: </label>
            <input type="number" value={jointCount} onChange={e => setJointCount(Number(e.target.value))} />
            <br />
            <button
                onClick={() => {
                    const s = new Synthesizer(axonCount, jointCount);
                    setSynthesizer(s);
                    setScene(s.draw(viewMode));
                }}>
                Initialize
            </button>
            {synthesizer && (
                <>
                    <p>After setup:</p>
                    <label>Grow speed: </label>
                    <input type="number" value={growSpeed} onChange={e => setGrowSpeed(Number(e.target.value))} />
                    <br />
                    <label>Grow repeat: </label>
                    <input type="number" value={growRepeat} onChange={e => setGrowRepeat(Number(e.target.value))} />
                    <br />
                    <label>Contract speed: </label>
                    <input
                        type="number"
                        value={contractSpeed}
                        onChange={e => setContractSpeed(Number(e.target.value))}
                    />
                    <br />
                    <button
                        onClick={() => {
                            setVolumeFraction(synthesizer.update(growSpeed, growRepeat, contractSpeed));
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
                        Export as pipes
                    </button>
                    <div>Volume fraction: {100 * volumeFraction}%</div>
                    <br />
                </>
            )}
        </>
    );
};
