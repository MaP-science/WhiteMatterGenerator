import THREE from "./three.js";
import Ellipsoid from "./ellipsoid.js";
import plyParser from "../core/plyParser";
import { hexColorToVector, applyColor, addMatrix3, randomHexColor, projectOntoCube } from "./helperFunctions.js";

const {
    Vector3,
    MeshPhongMaterial,
    LineBasicMaterial,
    BufferGeometry,
    Line,
    Mesh,
    SphereBufferGeometry,
    VertexColors,
    DoubleSide,
    Geometry,
    Face3,
    InstancedMesh
} = THREE;

const computeCollisionTree = (ellipsoids, minDist) => {
    if (ellipsoids.length === 1)
        return {
            ellipsoid: ellipsoids[0],
            aabb: ellipsoids[0].boundingBox(minDist),
            containsPoint: p => ellipsoids[0].containsPoint(p)
        };
    const a = computeCollisionTree(ellipsoids.slice(0, Math.ceil(ellipsoids.length / 2)), minDist);
    const b = computeCollisionTree(ellipsoids.slice(Math.ceil(ellipsoids.length / 2)), minDist);
    const aabb = a.aabb.clone().union(b.aabb);
    return {
        a: a,
        b: b,
        aabb: aabb,
        containsPoint: p => {
            if (!aabb.containsPoint(p)) return false;
            return a.containsPoint(p) || b.containsPoint(p);
        }
    };
};

const collision = (a, b, minDist, maxOverlap) => {
    if (!a.aabb.intersectsBox(b.aabb)) return;
    if (b.ellipsoid) {
        if (a.ellipsoid) return a.ellipsoid.collision(b.ellipsoid, minDist, maxOverlap);
        return collision(b, a, minDist, maxOverlap);
    }
    const f1 = () => collision(b.a, a, minDist, maxOverlap);
    const f2 = () => collision(b.b, a, minDist, maxOverlap);
    if (Math.random() < 0.5) {
        f1();
        f2();
    } else {
        f2();
        f1();
    }
};

const getOverlap = (a, b, minDist, maxOverlap) => {
    if (!a.aabb.intersectsBox(b.aabb)) return 0;
    if (b.ellipsoid) {
        if (a.ellipsoid) return a.ellipsoid.getOverlap(b.ellipsoid, minDist, maxOverlap);
        return getOverlap(b, a, minDist, maxOverlap);
    }
    return Math.max(getOverlap(b.a, a, minDist, maxOverlap), getOverlap(b.b, a, minDist, maxOverlap));
};

