import {
    addMatrix3,
    collisionAxis,
    deform,
    extremum,
    hexColorToVector,
    mat3ToMat4,
    randomDirection,
    randomHexColor,
    valueToColor
} from "./helperFunctions.js";

import THREE from "./three.js";
import plyParser from "./plyParser.js";
import { v4 } from "uuid";

const { Vector3, Matrix3, Box3, SphereGeometry, Mesh, MeshToonMaterial, BufferGeometry } = THREE;

const createEllipsoid = (pos, radius, deformation, minDiameter, movement, color, generateMesh) => {
    const ellipsoid = {
        pos: pos.clone(),
        radius,
        deformation,
        minDiameter,
        movement,
        id: v4(),
        shape: new Matrix3().multiplyScalar(minDiameter.map(radius * 2) / 2),
        color: color || randomHexColor(),
        axisCache: {}
    };
    const dispose = () => {
        if (!ellipsoid.mesh) return;
        ellipsoid.mesh.geometry.dispose();
        ellipsoid.mesh.material.dispose();
    };
    const clone = () => {
        const result = createEllipsoid(
            ellipsoid.pos,
            ellipsoid.radius,
            ellipsoid.deformation,
            ellipsoid.minDiameter,
            ellipsoid.movement,
            ellipsoid.color,
            !!ellipsoid.mesh
        );
        result.shape = ellipsoid.shape;
        return result;
    };
    const boundingBoxD = minDist => {
        const x = extremum(ellipsoid.shape, new Vector3(1, 0, 0)).dot(new Vector3(1, 0, 0));
        const y = extremum(ellipsoid.shape, new Vector3(0, 1, 0)).dot(new Vector3(0, 1, 0));
        const z = extremum(ellipsoid.shape, new Vector3(0, 0, 1)).dot(new Vector3(0, 0, 1));
        return new Vector3(x + minDist / 2, y + minDist / 2, z + minDist / 2);
    };
    const boundingBox = minDist => {
        const d = boundingBoxD(minDist);
        return new Box3(ellipsoid.pos.clone().sub(d), ellipsoid.pos.clone().add(d));
    };
    const containsPoint = p => {
        return p.clone().sub(ellipsoid.pos).applyMatrix3(new Matrix3().getInverse(ellipsoid.shape)).length() < 1;
    };
    const keepInVoxel = (voxelSize, minDist, entireCell) => {
        if (entireCell) {
            const bb = new Vector3().fromArray(
                boundingBoxD(minDist)
                    .toArray()
                    .map(v => v + minDist)
            );
            ellipsoid.pos.fromArray(
                ellipsoid.pos.toArray().map((v, i) => {
                    const s = voxelSize.getComponent(i) / 2 - bb.getComponent(i);
                    return Math.min(Math.max(v, -s), s);
                })
            );
        } else {
            ellipsoid.pos.fromArray(
                ellipsoid.pos
                    .toArray()
                    .map((v, i) => Math.min(Math.max(v, -voxelSize.getComponent(i) / 2), voxelSize.getComponent(i) / 2))
            );
        }
    };
    const collision = (ell, minDist, maxOverlap) => {
        const d = ell.pos.clone().sub(ellipsoid.pos);
        const dSqr = d.dot(d);
        if (dSqr < 0.00001) {
            const r = randomDirection().multiplyScalar(0.0001);
            ellipsoid.pos.sub(r);
            ell.pos.add(r);
            return;
        }
        let [axisLength, axis] = collisionAxis(
            ellipsoid.pos,
            ellipsoid.shape,
            ell.pos,
            ell.shape,
            ellipsoid.axisCache[ell.id],
            maxOverlap
        );
        ellipsoid.axisCache[ell.id] = axis;
        axisLength += minDist;
        if (axisLength < 0) return;
        const ratio = ell.radius / ellipsoid.radius;
        // Collision resolution
        // Update shape
        const c1 = extremum(ellipsoid.shape, axis).dot(axis);
        const c2 = extremum(ell.shape, axis).dot(axis);
        const delta1 = (ellipsoid.deformation.map(c1 * 2) / (c1 * 2)) * Math.min(ratio, 1);
        const delta2 = (ell.deformation.map(c2 * 2) / (c2 * 2)) * Math.min(1 / ratio, 1);
        const mu1 = ellipsoid.minDiameter.map(ellipsoid.radius * 2) / (c1 * 2);
        const mu2 = ell.minDiameter.map(ell.radius * 2) / (c2 * 2);
        const s1 = Math.max(-axisLength * delta1, mu1 - 1);
        const s2 = Math.max(-axisLength * delta2, mu2 - 1);
        deform(ellipsoid.shape, axis, s1);
        deform(ell.shape, axis, s2);
        axisLength += s1 * c1 + s2 * c2;
        // Update position
        const m1 = ellipsoid.movement * ratio;
        const m2 = ell.movement;
        const w = axisLength / (m1 + m2);
        ellipsoid.pos.sub(axis.clone().multiplyScalar(m1 * w));
        ell.pos.add(axis.clone().multiplyScalar(m2 * w));
    };
    const getOverlap = (ell, minDist, maxOverlap) => {
        let [axisLength, axis] = collisionAxis(
            ellipsoid.pos,
            ellipsoid.shape,
            ell.pos,
            ell.shape,
            ellipsoid.axisCache[ell.id],
            maxOverlap
        );
        ellipsoid.axisCache[ell.id] = axis;
        return Math.max(axisLength + minDist, 0);
    };
    const getSurfacePoint = (pos, dir) => {
        const inv = new Matrix3().getInverse(ellipsoid.shape);
        const p = pos.clone().sub(ellipsoid.pos).applyMatrix3(inv);
        const d = dir.clone().applyMatrix3(inv);
        d.normalize();
        const r = p.clone().sub(d.clone().multiplyScalar(d.dot(p)));
        const rLen = r.length();
        if (rLen > 1) return undefined;
        const x = d.multiplyScalar(Math.sqrt(1 - rLen ** 2));
        return r.clone().add(x).applyMatrix3(ellipsoid.shape).add(ellipsoid.pos);
    };
    const grow = amount => {
        if (amount >= 0)
            ellipsoid.shape = addMatrix3(
                ellipsoid.shape.multiplyScalar(1 - amount),
                new Matrix3().multiplyScalar(ellipsoid.radius * amount)
            );
        else
            ellipsoid.shape = addMatrix3(
                ellipsoid.shape.multiplyScalar(1 + amount),
                new Matrix3().multiplyScalar((-amount * ellipsoid.minDiameter.map(ellipsoid.radius * 2)) / 2)
            );
        const w = 0.2;
        const avg = Math.cbrt(ellipsoid.shape.determinant());
        ellipsoid.shape = addMatrix3(ellipsoid.shape.multiplyScalar(1 - w), new Matrix3().multiplyScalar(w * avg));
    };
    const diameter = () => {
        return 2 * Math.cbrt(ellipsoid.shape.determinant());
    };
    const getColor = (viewSizes, minAndMaxDiameter) => {
        return viewSizes ? valueToColor(diameter(), minAndMaxDiameter) : hexColorToVector(ellipsoid.color);
    };
    const getMatrix4 = () => {
        return mat3ToMat4(ellipsoid.shape).setPosition(ellipsoid.pos);
    };
    const getGeometry = (viewSizes, minAndMaxDiameter) => {
        const geom = new SphereGeometry(1, 16, 16).applyMatrix4(getMatrix4());
        geom.computeVertexNormals();
        const color = getColor(viewSizes, minAndMaxDiameter);
        geom.faces.forEach(face => (face.vertexColors = new Array(3).fill(true).map(() => color)));
        const bg = new BufferGeometry().fromGeometry(geom);
        delete bg.attributes.uv;
        return bg;
    };
    const draw = (scene, generateMesh, viewSizes, minAndMaxDiameter) => {
        const g = getGeometry(viewSizes, minAndMaxDiameter);
        if (generateMesh)
            ellipsoid.mesh = new Mesh(g, new MeshToonMaterial({ color: getColor(viewSizes, minAndMaxDiameter) }));
        ellipsoid.mesh.geometry = g;
        ellipsoid.mesh.matrixAutoUpdate = false;
        ellipsoid.mesh.matrix = getMatrix4();
        ellipsoid.mesh.updateMatrix();
        scene.add(ellipsoid.mesh);
        return ellipsoid.mesh;
    };
    const crossSectionDiameter = axis => {
        axis.normalize();
        return 2 * Math.sqrt(ellipsoid.shape.determinant() / extremum(ellipsoid.shape, axis).dot(axis));
    };
    const toPLY = (binary, simple) => {
        return plyParser([ellipsoid.mesh.geometry], {
            binary: binary,
            includeColors: !simple,
            includeNormals: !simple
        });
    };
    if (generateMesh) ellipsoid.mesh = new Mesh(getGeometry(false), new MeshToonMaterial({ color: ellipsoid.color }));
    return Object.assign(ellipsoid, {
        dispose,
        clone,
        boundingBoxD,
        boundingBox,
        containsPoint,
        keepInVoxel,
        collision,
        getOverlap,
        getSurfacePoint,
        grow,
        getColor,
        draw,
        getMatrix4,
        getGeometry,
        diameter,
        crossSectionDiameter,
        toPLY
    });
};

export default createEllipsoid;