export default class {
    constructor(pos, dir, radius, color, gFactor, { deformation, minDiameter, ellipsoidDensity, voxelSize }) {
        this.start = projectOntoCube(pos, dir, voxelSize);
        this.end = projectOntoCube(pos, dir.clone().negate(), voxelSize);
        this.gFactor = gFactor || 1;
        this.radius = radius / this.gFactor;
        this.ellipsoidDensity = ellipsoidDensity;
        this.voxelSize = voxelSize;
        this.deformation = deformation;
        this.minDiameter = minDiameter;
        this.color = color || randomHexColor();
        this.meshes = [];
        this.ellipsoids = [
            new Ellipsoid(this.start, this.radius, deformation, minDiameter, 1, this.color, false),
            new Ellipsoid(this.end, this.radius, deformation, minDiameter, 1, this.color, false)
        ];
        this.redistribute();
    }
    keepInVoxel() {
        this.ellipsoids.forEach(ellipsoid => ellipsoid.keepInVoxel(this.voxelSize));
        [this.ellipsoids[0], this.ellipsoids[this.ellipsoids.length - 1]].forEach(ellipsoid => {
            const ax = Math.abs(ellipsoid.pos.x);
            const ay = Math.abs(ellipsoid.pos.y);
            const az = Math.abs(ellipsoid.pos.z);
            if (ax > ay && ax > az) return (ellipsoid.pos.x *= this.voxelSize / (2 * ax));
            if (ay > az) return (ellipsoid.pos.y *= this.voxelSize / (2 * ay));
            ellipsoid.pos.z *= this.voxelSize / (2 * az);
        });
    }
    computeCollisionTree(minDist) {
        this.collisionTree = computeCollisionTree(this.ellipsoids, minDist);
    }
    collision(axon, minDist, maxOverlap) {
        return collision(this.collisionTree, axon.collisionTree, minDist, maxOverlap);
    }
    getOverlap(axon, minDist, maxOverlap) {
        return getOverlap(this.collisionTree, axon.collisionTree, minDist, maxOverlap);
    }
    grow(amount) {
        this.ellipsoids.forEach(ellipsoid => ellipsoid.grow(amount));
    }
    contract(amount) {
        for (let i = 1; i + 1 < this.ellipsoids.length; ++i) {
            const c = this.ellipsoids[i + 1].pos
                .clone()
                .add(this.ellipsoids[i - 1].pos)
                .divideScalar(2);
            const d = this.ellipsoids[i + 1].pos.clone().sub(this.ellipsoids[i - 1].pos);
            d.normalize();
            c.sub(this.ellipsoids[i].pos);
            d.multiplyScalar(c.dot(d));
            c.sub(d);
            this.ellipsoids[i].pos.add(c.multiplyScalar(amount));
        }
        this.redistribute();
    }
    redistribute() {
        const length = this.getLength();
        const ellipsoidCount = 1 + Math.max(Math.ceil(length * (this.ellipsoidDensity / (2 * this.radius))), 1);
        const dLength = length / (ellipsoidCount - 1);
        let d = 0;
        let index = 0;
        this.ellipsoids = [...Array(ellipsoidCount)].map((_, i) => {
            while (index + 2 < this.ellipsoids.length) {
                const l = this.ellipsoids[index].pos
                    .clone()
                    .sub(this.ellipsoids[index + 1].pos)
                    .length();
                if (d < l) break;
                d -= l;
                ++index;
            }
            const w =
                d /
                this.ellipsoids[index].pos
                    .clone()
                    .sub(this.ellipsoids[index + 1].pos)
                    .length();
            const e = new Ellipsoid(
                this.ellipsoids[index].pos
                    .clone()
                    .multiplyScalar(1 - w)
                    .add(this.ellipsoids[index + 1].pos.clone().multiplyScalar(w)),
                this.radius,
                this.deformation,
                this.minDiameter,
                1,
                this.color,
                false
            );
            e.shape = addMatrix3(
                this.ellipsoids[index].shape.clone().multiplyScalar(1 - w),
                this.ellipsoids[index + 1].shape.clone().multiplyScalar(w)
            );
            d += dLength;
            return e;
        });
    }
    getLength() {
        let result = 0;
        for (let i = 0; i + 1 < this.ellipsoids.length; ++i)
            result += this.ellipsoids[i].pos
                .clone()
                .sub(this.ellipsoids[i + 1].pos)
                .length();
        return result;
    }
    getSurfacePoint(pos, dir) {
        return this.ellipsoids.reduce((pMax, ellipsoid) => {
            const p = ellipsoid.getSurfacePoint(pos, dir);
            if (!pMax) return p;
            const distMax = pMax.clone().sub(pos).dot(dir);
            if (!p) return pMax;
            const dist = p.clone().sub(pos).dot(dir);
            return dist > distMax ? p : pMax;
        }, undefined);
    }
    generatePipe(gFactor, resolution, closed) {
        const getSP = (pos, dir, i, scale) => {
            const shape = this.ellipsoids[i].shape;
            this.ellipsoids[i].shape = shape.clone().multiplyScalar(scale);
            const sp = this.ellipsoids[i].getSurfacePoint(pos, dir);
            this.ellipsoids[i].shape = shape;
            return sp;
        };
        const d = this.ellipsoids[this.ellipsoids.length - 1].pos.clone().sub(this.ellipsoids[0].pos);
        d.normalize();
        const x = new Vector3(1, 0, 0);
        const y = new Vector3(0, 1, 0);
        const cx = d.clone().cross(x);
        const cy = d.clone().cross(y);
        const a = cx.length() > cy.length() ? cx : cy;
        a.normalize();
        const b = d.clone().cross(a).normalize();
        const verts = this.ellipsoids.map((ellipsoid, i) => {
            return new Array(resolution).fill(true).map((r, j) => {
                const angle = (2 * Math.PI * j) / resolution;
                const dir = a
                    .clone()
                    .multiplyScalar(Math.cos(angle))
                    .add(b.clone().multiplyScalar(Math.sin(angle)));
                let sp = getSP(ellipsoid.pos, dir, i, gFactor);
                let dist = sp.clone().sub(ellipsoid.pos).dot(dir);
                for (let i2 = i + 1; i2 < this.ellipsoids.length; ++i2) {
                    let sp2 = getSP(ellipsoid.pos, dir, i2, gFactor);
                    if (!sp2) break;
                    let dist2 = sp2.clone().sub(ellipsoid.pos).dot(dir);
                    if (dist2 < dist) continue;
                    sp = sp2;
                    dist = dist2;
                }
                for (let i2 = i - 1; i2 >= 0; --i2) {
                    let sp2 = getSP(ellipsoid.pos, dir, i2, gFactor);
                    if (!sp2) break;
                    let dist2 = sp2.clone().sub(ellipsoid.pos).dot(dir);
                    if (dist2 < dist) continue;
                    sp = sp2;
                    dist = dist2;
                }
                return sp;
            });
        });
        const geom = new Geometry();
        geom.vertices = verts.flat();
        geom.faces = verts
            .slice(0, verts.length - 1)
            .map((verti, i) =>
                verti.map((vertij, j) => {
                    const i00 = i * resolution + j;
                    const i01 = i * resolution + ((j + 1) % resolution);
                    const i10 = (i + 1) * resolution + j;
                    const i11 = (i + 1) * resolution + ((j + 1) % resolution);
                    return [new Face3(i00, i01, i10), new Face3(i10, i01, i11)];
                })
            )
            .flat()
            .flat();
        if (closed) {
            const index1 = geom.vertices.length;
            geom.vertices.push(this.ellipsoids[0].pos.clone());
            const index2 = geom.vertices.length;
            geom.vertices.push(this.ellipsoids[this.ellipsoids.length - 1].pos.clone());
            verts[0].forEach((v, i) => {
                geom.faces.push(
                    new Face3(verts[0].length - 1 - i, verts[0].length - 1 - ((i + 1) % verts[0].length), index1)
                );
            });
            verts[verts.length - 1].forEach((v, i) => {
                geom.faces.push(
                    new Face3(
                        (verts.length - 1) * resolution + i,
                        (verts.length - 1) * resolution + ((i + 1) % verts[verts.length - 1].length),
                        index2
                    )
                );
            });
        }
        geom.computeVertexNormals();
        geom.faces.forEach(
            face => (face.vertexColors = new Array(3).fill(true).map(() => hexColorToVector(this.color)))
        );
        return new Mesh(
            new BufferGeometry().fromGeometry(geom),
            new MeshPhongMaterial({ vertexColors: VertexColors, side: DoubleSide })
        );
    }
    generatePipes(scene, resolution) {
        const outer = this.generatePipe(1, resolution);
        const inner = this.generatePipe(this.gFactor, resolution);
        scene.add(outer);
        scene.add(inner);
        this.meshes = [outer, inner];
    }
    generateSkeleton(scene) {
        const mesh = new Line(
            applyColor(new BufferGeometry().setFromPoints(this.ellipsoids.map(ellipsoid => ellipsoid.pos)), this.color),
            new LineBasicMaterial({ vertexColors: VertexColors, side: DoubleSide })
        );
        this.meshes = [mesh];
        scene.add(mesh);
    }
    draw(scene) {
        const geom = applyColor(new SphereBufferGeometry(1, 16, 16), this.color);
        const material = new MeshPhongMaterial({ vertexColors: VertexColors, side: DoubleSide });
        const mesh = new InstancedMesh(geom, material, this.ellipsoids.length);
        this.ellipsoids.forEach((ellipsoid, i) => {
            mesh.setMatrixAt(i, ellipsoid.getMatrix4());
        });
        scene.add(mesh);
        this.mesh = [mesh];
    }
    toJSON() {
        return {
            position: [this.start.x, this.start.y, this.start.z],
            direction: [this.end.x - this.start.x, this.end.y - this.start.y, this.end.z - this.start.z],
            maxDiameter: this.radius * this.gFactor * 2,
            color: this.color,
            gFactor: this.gFactor,
            ellipsoids: this.ellipsoids.map((ellipsoid, i) => {
                const myelinDiameter = ellipsoid.crossSectionDiameter(
                    this.ellipsoids[Math.min(i + 1, this.ellipsoids.length - 1)].pos
                        .clone()
                        .sub(this.ellipsoids[Math.max(i - 1, 0)].pos)
                );
                return {
                    position: [ellipsoid.pos.x, ellipsoid.pos.y, ellipsoid.pos.z],
                    shape: ellipsoid.shape.elements,
                    axonDiameter: myelinDiameter * this.gFactor,
                    myelinDiameter: myelinDiameter
                };
            })
        };
    }
    toPLY(binary, simple, i) {
        return plyParser(this.meshes[i].geometry, {
            binary: binary,
            includeColors: !simple,
            includeNormals: !simple
        });
    }
}
